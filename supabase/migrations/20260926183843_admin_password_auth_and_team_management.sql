-- Admin password auth + team management: adds a super-admin tier on top of
-- the existing role column, and closes a privilege-escalation gap that
-- becomes exploitable once that tier exists (see the guard trigger below).

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- is_super_admin(): same shape as is_admin() (security definer + fixed
-- search_path so it reads profiles regardless of caller's own RLS grants).
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_super_admin = true
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

-- Bootstrap: promote the existing admin test account to admin + super admin.
-- A no-op if no profile exists yet for this email (nothing to promote) —
-- whoever owns it then needs a one-time manual promotion after their first
-- sign-in. Deliberately does not touch auth.users/set a password here: this
-- file is checked into git history, so credential-setting for a real person
-- goes through Supabase's own invite/recovery email flow (admin-users-invite
-- / admin-password-reset edge functions), never a plaintext value in SQL.
update public.profiles
set role = 'admin',
    is_super_admin = true,
    updated_at = now()
where email = 'devidinymisha05@gmail.com';

-- Guard: role and is_super_admin must only change via the service-role
-- admin-users-* edge functions, never a direct client PATCH. Without this,
-- profiles_update_own's "id = auth.uid() or is_admin()" check lets *any*
-- staff/admin update *any* profile's columns — including their own — so a
-- plain staff member could set role='admin', is_super_admin=true on
-- themselves. Runs after the bootstrap UPDATE above so that statement (run
-- as the migration owner, outside any PostgREST request) is unaffected.
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.is_super_admin is distinct from old.is_super_admin)
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'role and is_super_admin can only be changed through admin team management';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privilege_columns on public.profiles;
create trigger guard_profile_privilege_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privilege_columns();
