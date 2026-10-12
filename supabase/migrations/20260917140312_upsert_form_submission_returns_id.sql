drop function if exists upsert_form_submission(text, uuid, jsonb, jsonb, jsonb, integer, boolean, boolean);

create or replace function upsert_form_submission(
  p_session_id           text,
  p_form_id              uuid,
  p_data                 jsonb    default '{}'::jsonb,
  p_field_timings        jsonb    default '{}'::jsonb,
  p_keystroke_counts     jsonb    default '{}'::jsonb,
  p_time_on_form_seconds integer  default null,
  p_partial              boolean  default true,
  p_completed            boolean  default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from forms where id = p_form_id and status = 'active'
  ) then
    raise exception 'Form % is not accepting submissions', p_form_id
      using errcode = 'P0001';
  end if;

  insert into form_submissions (
    form_id, session_id, data, field_timings, keystroke_counts,
    time_on_form_seconds, partial, completed
  )
  values (
    p_form_id, p_session_id, p_data, p_field_timings, p_keystroke_counts,
    p_time_on_form_seconds, p_partial, p_completed
  )
  on conflict (form_id, session_id) do update set
    data                 = excluded.data,
    field_timings        = excluded.field_timings,
    keystroke_counts     = excluded.keystroke_counts,
    time_on_form_seconds = excluded.time_on_form_seconds,
    partial              = excluded.partial,
    completed            = excluded.completed,
    updated_at           = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function upsert_form_submission from public;
grant  execute on function upsert_form_submission to anon, authenticated;
