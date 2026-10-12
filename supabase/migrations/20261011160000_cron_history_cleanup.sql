-- pg_cron keeps one row per run in cron.job_run_details and never prunes it. The two
-- 5-minute jobs add about 576 rows a day, so the table grows steadily (about 40 MB a
-- year) against the free plan's 0.5 GB database. Keep one week of history.
-- cron.schedule with an existing job name updates that job, so this is safe to re-run.
select cron.schedule(
  'ffn-cron-history-cleanup',
  '30 3 * * *',
  $job$delete from cron.job_run_details where end_time < now() - interval '7 days'$job$
);
