-- The messages the system sends on its own become editable templates.
--
-- The form submission confirmation, the new submission notice to the team and
-- the hub-ready email were written in the edge functions. They now read a row
-- from email_templates, found by system_key, and the Hub link message that staff
-- copy into WhatsApp reads a row from whatsapp_templates the same way.
--
-- No rows are seeded here. The default text lives in one place, in
-- supabase/functions/_shared/systemTemplates.ts, and a row only exists once
-- someone edits the message on the Messaging page. Resetting a message deletes
-- its row, and the default is used again. Until then every send behaves exactly
-- as it did before.
--
-- system_key is null for every template the team writes. It is unique, so each
-- system message has at most one row, and the Messaging page matches on it.
alter table email_templates add column if not exists system_key text unique;
alter table whatsapp_templates add column if not exists system_key text unique;
