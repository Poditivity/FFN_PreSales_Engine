-- Lead escalation, daily and weekly digests: the tables, the metric functions,
-- and the schedule that drives them.
--
-- How it runs. Two edge functions do the sending (Google Chat and email):
--   escalation-check   every 5 minutes. Tells the team about leads that have
--                      waited longer than app_settings.escalation_minutes
--                      without a sent hub.
--   digest-dispatch    every 5 minutes. Sends the daily and weekly digests when
--                      their time on the Settings page has passed.
-- pg_cron calls them through pg_net. The only setup the schedule needs is two
-- Vault secrets, created once by hand (they are credentials, so they are not in
-- a migration):
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_functions_url');
--   select vault.create_secret('<service role key>', 'edge_functions_key');
--
-- Until both exist, the schedule does nothing and says so in the Postgres log.

-- Leads already told about, so a lead is escalated once.
create table if not exists lead_escalations (
  lead_id      uuid primary key references leads(id) on delete cascade,
  escalated_at timestamptz not null default now(),
  chat_status  text,
  emails_sent  integer not null default 0
);
alter table lead_escalations enable row level security;
-- No policy: written and read by the service role only.

-- One row per digest period, claimed before sending so two runs cannot both send it.
create table if not exists digest_log (
  kind         text not null check (kind in ('daily', 'weekly')),
  -- The IST date the digest is for: the day itself for daily, the day it was
  -- sent for weekly.
  period_start date not null,
  status       text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  attempts     integer not null default 1,
  chat_status  text,
  emails_sent  integer not null default 0,
  -- The Attention needed counts as they stood, so next week's digest can say
  -- whether each one went up or down.
  attention    jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (kind, period_start)
);
alter table digest_log enable row level security;

drop trigger if exists digest_log_touch on digest_log;
create trigger digest_log_touch before update on digest_log
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Escalation: leads still without a sent hub past the delay.
-- A draft hub does not count: the lead has not received anything yet. Only the
-- open path stages are escalated; customers, advocates and exits are not waiting
-- on a proof page.
-- ---------------------------------------------------------------------------
create or replace function public.escalation_candidates(
  p_minutes integer,
  p_since   timestamptz,
  p_limit   integer default 50
)
returns table (lead_id uuid, stage text, created_at timestamptz, form_submission_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.stage::text, l.created_at, l.form_submission_id
  from leads l
  where l.stage::text in ('lead', 'mql', 'sql')
    and l.created_at <= now() - make_interval(mins => p_minutes)
    and (p_since is null or l.created_at >= p_since)
    and not exists (select 1 from lead_escalations e where e.lead_id = l.id)
    and not exists (select 1 from hubs h where h.lead_id = l.id and h.status in ('sent', 'opened'))
  order by l.created_at
  limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- Digest numbers for one window [p_from, p_to). Counts only; names are never
-- needed. security definer because the edge function runs as the service role,
-- which has no signed-in admin for is_admin() to find.
-- ---------------------------------------------------------------------------
create or replace function public.digest_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'leads', (
      select count(*) from leads where created_at >= p_from and created_at < p_to),

    -- Leads that moved into each stage in the window. from_stage is null only
    -- for the row written when a lead is created, which is "received", not a move.
    'stages', (
      select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
      from (
        select to_stage::text as stage, count(distinct lead_id) as n
        from lead_stage_history
        where from_stage is not null and changed_at >= p_from and changed_at < p_to
        group by 1) s),

    'hubs_sent', (
      select count(*) from hubs where sent_at >= p_from and sent_at < p_to),
    -- Of the hubs sent in the window, how many have been opened since.
    'hubs_opened', (
      select count(*) from hubs
      where sent_at >= p_from and sent_at < p_to and first_opened_at is not null),

    'calls', (
      select coalesce(jsonb_object_agg(outcome, n), '{}'::jsonb)
      from (
        select outcome, count(*) as n
        from lead_calls
        where called_at >= p_from and called_at < p_to
        group by 1) c)
  );
$$;

-- What needs the team's attention right now. The same six signals, with the same
-- thresholds, as dashboard_attention (14 days stuck, 48 hours warm), as counts.
create or replace function public.digest_attention()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'unreviewed', (
      select count(*) from form_submissions where completed and rating is null),
    'no_hub', (
      select count(*) from leads l
      where l.stage::text in ('mql', 'sql')
        and not exists (select 1 from hubs h where h.lead_id = l.id)),
    'draft_hubs', (
      select count(*) from hubs where status = 'draft'),
    'warm_hubs', (
      select count(*) from hubs where last_opened_at >= now() - interval '48 hours'),
    'stuck', (
      select count(*) from leads l
      where l.stage::text in ('lead', 'mql', 'sql')
        and coalesce((select max(h.changed_at) from lead_stage_history h where h.lead_id = l.id), l.created_at)
            < now() - interval '14 days'),
    'failed_emails', (
      select count(*) from lead_email_messages
      where status = 'failed' and created_at >= now() - interval '30 days')
  );
$$;

revoke all on function public.escalation_candidates(integer, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.digest_metrics(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.digest_attention() from public, anon, authenticated;
grant execute on function public.escalation_candidates(integer, timestamptz, integer) to service_role;
grant execute on function public.digest_metrics(timestamptz, timestamptz) to service_role;
grant execute on function public.digest_attention() to service_role;

-- ---------------------------------------------------------------------------
-- The schedule.
-- ---------------------------------------------------------------------------
create or replace function public.invoke_edge_function(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_functions_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'edge_functions_key';
  if v_url is null or v_key is null then
    raise notice 'invoke_edge_function(%): create the edge_functions_url and edge_functions_key Vault secrets first', p_name;
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.invoke_edge_function(text) from public, anon, authenticated;

-- pg_cron and pg_net ship with Supabase but must be enabled. If either cannot be
-- enabled here, say so rather than failing the whole migration; the two jobs can
-- be added later from the dashboard.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;

  perform cron.schedule('ffn-escalation-check', '*/5 * * * *', $job$select public.invoke_edge_function('escalation-check')$job$);
  perform cron.schedule('ffn-digest-dispatch', '*/5 * * * *', $job$select public.invoke_edge_function('digest-dispatch')$job$);
exception when others then
  raise notice 'Could not schedule escalation-check and digest-dispatch (%). Enable pg_cron and pg_net, then schedule both by hand.', sqlerrm;
end;
$$;
