-- Phase 4: Personalized Proof Layer.
--
-- Design (confirmed against build-fellowship's real ax-hub / ax-hub-send /
-- axHubService.js, examined directly — see the phase report for the exact
-- file:line citations):
--
--   * hubs.lead_id is a REAL foreign key into Phase 2's leads table (locked
--     in by the phase spec) — the source only loosely references
--     form_submissions by a bare uuid column, no FK. This lets a hub be
--     surfaced straight from a lead's pipeline card / detail page.
--   * Track-based templates use a real FK to Phase 3's tracks table, not the
--     source's hardcoded track enum ('founder'/'beginner'/'juniors').
--   * Module inheritance: hub_templates.modules is NOT NULL DEFAULT '[]' (a
--     template always has an explicit list). hubs.modules is a bare
--     nullable jsonb with NO default and NO NOT NULL — this mirrors the
--     source's ax_hubs.modules column exactly: NULL = "inherit the
--     template's module list", a non-null array (including an explicit
--     empty array) = "this hub customized it". There is deliberately no
--     CHECK constraint distinguishing the two, same as the source — it's
--     enforced by application-layer convention (never insert an explicit
--     `null` vs. omitting the key), not SQL.
--   * hubs.status only has the three states this phase actually drives
--     (draft/sent/opened) — the source's call_booked/paid states depend on
--     cal.com (Phase 7, not built) and a payment flow that doesn't exist
--     here, so they're dropped rather than added as dead states nothing
--     ever sets.
--   * No public RLS policy on any of these three tables (unlike
--     form_submissions, which allows anon insert). All public access to a
--     hub goes through the hub-hydrate edge function, which uses the
--     service role and validates the caller by token, not by auth — same
--     shape as the source's ax-hub edge function.
-- ---------------------------------------------------------------------------

create table if not exists hub_templates (
  id         uuid primary key default gen_random_uuid(),
  track_id   uuid not null references tracks(id) on delete cascade,
  name       text not null default 'Default',
  modules    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hub_templates_track_idx on hub_templates (track_id);

drop trigger if exists hub_templates_touch on hub_templates;
create trigger hub_templates_touch before update on hub_templates
  for each row execute function touch_updated_at();

create table if not exists hubs (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique default encode(gen_random_bytes(16), 'hex'),
  lead_id         uuid not null references leads(id) on delete cascade,
  track_id        uuid not null references tracks(id),
  template_id     uuid references hub_templates(id) on delete set null,
  status          text not null default 'draft' check (status in ('draft', 'sent', 'opened')),
  modules         jsonb, -- null = inherit hub_templates.modules; explicit array = customized
  open_count      integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at  timestamptz,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists hubs_lead_idx   on hubs (lead_id);
create index if not exists hubs_track_idx  on hubs (track_id);
create index if not exists hubs_status_idx on hubs (status);

drop trigger if exists hubs_touch on hubs;
create trigger hubs_touch before update on hubs
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- hub_events — engagement tracking, written in batches by hub-hydrate's
-- 'track' action (source batches client-side with a queue; see the phase
-- report). Append-only, no update/delete policy for anyone.
-- ---------------------------------------------------------------------------
create table if not exists hub_events (
  id          uuid primary key default gen_random_uuid(),
  hub_id      uuid not null references hubs(id) on delete cascade,
  session_id  text not null,
  type        text not null,
  target_type text,
  target_id   text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists hub_events_hub_idx on hub_events (hub_id, created_at);

alter table hub_templates enable row level security;
alter table hubs          enable row level security;
alter table hub_events    enable row level security;

create policy hub_templates_staff_all on hub_templates
  for all to authenticated using (is_admin()) with check (is_admin());

create policy hubs_staff_all on hubs
  for all to authenticated using (is_admin()) with check (is_admin());

create policy hub_events_staff_select on hub_events
  for select to authenticated using (is_admin());
-- Deliberately no insert/update/delete policy for any role — hub_events is
-- written exclusively by the hub-hydrate edge function via the service role
-- (same append-only-via-service-role shape as lead_stage_history).
