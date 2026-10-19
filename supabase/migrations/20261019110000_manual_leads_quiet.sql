-- Manual leads, follow-up to 20261019090000_manual_leads.sql.
--
--   * The system form is shown to the team as "Manual leads" in the filters, the source of a lead
--     the team added by hand. The Forms list and the form pages hide it.
--   * A manual lead is marked as already confirmed, so no confirmation email is ever
--     sent for it. The person did not apply; the team added them. Nothing else sends
--     mail when a lead is created: a lead only emails on a stage change.

update forms
set title = 'Manual leads',
    description = 'Leads the team added by hand. This is a system record and is not shown in the Forms list.'
where slug = 'manual-entry';

create or replace function public.admin_create_manual_lead(p_form_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form_id       uuid;
  v_submission_id uuid;
  v_lead_id       uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the team can add a lead.' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'The lead has no details.' using errcode = '22023';
  end if;

  if p_form_id is null then
    select id into v_form_id from forms where slug = 'manual-entry';
  else
    select id into v_form_id from forms where id = p_form_id;
  end if;
  if v_form_id is null then
    raise exception 'That form does not exist.' using errcode = 'P0001';
  end if;

  -- The unique (form_id, session_id) pair is satisfied by a fresh session id; the
  -- "manual-" prefix marks the row as added by hand. confirmation_email_sent_at is set
  -- so no confirmation email is ever sent for it: the person did not apply, the team
  -- added them. Nothing else sends mail on creation, a lead only emails on a stage change.
  insert into form_submissions (form_id, session_id, data, partial, completed, confirmation_email_sent_at)
  values (v_form_id, 'manual-' || gen_random_uuid()::text, p_data, false, true, now())
  returning id into v_submission_id;

  -- The form_submissions_create_lead trigger has already made the lead.
  select id into v_lead_id from leads where form_submission_id = v_submission_id;
  return v_lead_id;
end;
$$;

revoke all on function public.admin_create_manual_lead(uuid, jsonb) from public, anon;
grant execute on function public.admin_create_manual_lead(uuid, jsonb) to authenticated;
