-- profiles: one row per authenticated user, mirrors auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'founder' check (role in ('founder', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

-- is_admin(): staff-role check every module's RLS depends on.
-- security definer + fixed search_path so it can read profiles regardless of
-- caller's RLS grants, without being hijackable via search_path injection.
create or replace function public.is_admin()
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
      and role in ('staff', 'admin')
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Founders can see/update their own profile; staff/admin can see and manage all.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_admin_delete on public.profiles
  for delete using (is_admin());

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
