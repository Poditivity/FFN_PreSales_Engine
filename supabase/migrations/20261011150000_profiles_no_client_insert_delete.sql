-- Closes a privilege escalation: a signed-in team member could delete their own
-- profile row (profiles_admin_delete) and insert it back (profiles_insert_own) with
-- role = 'admin' and is_super_admin = true, because the privilege guard trigger only
-- covers UPDATE. Profiles are created by the handle_new_user trigger and the
-- admin-users-* functions (service role, which bypasses RLS) and deleted only through
-- auth.admin.deleteUser (cascade). The browser never needed either policy.
--
-- The two policies are kept but made deny-all (rather than dropped) and the table
-- privileges are revoked, so the rule holds even if a policy is later re-created.
alter policy profiles_insert_own on public.profiles with check (false);
alter policy profiles_admin_delete on public.profiles using (false);
revoke insert, delete, truncate on public.profiles from anon, authenticated;
revoke update, select, references, trigger on public.profiles from anon;
