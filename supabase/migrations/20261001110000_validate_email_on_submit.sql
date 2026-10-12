-- Reject a finished submission whose email answer is not an email address.
--
-- The public form already checks this in the browser, but the browser is not the
-- only way to call upsert_form_submission, so the same rule is enforced here.
-- It applies only when the submission is being completed: a half-typed address
-- in an autosaved draft is normal and must still save.
--
-- The rule matches isEmailField and isValidEmail in src/lib/forms/formLogic.ts:
-- a question typed as email, or a text or long text question whose label says
-- "email" or "e-mail"; one @, no spaces, no leading, trailing or doubled dots,
-- and a top-level domain of at least two letters. Keep the two in step.

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
  v_id     uuid;
  v_schema jsonb;
  v_field  jsonb;
  v_answer text;
begin
  select schema into v_schema from forms where id = p_form_id and status = 'active';
  if not found then
    raise exception 'Form % is not accepting submissions', p_form_id
      using errcode = 'P0001';
  end if;

  if p_completed then
    -- Graph schema: question nodes carry their field in data.field. Older flat
    -- schema: the array is the list of fields.
    for v_field in
      select coalesce(n -> 'data' -> 'field', n)
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_schema) = 'array' then v_schema
          when jsonb_typeof(v_schema -> 'nodes') = 'array' then v_schema -> 'nodes'
          else '[]'::jsonb
        end
      ) as n
    loop
      if (v_field ->> 'type') = 'email'
         or ((v_field ->> 'type') in ('text', 'textarea') and (v_field ->> 'label') ~* '\ye-?mail\y') then
        v_answer := nullif(btrim(p_data ->> (v_field ->> 'id')), '');
        if v_answer is not null
           and v_answer !~ '^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$' then
          raise exception 'Enter a valid email address'
            using errcode = '22023';
        end if;
      end if;
    end loop;
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
