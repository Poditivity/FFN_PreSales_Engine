-- Nurture: a third stage off the path, beside dormant and lost.
--
-- A nurture lead is not ready yet and is kept warm with regular follow-ups.
-- Like the two exits, it is not a step on the path, so it never shows in the
-- funnel. leads, lead_stage_history, lead_calls and stage_email_rules already
-- store lead_stage, and log_lead_stage_change already writes a history row for
-- any change, so a move into nurture is logged like any other.
alter type lead_stage add value if not exists 'nurture';

-- The dashboard funnel counts a lead at every stage it has reached, ranking a
-- stage by its position in the enum. A value added by ALTER TYPE is appended,
-- so nurture would rank above advocate and a nurture lead would be counted as
-- having reached it. Rank it 0 with dormant and lost: a lead that moves into
-- nurture is still counted at the furthest path stage it reached through its
-- history, and no further.
--
-- Compared as text on purpose: a value added by ALTER TYPE cannot be used as an
-- enum literal in the same transaction that added it.
create or replace function public.dashboard_stage_rank(p_stage lead_stage)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_stage::text in ('nurture', 'dormant', 'lost') then 0
    else array_position(enum_range(null::lead_stage), p_stage)
  end;
$$;
