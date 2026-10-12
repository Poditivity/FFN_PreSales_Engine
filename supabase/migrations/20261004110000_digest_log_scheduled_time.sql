-- A digest was sent once per IST day, whatever time was set on the Settings page.
-- Moving the time later after a send (to test it, or because the team changed
-- their mind) therefore did nothing: the day was already logged as sent.
--
-- The log now records the time each digest went out for, and digest-dispatch sends
-- a day's digest again when the time on Settings is moved later than that and has
-- passed. Moving it earlier, or leaving it, never resends.

alter table public.digest_log add column if not exists scheduled_time text;

-- Rows from before this migration: the time they were actually sent, in IST.
update public.digest_log
set scheduled_time = to_char(created_at at time zone 'Asia/Kolkata', 'HH24:MI')
where scheduled_time is null;
