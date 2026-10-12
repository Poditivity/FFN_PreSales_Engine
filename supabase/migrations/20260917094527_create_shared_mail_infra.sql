-- email_provider_settings — single-row routing config.
-- Singleton enforced by a boolean primary key (id always = true).
create table if not exists email_provider_settings (
  id               boolean primary key default true check (id),
  primary_provider text not null default 'resend'
                     check (primary_provider in ('zeptomail', 'resend')),
  fallback_enabled boolean not null default true,
  updated_at       timestamptz not null default now()
);
insert into email_provider_settings (id) values (true) on conflict (id) do nothing;

alter table email_provider_settings enable row level security;

create policy email_provider_settings_staff_all on email_provider_settings
  for all using (is_admin()) with check (is_admin());

-- email_send_log — every outbound send attempt, from every edge function.
create table if not exists email_send_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  to_emails      text[] not null,
  subject        text,
  status         text not null check (status in ('sent', 'failed')),
  provider       text,
  fell_back_from text,
  error          text,
  source         text
);
create index if not exists email_send_log_created_at_idx on email_send_log (created_at desc);
create index if not exists email_send_log_provider_idx   on email_send_log (provider);

alter table email_send_log enable row level security;
create policy email_send_log_staff_all on email_send_log
  for all using (is_admin()) with check (is_admin());
