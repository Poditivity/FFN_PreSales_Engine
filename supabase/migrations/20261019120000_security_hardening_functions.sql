-- Security hardening for database functions, from the Supabase security advisor.
--
-- Trigger functions are only ever run by their triggers. Nobody needs to call them over
-- the API (Postgres checks EXECUTE when a trigger is created, not when it fires), so they
-- are not callable by anyone.
revoke execute on function public.create_lead_on_submission_complete() from public, anon, authenticated;
revoke execute on function public.dispatch_stage_email_rule() from public, anon, authenticated;
revoke execute on function public.guard_profile_privilege_columns() from public, anon, authenticated;
revoke execute on function public.log_lead_stage_change() from public, anon, authenticated;

-- Pin the schema these functions resolve names in.
alter function public.forms_block_delete_with_submissions() set search_path = public;
alter function public.hub_templates_keep_following_hubs() set search_path = public;
alter function public.link_co_founders(uuid, uuid) set search_path = public;
alter function public.unlink_co_founders(uuid, uuid) set search_path = public;
