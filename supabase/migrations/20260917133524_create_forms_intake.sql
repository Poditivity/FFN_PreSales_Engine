create extension if not exists pgcrypto;

-- shared updated_at trigger fn, reused by every table in the project
create or replace function touch_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;

-- ---------------------------------------------------------------------------
-- forms — the form definition. schema is a flat list of field definitions
-- (typed at runtime by Zod, not a React Flow graph — see forms.ts).
-- payment_link replaces the source system's Razorpay-specific wiring with a
-- neutral, nullable CTA link.
-- ---------------------------------------------------------------------------
create table if not exists forms (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text not null unique,
  status       text not null default 'draft' check (status in ('draft','active','closed')),
  schema       jsonb not null default '{"fields":[]}'::jsonb,
  payment_link text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists forms_touch on forms;
create trigger forms_touch before update on forms
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- form_submissions — one row per (form, browser session). status is a bare
-- stub for the future lead pipeline (Phase 2) — nothing more than that here.
-- ---------------------------------------------------------------------------
create table if not exists form_submissions (
  id                    uuid primary key default gen_random_uuid(),
  form_id               uuid not null references forms(id) on delete cascade,
  session_id            text not null,
  data                  jsonb not null default '{}'::jsonb,
  field_timings         jsonb not null default '{}'::jsonb,
  keystroke_counts      jsonb not null default '{}'::jsonb,
  time_on_form_seconds  integer,
  partial               boolean not null default true,
  completed             boolean not null default false,
  status                text,        -- bare stub for the future lead pipeline
  admin_notes           text,
  rating                smallint check (rating is null or rating between 1 and 5),
  confirmation_email_sent_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (form_id, session_id)
);
create index if not exists form_submissions_form_idx     on form_submissions (form_id, created_at desc);
create index if not exists form_submissions_completed_idx on form_submissions (completed) where completed;
create index if not exists form_submissions_rating_idx   on form_submissions (rating);

drop trigger if exists form_submissions_touch on form_submissions;
create trigger form_submissions_touch before update on form_submissions
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table forms            enable row level security;
alter table form_submissions enable row level security;

create policy forms_public_select on forms
  for select to public
  using (status = 'active');

create policy forms_staff_all on forms
  for all to authenticated
  using  (is_admin())
  with check (is_admin());

-- No direct-table INSERT/UPDATE policy for anon on form_submissions.
-- All writes go through upsert_form_submission() below (SECURITY DEFINER),
-- which is the only place the active-form check can be reliably enforced —
-- a direct-table policy would let a caller bypass that check entirely.
create policy submissions_admin_select on form_submissions
  for select to authenticated
  using (is_admin());

create policy submissions_admin_update on form_submissions
  for update to authenticated
  using  (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- upsert_form_submission RPC (SECURITY DEFINER)
--
-- Fixes two bugs present in the source system:
--   1. Now checks the target form is status = 'active' before accepting any
--      write (partial or final) — the source RPC accepted submissions to
--      draft/closed forms.
--   2. (Reliability of the final flush is a client-side fix — see
--      useFormSubmission's flushOnUnload, which uses fetch keepalive.)
-- ---------------------------------------------------------------------------
create or replace function upsert_form_submission(
  p_session_id           text,
  p_form_id              uuid,
  p_data                 jsonb    default '{}'::jsonb,
  p_field_timings        jsonb    default '{}'::jsonb,
  p_keystroke_counts     jsonb    default '{}'::jsonb,
  p_time_on_form_seconds integer  default null,
  p_partial              boolean  default true,
  p_completed            boolean  default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from forms where id = p_form_id and status = 'active'
  ) then
    raise exception 'Form % is not accepting submissions', p_form_id
      using errcode = 'P0001';
  end if;

  insert into form_submissions (
    form_id, session_id, data, field_timings, keystroke_counts,
    time_on_form_seconds, partial, completed
  )
  values (
    p_form_id, p_session_id, p_data, p_field_timings, p_keystroke_counts,
    p_time_on_form_seconds, p_partial, p_completed
  )
  on conflict (form_id, session_id) do update set
    data                 = excluded.data,
    field_timings        = excluded.field_timings,
    keystroke_counts     = excluded.keystroke_counts,
    time_on_form_seconds = excluded.time_on_form_seconds,
    partial              = excluded.partial,
    completed            = excluded.completed,
    updated_at           = now();
end;
$$;

revoke execute on function upsert_form_submission from public;
grant  execute on function upsert_form_submission to anon, authenticated;
