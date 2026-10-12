-- WhatsApp as a second notification channel alongside email.
--
-- profiles.phone: an admin/staff member's own WhatsApp number, for the
-- new-submission alert they already get by email. Nullable — most profiles
-- won't have one, and those admins simply keep email only. Applicants'
-- numbers are not stored here: they come from the phone field on their own
-- form submission (or hubs.applicant_whatsapp for a standalone hub).
alter table public.profiles add column if not exists phone text;

-- whatsapp_send_log: one row per WhatsApp attempt where the recipient had a
-- number (sent, failed, or skipped because the number was unusable). Mirrors
-- email_send_log, except the number itself is stored masked.
create table if not exists whatsapp_send_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  notification_type text not null,
  template_name     text,
  recipient_ref     text,
  to_phone_masked   text,
  status            text not null check (status in ('sent', 'failed', 'skipped')),
  reason            text,
  http_status       integer,
  error_code        text,
  error_category    text,
  error_message     text,
  wa_message_id     text,
  source            text
);
create index if not exists whatsapp_send_log_created_at_idx on whatsapp_send_log (created_at desc);
create index if not exists whatsapp_send_log_status_idx on whatsapp_send_log (status);

alter table whatsapp_send_log enable row level security;
create policy whatsapp_send_log_staff_all on whatsapp_send_log
  for all using (is_admin()) with check (is_admin());
