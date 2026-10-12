-- Per-admin choice of whether to receive new-submission notifications.
--
-- Until now every profile with role = admin (super admins included) was
-- notified of every new submission. This adds a switch a super admin sets
-- for each team member on the Team page. It defaults to true, so nobody
-- stops receiving anything when this migration runs.
alter table public.profiles
  add column if not exists receive_notifications boolean not null default true;

-- The switch is a team-management decision, not a personal setting, so it
-- follows the same rule as role and is_super_admin: it only changes through
-- the service-role admin-users-update function, never a direct client PATCH.
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.is_super_admin is distinct from old.is_super_admin
      or new.receive_notifications is distinct from old.receive_notifications)
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'role, is_super_admin and receive_notifications can only be changed through admin team management';
  end if;
  return new;
end;
$$;
