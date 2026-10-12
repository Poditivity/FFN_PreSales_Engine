-- Phase 4 follow-up: hubs for people who are not (yet) leads.
--
-- The Phase 4 migration locked hubs.lead_id as a required FK so every hub
-- traces back to a real completed application. Staff also need to send a
-- hub link to a prospect who never applied — a cold contact, a referral —
-- so lead_id becomes optional and a hub with no lead carries its own
-- identity directly. When lead_id IS set, identity is still derived from
-- the lead's form submission and never duplicated here (Phase 2's own rule,
-- restated in hub-send/hub-hydrate's headers) — these three columns are
-- only ever read when lead_id is null.

alter table hubs alter column lead_id drop not null;

alter table hubs add column if not exists applicant_name text;
alter table hubs add column if not exists applicant_email text;
alter table hubs add column if not exists applicant_whatsapp text;

-- A hub always has SOME identity to send to: either a real lead, or its own
-- applicant_name (email/whatsapp are optional on top of that — same
-- "only a name is required" rule the create form itself enforces).
alter table hubs add constraint hubs_identity_source_check
  check (lead_id is not null or applicant_name is not null);
