-- Dormant and lost: the two exits from the pipeline.
--
-- The design system defines seven stages: lead, mql, sql, customer and
-- advocate on the path, plus dormant (no reply past the follow-up window, still
-- open) and lost (declined or disqualified, closed). lead_stage only had the
-- five path stages, so a lead that stalled or dropped out had nowhere to go.
--
-- Adding the values is all leads, lead_stage_history and stage_email_rules need:
-- they already store lead_stage, and log_lead_stage_change already writes a
-- history row for any change, so a move to an exit is logged like any other.
-- Nothing is renumbered; existing rows are untouched.
alter type lead_stage add value if not exists 'dormant';
alter type lead_stage add value if not exists 'lost';

-- The dashboard funnel counts a lead at every stage it has reached, ranking a
-- stage by its position in the enum. Appended values would rank 6 and 7, so a
-- lost lead would be counted as having reached advocate. Exits are not steps
-- on the path: rank them 0, so a lead that went dormant or lost is still
-- counted at the furthest path stage it reached through its history, and no
-- further.
--
-- Compared as text on purpose: a value added by ALTER TYPE cannot be used as an
-- enum literal in the same transaction that added it.
--
-- dashboard_overview still unnests enum_range for its funnel rows, so it now
-- returns dormant and lost rows with a count of 0. The dashboard reads the five
-- path stages by id and ignores them.
create or replace function public.dashboard_stage_rank(p_stage lead_stage)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_stage::text in ('dormant', 'lost') then 0
    else array_position(enum_range(null::lead_stage), p_stage)
  end;
$$;
