-- storage_usage(): how much of the Supabase project the app is using, for the
-- admin Settings page. Database size comes from pg_database_size; file storage
-- is the sum of object sizes in the storage schema. security definer so an
-- admin can read storage.objects without a direct grant; the is_admin() check
-- inside keeps every other caller out.
create or replace function public.storage_usage()
returns table (database_bytes bigint, storage_bytes bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
    select
      pg_database_size(current_database())::bigint,
      coalesce(
        (select sum((metadata ->> 'size')::bigint) from storage.objects),
        0
      )::bigint;
end;
$$;

revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;
