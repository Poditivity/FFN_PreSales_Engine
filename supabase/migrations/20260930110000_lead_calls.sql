-- Call log: every call the team makes to a lead, and the stage the lead was in
-- when it happened.
--
-- The stage is stored on the call, not looked up later, because a lead moves on
-- and "how many calls did we make at MQL" has to keep the same answer after it
-- reaches SQL. It defaults to the lead's current stage in the UI; whoever logs
-- a call late can pick the stage it was actually made at.
create table if not exists lead_calls (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  stage         lead_stage not null,
  outcome       text not null check (outcome in ('connected', 'no_answer', 'voicemail', 'busy', 'wrong_number', 'call_back_later')),
  called_at     timestamptz not null default now(),
  notes         text,
  follow_up_on  date,
  called_by     uuid references profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists lead_calls_lead_idx on lead_calls (lead_id, called_at desc);
create index if not exists lead_calls_called_at_idx on lead_calls (called_at desc);

drop trigger if exists lead_calls_touch on lead_calls;
create trigger lead_calls_touch before update on lead_calls
  for each row execute function touch_updated_at();

alter table lead_calls enable row level security;

-- Anyone on the team can read every call and log their own. Only the person who
-- logged a call, or a super admin, can change or remove it, so the counts stay
-- trustworthy.
drop policy if exists lead_calls_select on lead_calls;
create policy lead_calls_select on lead_calls
  for select to authenticated using (is_admin());

drop policy if exists lead_calls_insert on lead_calls;
create policy lead_calls_insert on lead_calls
  for insert to authenticated with check (is_admin() and called_by = auth.uid());

drop policy if exists lead_calls_update on lead_calls;
create policy lead_calls_update on lead_calls
  for update to authenticated
  using (is_admin() and (called_by = auth.uid() or is_super_admin()))
  with check (is_admin() and (called_by = auth.uid() or is_super_admin()));

drop policy if exists lead_calls_delete on lead_calls;
create policy lead_calls_delete on lead_calls
  for delete to authenticated
  using (is_admin() and (called_by = auth.uid() or is_super_admin()));

-- One row per lead that has been called: the numbers the leads list needs
-- without loading every call. security_invoker keeps the policies above in force.
create or replace view lead_call_stats with (security_invoker = true) as
  select
    lead_id,
    count(*)::int                                     as total,
    (count(*) filter (where outcome = 'connected'))::int as connected,
    max(called_at)                                    as last_called_at,
    max(follow_up_on)                                 as next_follow_up_on
  from lead_calls
  group by lead_id;

grant select on lead_call_stats to authenticated;
