-- Phase 2: Lead Database & Stage Pipeline.
--
-- Design (confirmed, do not re-derive):
--   * No staff/admin split — everyone with access is 'admin'. Any admin can
--     move a lead to any stage in any order; the only gate is admin-only
--     RLS on the table, never a per-transition adjacency check.
--   * Lead creation is automatic: a completed form_submissions row creates
--     its own leads row via trigger, no manual "promote to lead" action.
--   * No deduplication — every completed submission gets its own lead, even
--     if the same person applies twice. Identity is never matched/merged.
--   * Program association is derived via form_submissions -> forms, not
--     duplicated onto leads, so the two can't drift apart.

create type lead_stage as enum ('lead', 'mql', 'sql', 'customer', 'advocate');

-- ---------------------------------------------------------------------------
-- leads — one row per completed submission (1:1 via a unique FK).
-- owner_id is nullable and left unassigned by default: no auto-assignment
-- rule exists yet (see the phase report — this is a flagged, open gap,
-- not something invented here).
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  form_submission_id  uuid not null unique references form_submissions(id) on delete cascade,
  stage               lead_stage not null default 'lead',
  owner_id            uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_owner_idx on leads (owner_id);

drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- lead_stage_history — append-only. Every transition writes a row here,
-- including the initial creation (from null to 'lead'), so Phase 5's
-- stage-aware email engine has a complete log from day one.
-- ---------------------------------------------------------------------------
create table if not exists lead_stage_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  from_stage  lead_stage,
  to_stage    lead_stage not null,
  changed_by  uuid references profiles(id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index if not exists lead_stage_history_lead_idx on lead_stage_history (lead_id, changed_at);

-- ---------------------------------------------------------------------------
-- RLS — leads are internal-only. No public access at all (unlike
-- form_submissions, which has a public insert policy). Admin can read and
-- move any lead to any stage; that single check is the whole permission
-- boundary, nothing keyed to which specific transition is being made.
-- ---------------------------------------------------------------------------
alter table leads              enable row level security;
alter table lead_stage_history enable row level security;

create policy leads_admin_all on leads
  for all to authenticated
  using  (is_admin())
  with check (is_admin());

create policy lead_stage_history_admin_select on lead_stage_history
  for select to authenticated
  using (is_admin());
-- Deliberately no insert/update/delete policy on lead_stage_history for any
-- role: it's append-only and written exclusively by the SECURITY DEFINER
-- trigger functions below (same pattern as upsert_form_submission), never
-- directly by a client.

-- ---------------------------------------------------------------------------
-- Trigger: auto-create a lead the moment a submission is marked completed.
-- Fires on INSERT (a submission created already-completed) or on UPDATE
-- where completed actually changed (the normal partial -> final-submit
-- path). ON CONFLICT DO NOTHING on the unique FK guards against a second
-- lead if the row is updated again while already completed.
-- ---------------------------------------------------------------------------
create or replace function create_lead_on_submission_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
begin
  if NEW.completed = true
     and (TG_OP = 'INSERT' or OLD.completed is distinct from NEW.completed) then
    insert into leads (form_submission_id)
    values (NEW.id)
    on conflict (form_submission_id) do nothing
    returning id into v_lead_id;

    if v_lead_id is not null then
      insert into lead_stage_history (lead_id, from_stage, to_stage, changed_by)
      values (v_lead_id, null, 'lead', null);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists form_submissions_create_lead on form_submissions;
create trigger form_submissions_create_lead
  after insert or update on form_submissions
  for each row execute function create_lead_on_submission_complete();

-- ---------------------------------------------------------------------------
-- Trigger: log every stage change made directly on leads (the admin board
-- updates leads.stage via a plain RLS-gated UPDATE — no separate RPC).
-- auth.uid() resolves the acting user from the request's JWT regardless of
-- SECURITY DEFINER, same as everywhere else in this project.
-- ---------------------------------------------------------------------------
create or replace function log_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and NEW.stage is distinct from OLD.stage then
    insert into lead_stage_history (lead_id, from_stage, to_stage, changed_by)
    values (NEW.id, OLD.stage, NEW.stage, auth.uid());
  end if;
  return NEW;
end;
$$;

drop trigger if exists leads_log_stage_change on leads;
create trigger leads_log_stage_change
  after update on leads
  for each row execute function log_lead_stage_change();
