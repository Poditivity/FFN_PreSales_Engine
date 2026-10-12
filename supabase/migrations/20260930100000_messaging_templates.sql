-- One Messaging page for email templates, stage rules and WhatsApp
-- templates. Two changes sit behind it.
--
-- 1. whatsapp_templates: reusable plain-text WhatsApp messages an admin loads
--    into the composer. They are the admin's own wording, sent by opening a
--    WhatsApp chat with the text filled in. They are not the Meta-approved
--    templates in supabase/functions/_shared/notifications/templates.ts, which
--    the automatic notifications use.
--
-- 2. {{name}} is now the only variable a template offers. Templates written
--    with the old {{lead_name}} are rewritten to it here, so they open in the
--    editor with the current variable. {{program}} is left alone: the sender
--    still resolves it, and the editor tells an admin to remove it when the
--    template is next edited.
create table if not exists whatsapp_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  body       text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists whatsapp_templates_touch on whatsapp_templates;
create trigger whatsapp_templates_touch before update on whatsapp_templates
  for each row execute function touch_updated_at();

alter table whatsapp_templates enable row level security;

drop policy if exists whatsapp_templates_admin_all on whatsapp_templates;
create policy whatsapp_templates_admin_all on whatsapp_templates
  for all to authenticated using (is_admin()) with check (is_admin());

update email_templates
set subject = regexp_replace(subject, '\{\{\s*lead_name\s*\}\}', '{{name}}', 'g'),
    body    = regexp_replace(body,    '\{\{\s*lead_name\s*\}\}', '{{name}}', 'g')
where subject ~ '\{\{\s*lead_name\s*\}\}' or body ~ '\{\{\s*lead_name\s*\}\}';
