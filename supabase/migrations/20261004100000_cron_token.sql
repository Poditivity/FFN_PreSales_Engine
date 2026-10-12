-- The scheduled functions (escalation-check, digest-dispatch) used to accept a
-- call only when its bearer token was exactly the function's own service role
-- key. A key copied into Vault does not always match what the function sees, and
-- every scheduled call was refused with 401, so no escalation or summary ever
-- went out. The database now proves a call is its own with a random token it
-- keeps in Vault, and the functions check it through cron_token_ok().

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'edge_functions_cron_token') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'edge_functions_cron_token',
      'Proves a scheduled call to an edge function came from this database'
    );
  end if;
end;
$$;

create or replace function public.cron_token_ok(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_token is null or length(p_token) < 32 then
    return false;
  end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'edge_functions_cron_token';
  return v_token is not null and v_token = p_token;
end;
$$;

revoke all on function public.cron_token_ok(text) from public, anon, authenticated;
grant execute on function public.cron_token_ok(text) to service_role;

create or replace function public.invoke_edge_function(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_token text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_functions_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'edge_functions_key';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'edge_functions_cron_token';
  if v_url is null or v_key is null then
    raise notice 'invoke_edge_function(%): create the edge_functions_url and edge_functions_key Vault secrets first', p_name;
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'x-cron-token', coalesce(v_token, '')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.invoke_edge_function(text) from public, anon, authenticated;
