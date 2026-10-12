-- Storage warnings for the super admins. The storage-alerts edge function runs
-- once a day and emails them while the database is over 0.4 GB or the R2 bucket is
-- over 9 GB, one email a day for three days, then stops until usage has dropped
-- back under the line and climbed over it again.
--
--   storage_alert_state   one row per measure: how many warnings this climb has
--                         had, and the IST date of the last. Service role only.
--   database_size_bytes() the database size for that function. storage_usage()
--                         needs a signed-in admin, which a scheduled job is not.

create table if not exists storage_alert_state (
  kind         text primary key check (kind in ('database', 'r2')),
  days_sent    smallint not null default 0,
  last_sent_on date,
  updated_at   timestamptz not null default now()
);

alter table storage_alert_state enable row level security;
-- No policies: only the service role, which bypasses RLS, reads or writes it.

insert into storage_alert_state (kind) values ('database'), ('r2') on conflict (kind) do nothing;

create or replace function public.database_size_bytes()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select pg_database_size(current_database())::bigint;
$$;

revoke all on function public.database_size_bytes() from public, anon, authenticated;
grant execute on function public.database_size_bytes() to service_role;

-- Daily at 04:00 UTC (09:30 IST). Same approach as the other scheduled functions:
-- if pg_cron or pg_net cannot be used here, say so and let it be scheduled by hand.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;
  perform cron.schedule('ffn-storage-alerts', '0 4 * * *', $job$select public.invoke_edge_function('storage-alerts')$job$);
exception when others then
  raise notice 'Could not schedule storage-alerts (%). Enable pg_cron and pg_net, then schedule it by hand.', sqlerrm;
end;
$$;
