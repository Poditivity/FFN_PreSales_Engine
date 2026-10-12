-- Phase 4: hub_settings — the booking URL the hub-notification email and
-- public hub page's call-to-action link to. Deliberately starts empty: the
-- source hardcodes a booking page URL (cal.com integration is Phase 7, not
-- built yet), and per the phase spec that's stripped rather than carried
-- forward — this is a configurable, staff-editable settings field instead
-- of a dead link to someone else's booking page. Same singleton-row shape
-- as email_provider_settings.
create table if not exists hub_settings (
  id          boolean primary key default true check (id),
  booking_url text,
  updated_at  timestamptz not null default now()
);
insert into hub_settings (id) values (true) on conflict (id) do nothing;

alter table hub_settings enable row level security;

create policy hub_settings_staff_all on hub_settings
  for all to authenticated using (is_admin()) with check (is_admin());
