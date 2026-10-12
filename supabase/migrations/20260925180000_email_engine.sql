-- Phase 5: Email Engine.
--
-- Scope (confirmed against the phase-5 kickoff spec): outbound sending plus
-- a complete per-lead log, not two-way mail — inbound reply ingestion is
-- explicitly out of scope. Every send funnels through the existing shared
-- mail infra (_shared/email.ts, same as Phase 0/1/4) — no second sending
-- path.
--
-- Design:
--   * email_templates — admin-editable, {{token}}-style personalization
--     placeholders resolved in TS (src/lib/emailEngine/personalization.ts),
--     never hardcoded strings.
--   * stage_email_rules — maps one pipeline stage to one template, with an
--     explicit enabled toggle. `unique (stage)` keeps this a simple
--     admin-editable mapping (a stage's rule is edited in place, not
--     multiplied). `enabled` defaults to FALSE — nothing auto-sends for a
--     stage until staff explicitly turns it on for that stage; the phase
--     spec's own stated assumption ("not every stage needs a rule... this
--     is opt-in") is what this default encodes, and it holds (confirmed in
--     the phase-5 verification report, not changed).
--   * lead_email_threads / lead_email_messages — threaded per Phase 2 lead
--     (not a raw email address), so the whole history lives on the lead's
--     own record. `lead_email_messages` rows for a manual send are inserted
--     complete (subject/body/to_email already known) before the delivery
--     attempt; rows for a stage-triggered send are inserted as a minimal
--     pending stub by the trigger below (template_id known, subject/body/
--     to_email still null) before any identity resolution or send attempt
--     happens — in both cases the row exists before delivery is attempted,
--     so a crash mid-send leaves evidence instead of silence.
--   * The stage-change trigger below is deliberately minimal: it only
--     decides eligibility (an enabled rule exists for the new stage) and
--     inserts the pending stub. Identity resolution, personalization
--     rendering, and the actual send all happen in the lead-email-dispatch
--     edge function (TS), matching how every other business-logic decision
--     in this project lives in TS, not plpgsql (see hub-hydrate/hub-send).
-- ---------------------------------------------------------------------------

create table if not exists email_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subject    text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_templates_touch on email_templates;
create trigger email_templates_touch before update on email_templates
  for each row execute function touch_updated_at();

create table if not exists stage_email_rules (
  id          uuid primary key default gen_random_uuid(),
  stage       lead_stage not null unique,
  template_id uuid not null references email_templates(id) on delete cascade,
  enabled     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists stage_email_rules_touch on stage_email_rules;
create trigger stage_email_rules_touch before update on stage_email_rules
  for each row execute function touch_updated_at();

create table if not exists lead_email_threads (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null unique references leads(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- direction is always 'outbound' for now (inbound reply ingestion is
-- explicitly out of scope this phase) — kept as a column rather than
-- assumed so a later phase can add 'inbound' without a schema change.
create table if not exists lead_email_messages (
  id                   uuid primary key default gen_random_uuid(),
  thread_id            uuid not null references lead_email_threads(id) on delete cascade,
  direction            text not null default 'outbound' check (direction in ('outbound')),
  trigger              text not null check (trigger in ('manual', 'stage_change')),
  template_id          uuid references email_templates(id) on delete set null,
  stage_email_rule_id  uuid references stage_email_rules(id) on delete set null,
  to_email             text,
  subject              text,
  body                 text,
  status               text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error                text,
  sent_by              uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  sent_at              timestamptz
);
create index if not exists lead_email_messages_thread_idx on lead_email_messages (thread_id, created_at);
create index if not exists lead_email_messages_status_idx on lead_email_messages (status) where status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS — staff-only, same shape as every other content/pipeline table in
-- this project. No public policy anywhere.
-- ---------------------------------------------------------------------------
alter table email_templates     enable row level security;
alter table stage_email_rules   enable row level security;
alter table lead_email_threads  enable row level security;
alter table lead_email_messages enable row level security;

create policy email_templates_admin_all on email_templates
  for all to authenticated using (is_admin()) with check (is_admin());

create policy stage_email_rules_admin_all on stage_email_rules
  for all to authenticated using (is_admin()) with check (is_admin());

create policy lead_email_threads_admin_all on lead_email_threads
  for all to authenticated using (is_admin()) with check (is_admin());

create policy lead_email_messages_admin_all on lead_email_messages
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Trigger: on a real stage change, if an enabled rule exists for the new
-- stage, get-or-create the lead's thread and insert a pending stub message
-- referencing the template — before any identity resolution or send
-- attempt. Fires from the same leads.stage UPDATE the admin board already
-- performs (see log_lead_stage_change) — no new write path for staff.
-- ---------------------------------------------------------------------------
create or replace function dispatch_stage_email_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule stage_email_rules%rowtype;
  v_thread_id uuid;
begin
  if TG_OP = 'UPDATE' and NEW.stage is distinct from OLD.stage then
    select * into v_rule from stage_email_rules where stage = NEW.stage and enabled = true limit 1;
    if v_rule.id is not null then
      insert into lead_email_threads (lead_id) values (NEW.id)
        on conflict (lead_id) do nothing;
      select id into v_thread_id from lead_email_threads where lead_id = NEW.id;

      insert into lead_email_messages (thread_id, trigger, template_id, stage_email_rule_id, status)
      values (v_thread_id, 'stage_change', v_rule.template_id, v_rule.id, 'pending');
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists leads_dispatch_stage_email on leads;
create trigger leads_dispatch_stage_email
  after update on leads
  for each row execute function dispatch_stage_email_rule();
