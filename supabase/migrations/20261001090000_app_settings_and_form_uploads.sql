-- Workspace settings the team edits on the Settings page, plus what form file
-- uploads need.
--
--   app_settings        one row. Escalation delay, digest schedule, the largest
--                       file a form may take, the privacy policy shown on every
--                       form, and the last Cloudflare R2 usage reading.
--   public_form_settings()
--                       the three of those the public form needs, readable
--                       without signing in. Nothing else in app_settings is.
--   form_upload_log     one row per upload an applicant started, so the
--                       form-upload-presign function can limit how many a
--                       session or a form can start in an hour. Written and read
--                       by that function only (service role).
--   hubs.sent_at        when a hub was first sent. Hubs only had a status, so
--                       "hubs sent today" could not be counted.

create table if not exists app_settings (
  id boolean primary key default true check (id),

  -- Minutes a lead may wait without a sent hub before the team is told. Null
  -- turns escalation off.
  escalation_minutes integer check (escalation_minutes is null or escalation_minutes between 5 and 43200),
  -- When escalation was last switched on or its delay changed. Only leads that
  -- arrived after this are escalated, so turning it on does not announce every
  -- lead already in the system.
  escalation_since timestamptz,

  -- Digest times are wall-clock IST (Asia/Kolkata), as HH:MM.
  daily_digest_enabled boolean not null default true,
  daily_digest_time text not null default '19:00' check (daily_digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  weekly_digest_enabled boolean not null default true,
  -- 0 = Sunday ... 6 = Saturday.
  weekly_digest_day smallint not null default 1 check (weekly_digest_day between 0 and 6),
  weekly_digest_time text not null default '09:00' check (weekly_digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),

  -- The workspace ceiling on one uploaded file. A form's own limit can only be lower.
  upload_max_mb integer not null default 5 check (upload_max_mb between 1 and 10),

  privacy_policy_url text,
  privacy_policy_text text,

  -- Written by the r2-usage function.
  r2_used_bytes bigint,
  r2_object_count bigint,
  r2_checked_at timestamptz,
  r2_truncated boolean not null default false,

  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists app_settings_touch on app_settings;
create trigger app_settings_touch before update on app_settings
  for each row execute function touch_updated_at();

create or replace function public.app_settings_track_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.escalation_minutes is not null
     and new.escalation_minutes is distinct from old.escalation_minutes then
    new.escalation_since := now();
  end if;
  return new;
end;
$$;

drop trigger if exists app_settings_escalation_since on app_settings;
create trigger app_settings_escalation_since before update on app_settings
  for each row execute function public.app_settings_track_escalation();

alter table app_settings enable row level security;

drop policy if exists app_settings_admin_all on app_settings;
create policy app_settings_admin_all on app_settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- The slice of settings a public form may read.
create or replace function public.public_form_settings()
returns table (privacy_policy_url text, privacy_policy_text text, upload_max_mb integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.privacy_policy_url, s.privacy_policy_text, s.upload_max_mb
  from app_settings s
  where s.id;
$$;

revoke all on function public.public_form_settings() from public;
grant execute on function public.public_form_settings() to anon, authenticated;

create table if not exists form_upload_log (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references forms(id) on delete cascade,
  field_id     text not null,
  session_id   text not null,
  object_key   text not null,
  content_type text not null,
  size_bytes   bigint not null,
  created_at   timestamptz not null default now()
);
create index if not exists form_upload_log_session_idx on form_upload_log (session_id, created_at desc);
create index if not exists form_upload_log_form_idx on form_upload_log (form_id, created_at desc);

-- No policy for any role: only the service role reads or writes it.
alter table form_upload_log enable row level security;

-- hubs.sent_at. Backfilled from the first open, else the last change, which is
-- the closest the old data gets; every hub sent from here on is exact.
alter table hubs add column if not exists sent_at timestamptz;

update hubs
set sent_at = coalesce(first_opened_at, updated_at)
where sent_at is null and status in ('sent', 'opened');

create or replace function public.hubs_set_sent_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('sent', 'opened') and new.sent_at is null then
    new.sent_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists hubs_sent_at on hubs;
create trigger hubs_sent_at before insert or update on hubs
  for each row execute function public.hubs_set_sent_at();

create index if not exists hubs_sent_at_idx on hubs (sent_at) where sent_at is not null;
