-- Admin dashboard metrics. Four read-only functions the /admin dashboard
-- calls over RPC, so every count is computed next to the data instead of
-- shipping hundreds of rows to the browser:
--
--   dashboard_overview(from, to, tz)  headline numbers (+ the previous
--                                     period of the same length), pipeline
--                                     funnel, trend series, hub engagement,
--                                     per-form health and traffic sources
--   dashboard_attention(...)          current to-do signals (not period bound)
--   dashboard_live(window)            hubs being read right now
--   dashboard_activity(limit)         newest touches across the pipeline
--
-- All four are SECURITY INVOKER, so the existing admin-only RLS on every
-- table they read still applies; the explicit is_admin() guard just turns
-- "you would see nothing" into a clear error. Names are deliberately not
-- resolved here: a lead's name lives inside its submission's JSON answers
-- and is resolved in TypeScript (src/lib/forms/insights.ts), the one place
-- that rule is defined.

-- Position of a stage on the ordered FFN path (lead = 1 ... advocate = 5).
create or replace function public.dashboard_stage_rank(p_stage lead_stage)
returns integer
language sql
stable
set search_path = public
as $$
  select array_position(enum_range(null::lead_stage), p_stage);
$$;

-- Headline counts for one window. Used twice by dashboard_overview: once for
-- the selected period, once for the equal-length period before it.
create or replace function public.dashboard_kpis(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'applications', (
      select count(*) from form_submissions
      where completed and created_at >= p_from and created_at < p_to),
    'form_starts', (
      select count(distinct session_id) from analytics_events
      where event_type = 'form_start' and created_at >= p_from and created_at < p_to),
    'form_completes', (
      select count(distinct session_id) from analytics_events
      where event_type = 'form_complete' and created_at >= p_from and created_at < p_to),
    -- hubs carry no sent_at, so the cohort is hubs created in the window:
    -- of those that went out, how many were opened.
    'hubs_sent', (
      select count(*) from hubs
      where status in ('sent', 'opened') and created_at >= p_from and created_at < p_to),
    'hubs_opened', (
      select count(*) from hubs
      where status = 'opened' and created_at >= p_from and created_at < p_to),
    'new_customers', (
      select count(distinct lead_id) from lead_stage_history
      where to_stage = 'customer' and changed_at >= p_from and changed_at < p_to),
    -- from_stage is null only for the row written when a lead is created.
    'stage_moves', (
      select count(*) from lead_stage_history
      where from_stage is not null and changed_at >= p_from and changed_at < p_to)
  );
$$;

create or replace function public.dashboard_overview(
  p_from timestamptz default null,
  p_to   timestamptz default null,
  p_tz   text        default 'UTC'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_to        timestamptz := coalesce(p_to, now());
  v_all_time  boolean     := p_from is null;
  v_from      timestamptz;
  v_prev_from timestamptz;
  v_bucket    text;
  v_tz        text := 'UTC';
  v_result    jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if exists (select 1 from pg_timezone_names where name = p_tz) then
    v_tz := p_tz;
  end if;

  v_from := coalesce(
    p_from,
    least((select min(created_at) from form_submissions), (select min(created_at) from analytics_events)),
    v_to - interval '30 days'
  );
  v_prev_from := v_from - (v_to - v_from);
  v_bucket := case when v_to - v_from <= interval '45 days' then 'day' else 'week' end;

  select jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to, 'bucket', v_bucket, 'all_time', v_all_time, 'tz', v_tz),

    'kpis', dashboard_kpis(v_from, v_to),
    'kpis_previous', case when v_all_time then null else dashboard_kpis(v_prev_from, v_from) end,

    -- Leads created in the window, counted at every stage they have ever
    -- reached (current stage or any stage in their history), so the funnel
    -- only ever narrows even though stages can be set in any order.
    'funnel', (
      with cohort as (
        select l.id, dashboard_stage_rank(l.stage) as cur
        from leads l
        where l.created_at >= v_from and l.created_at < v_to
      ),
      reached as (
        select c.id, greatest(c.cur, coalesce(max(dashboard_stage_rank(h.to_stage)), 0)) as r
        from cohort c
        left join lead_stage_history h on h.lead_id = c.id
        group by c.id, c.cur
      )
      select coalesce(jsonb_agg(
        jsonb_build_object('stage', s.stage, 'count', (select count(*) from reached where r >= s.rank))
        order by s.rank), '[]'::jsonb)
      from unnest(enum_range(null::lead_stage)) with ordinality as s(stage, rank)
    ),

    'stages_now', (
      select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
      from (select stage::text as stage, count(*) as n from leads group by stage) s
    ),

    'median_days_to_customer', (
      select round(percentile_cont(0.5) within group (
               order by extract(epoch from (h.first_customer - l.created_at)) / 86400)::numeric, 1)
      from (
        select lead_id, min(changed_at) as first_customer
        from lead_stage_history where to_stage = 'customer' group by lead_id
      ) h
      join leads l on l.id = h.lead_id
      where h.first_customer >= v_from and h.first_customer < v_to
    ),

    'trend', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'bucket', to_char(b.bk, 'YYYY-MM-DD'),
          'starts', coalesce(s.n, 0),
          'applications', coalesce(a.n, 0),
          'hub_opens', coalesce(h.n, 0))
        order by b.bk), '[]'::jsonb)
      from generate_series(
             date_trunc(v_bucket, v_from at time zone v_tz),
             date_trunc(v_bucket, v_to at time zone v_tz),
             ('1 ' || v_bucket)::interval) as b(bk)
      left join (
        select date_trunc(v_bucket, created_at at time zone v_tz) as bk, count(distinct session_id) as n
        from analytics_events
        where event_type = 'form_start' and created_at >= v_from and created_at < v_to
        group by 1) s using (bk)
      left join (
        select date_trunc(v_bucket, created_at at time zone v_tz) as bk, count(*) as n
        from form_submissions
        where completed and created_at >= v_from and created_at < v_to
        group by 1) a using (bk)
      left join (
        select date_trunc(v_bucket, created_at at time zone v_tz) as bk, count(*) as n
        from hub_events
        where type = 'hub_view' and created_at >= v_from and created_at < v_to
        group by 1) h using (bk)
    ),

    -- One heartbeat is 15 seconds of a section holding the viewport, the
    -- same constant as HEARTBEAT_SECONDS in src/lib/hubs/engagement.ts.
    'hub', jsonb_build_object(
      'views', (
        select count(*) from hub_events
        where type = 'hub_view' and created_at >= v_from and created_at < v_to),
      'hubs_viewed', (
        select count(distinct hub_id) from hub_events
        where type = 'hub_view' and created_at >= v_from and created_at < v_to),
      'engaged_seconds', (
        select count(*) * 15 from hub_events
        where type = 'heartbeat' and created_at >= v_from and created_at < v_to),
      'sections', (
        select coalesce(jsonb_agg(jsonb_build_object('section', target_id, 'seconds', n * 15) order by n desc, target_id), '[]'::jsonb)
        from (
          select target_id, count(*) as n from hub_events
          where type = 'heartbeat' and target_id is not null and created_at >= v_from and created_at < v_to
          group by target_id order by count(*) desc, target_id limit 8) x),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object('target_type', target_type, 'target_id', target_id, 'count', n) order by n desc, target_id), '[]'::jsonb)
        from (
          select target_type, target_id, count(*) as n from hub_events
          where type = 'view' and target_id is not null and created_at >= v_from and created_at < v_to
          group by target_type, target_id order by count(*) desc, target_id limit 8) x),
      'clicks', (
        select coalesce(jsonb_agg(jsonb_build_object('type', type, 'target_id', target_id, 'count', n) order by n desc, target_id), '[]'::jsonb)
        from (
          select type, target_id, count(*) as n from hub_events
          where type in ('cta_click', 'call_click') and target_id is not null and created_at >= v_from and created_at < v_to
          group by type, target_id order by count(*) desc, target_id limit 6) x)
    ),

    'forms', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.applications desc, x.title), '[]'::jsonb)
      from (
        select
          f.id, f.title, f.slug, f.status,
          (select count(distinct e.session_id) from analytics_events e
            where e.form_id = f.id and e.event_type = 'form_start' and e.created_at >= v_from and e.created_at < v_to) as starts,
          (select count(distinct e.session_id) from analytics_events e
            where e.form_id = f.id and e.event_type = 'form_complete' and e.created_at >= v_from and e.created_at < v_to) as completes,
          (select count(distinct e.session_id) from analytics_events e
            where e.form_id = f.id and e.event_type = 'form_drop' and e.created_at >= v_from and e.created_at < v_to) as drops,
          (select count(*) from form_submissions s
            where s.form_id = f.id and s.completed and s.created_at >= v_from and s.created_at < v_to) as applications,
          (select round(percentile_cont(0.5) within group (order by s.time_on_form_seconds)::numeric)
            from form_submissions s
            where s.form_id = f.id and s.completed and s.time_on_form_seconds is not null
              and s.created_at >= v_from and s.created_at < v_to) as median_seconds,
          (select e.metadata->>'last_field_label' from analytics_events e
            where e.form_id = f.id and e.event_type = 'form_drop'
              and coalesce(e.metadata->>'last_field_label', '') <> ''
              and e.created_at >= v_from and e.created_at < v_to
            group by 1 order by count(*) desc, 1 limit 1) as top_drop_field
        from forms f
      ) x
    ),

    -- Where finished applications came from: the UTM source, else the
    -- referring host, else "direct".
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', src, 'count', n) order by n desc, src), '[]'::jsonb)
      from (
        select coalesce(
                 nullif(lower(utm_source), ''),
                 nullif(substring(referrer from '^https?://(?:www\.)?([^/:?#]+)'), ''),
                 'direct') as src,
               count(distinct session_id) as n
        from analytics_events
        where event_type = 'form_complete' and created_at >= v_from and created_at < v_to
        group by 1 order by 2 desc, 1 limit 8) x
    ),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object('campaign', camp, 'count', n) order by n desc, camp), '[]'::jsonb)
      from (
        select utm_campaign as camp, count(distinct session_id) as n
        from analytics_events
        where event_type = 'form_complete' and coalesce(utm_campaign, '') <> ''
          and created_at >= v_from and created_at < v_to
        group by 1 order by 2 desc, 1 limit 6) x
    )
  ) into v_result;

  return v_result;
end;
$$;

-- What the team should act on now. Each signal returns its total and the
-- first five rows to act on.
create or replace function public.dashboard_attention(
  p_stuck_days integer default 14,
  p_warm_hours integer default 48
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  with last_move as (
    select l.id, l.stage,
           coalesce((select max(h.changed_at) from lead_stage_history h where h.lead_id = l.id), l.created_at) as since
    from leads l
    where l.stage in ('lead', 'mql', 'sql')
  ),
  stuck as (
    select * from last_move where since < now() - make_interval(days => p_stuck_days)
  ),
  no_hub as (
    select l.id, l.stage, l.updated_at
    from leads l
    where l.stage in ('mql', 'sql')
      and not exists (select 1 from hubs h where h.lead_id = l.id)
  ),
  unreviewed as (
    select s.id, s.form_id, s.created_at
    from form_submissions s
    where s.completed and s.rating is null
  ),
  failed as (
    select m.id, t.lead_id, m.subject, m.error, m.created_at
    from lead_email_messages m
    join lead_email_threads t on t.id = m.thread_id
    where m.status = 'failed' and m.created_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'unreviewed', jsonb_build_object(
      'count', (select count(*) from unreviewed),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'submission_id', u.id, 'form_id', u.form_id, 'lead_id', l.id, 'at', u.created_at)
               order by u.created_at desc), '[]'::jsonb)
        from (select * from unreviewed order by created_at desc limit 5) u
        left join leads l on l.form_submission_id = u.id)),
    'no_hub', jsonb_build_object(
      'count', (select count(*) from no_hub),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object('lead_id', n.id, 'stage', n.stage, 'at', n.updated_at)
               order by n.updated_at), '[]'::jsonb)
        from (select * from no_hub order by updated_at limit 5) n)),
    'draft_hubs', jsonb_build_object(
      'count', (select count(*) from hubs where status = 'draft'),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'hub_id', h.id, 'lead_id', h.lead_id, 'applicant_name', h.applicant_name, 'at', h.created_at)
               order by h.created_at desc), '[]'::jsonb)
        from (select * from hubs where status = 'draft' order by created_at desc limit 5) h)),
    'warm_hubs', jsonb_build_object(
      'count', (select count(*) from hubs where last_opened_at >= now() - make_interval(hours => p_warm_hours)),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'hub_id', h.id, 'lead_id', h.lead_id, 'applicant_name', h.applicant_name,
                 'open_count', h.open_count, 'at', h.last_opened_at)
               order by h.last_opened_at desc), '[]'::jsonb)
        from (select * from hubs where last_opened_at >= now() - make_interval(hours => p_warm_hours)
              order by last_opened_at desc limit 5) h)),
    'stuck', jsonb_build_object(
      'count', (select count(*) from stuck),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object('lead_id', s.id, 'stage', s.stage, 'at', s.since)
               order by s.since), '[]'::jsonb)
        from (select * from stuck order by since limit 5) s)),
    'failed_emails', jsonb_build_object(
      'count', (select count(*) from failed),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'message_id', f.id, 'lead_id', f.lead_id, 'subject', f.subject, 'error', f.error, 'at', f.created_at)
               order by f.created_at desc), '[]'::jsonb)
        from (select * from failed order by created_at desc limit 5) f))
  ) into v_result;

  return v_result;
end;
$$;

-- Hubs with any tracked activity inside the window. The public hub page
-- sends a heartbeat every 15 seconds while a section holds the viewport, so
-- a 90 second window means "reading right now".
create or replace function public.dashboard_live(p_window_seconds integer default 90)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen desc), '[]'::jsonb)
  into v_result
  from (
    select
      e.hub_id,
      h.lead_id,
      h.applicant_name,
      max(e.created_at) as last_seen,
      count(distinct e.session_id) as sessions,
      (select e2.target_id from hub_events e2
        where e2.hub_id = e.hub_id and e2.type in ('heartbeat', 'section_view') and e2.target_id is not null
        order by e2.created_at desc limit 1) as section,
      (select count(*) * 15 from hub_events e3
        where e3.hub_id = e.hub_id and e3.type = 'heartbeat' and e3.created_at >= now() - interval '30 minutes') as engaged_seconds
    from hub_events e
    join hubs h on h.id = e.hub_id
    where e.created_at >= now() - make_interval(secs => p_window_seconds)
    group by e.hub_id, h.lead_id, h.applicant_name
  ) x;

  return v_result;
end;
$$;

-- Newest touches across the pipeline, machine and human events in one
-- stream (see the design system's ActivityTimeline rules).
create or replace function public.dashboard_activity(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.at desc), '[]'::jsonb)
  into v_result
  from (
    select * from (
      (select 'application'::text as kind, s.created_at as at, l.id as lead_id, null::uuid as hub_id,
              f.title as detail, null::text as from_stage, null::text as to_stage, null::text as extra, null::text as actor
         from form_submissions s
         join forms f on f.id = s.form_id
         left join leads l on l.form_submission_id = s.id
        where s.completed
        order by s.created_at desc limit v_limit)
      union all
      (select 'stage', h.changed_at, h.lead_id, null, null, h.from_stage::text, h.to_stage::text, null,
              coalesce(p.full_name, p.email)
         from lead_stage_history h
         left join profiles p on p.id = h.changed_by
        where h.from_stage is not null
        order by h.changed_at desc limit v_limit)
      union all
      (select 'hub_created', hb.created_at, hb.lead_id, hb.id, hb.applicant_name, null, null, null,
              coalesce(p.full_name, p.email)
         from hubs hb
         left join profiles p on p.id = hb.created_by
        order by hb.created_at desc limit v_limit)
      union all
      (select 'hub_opened', hb.first_opened_at, hb.lead_id, hb.id, hb.applicant_name, null, null, null, null
         from hubs hb
        where hb.first_opened_at is not null
        order by hb.first_opened_at desc limit v_limit)
      union all
      (select case when m.status = 'failed' then 'email_failed' else 'email_sent' end,
              coalesce(m.sent_at, m.created_at), t.lead_id, null, m.subject, null, null, m.trigger,
              coalesce(p.full_name, p.email)
         from lead_email_messages m
         join lead_email_threads t on t.id = m.thread_id
         left join profiles p on p.id = m.sent_by
        where m.status in ('sent', 'failed')
        order by coalesce(m.sent_at, m.created_at) desc limit v_limit)
    ) u
    order by u.at desc
    limit v_limit
  ) a;

  return v_result;
end;
$$;

revoke all on function public.dashboard_stage_rank(lead_stage) from public, anon;
revoke all on function public.dashboard_kpis(timestamptz, timestamptz) from public, anon;
revoke all on function public.dashboard_overview(timestamptz, timestamptz, text) from public, anon;
revoke all on function public.dashboard_attention(integer, integer) from public, anon;
revoke all on function public.dashboard_live(integer) from public, anon;
revoke all on function public.dashboard_activity(integer) from public, anon;

grant execute on function public.dashboard_stage_rank(lead_stage) to authenticated;
grant execute on function public.dashboard_kpis(timestamptz, timestamptz) to authenticated;
grant execute on function public.dashboard_overview(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.dashboard_attention(integer, integer) to authenticated;
grant execute on function public.dashboard_live(integer) to authenticated;
grant execute on function public.dashboard_activity(integer) to authenticated;
