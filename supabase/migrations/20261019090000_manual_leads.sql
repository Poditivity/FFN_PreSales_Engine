-- Manual leads: the team adds a lead by hand from the Leads page.
--
-- A lead is always built from a completed form submission (leads.form_submission_id
-- is not null and every reader joins through it), so a manual lead is stored as a
-- completed submission and the existing trigger creates the lead from it. Nothing
-- about the leads table changes.
--
--   * With a form chosen, the team fills that form's questions and the submission
--     goes onto that form, whatever its status.
--   * With no form chosen, the submission goes onto a "Manual entry" form that
--     holds a name, an email, a phone number and a note. That form is closed, so
--     the public cannot see or submit it.
--
-- Additive only: one new row in forms, one new function. No existing row or
-- function is changed.

insert into forms (title, slug, status, description, thank_you_message, schema)
values (
  'Manual entry',
  'manual-entry',
  'closed',
  'Leads added by hand from the Leads page when no form applies.',
  'Thank you.',
  jsonb_build_object(
    'version', 2,
    'startNodeId', 'start',
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'start', 'type', 'start', 'position', jsonb_build_object('x', 80, 'y', 40), 'data', '{}'::jsonb, 'deletable', false),
      jsonb_build_object('id', 'manual_name', 'type', 'question', 'position', jsonb_build_object('x', 80, 'y', 160), 'data', jsonb_build_object('field', jsonb_build_object(
        'id', 'manual_name', 'type', 'name', 'label', 'Full name', 'placeholder', '', 'required', true, 'helpText', '', 'width', 'full', 'validation', '{}'::jsonb, 'showIf', null))),
      jsonb_build_object('id', 'manual_email', 'type', 'question', 'position', jsonb_build_object('x', 80, 'y', 310), 'data', jsonb_build_object('field', jsonb_build_object(
        'id', 'manual_email', 'type', 'email', 'label', 'Email', 'placeholder', '', 'required', true, 'helpText', '', 'width', 'full', 'validation', '{}'::jsonb, 'showIf', null))),
      jsonb_build_object('id', 'manual_phone', 'type', 'question', 'position', jsonb_build_object('x', 80, 'y', 460), 'data', jsonb_build_object('field', jsonb_build_object(
        'id', 'manual_phone', 'type', 'phone', 'label', 'Phone', 'placeholder', '', 'required', false, 'helpText', '', 'width', 'full', 'validation', '{}'::jsonb, 'showIf', null))),
      jsonb_build_object('id', 'manual_notes', 'type', 'question', 'position', jsonb_build_object('x', 80, 'y', 610), 'data', jsonb_build_object('field', jsonb_build_object(
        'id', 'manual_notes', 'type', 'textarea', 'label', 'Notes', 'placeholder', '', 'required', false, 'helpText', '', 'width', 'full', 'validation', '{}'::jsonb, 'showIf', null))),
      jsonb_build_object('id', 'manual_end', 'type', 'end', 'position', jsonb_build_object('x', 80, 'y', 760), 'data', jsonb_build_object('label', 'Finish', 'message', '', 'redirect_url', ''))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_manual_1', 'source', 'start', 'target', 'manual_name', 'type', 'flow', 'data', jsonb_build_object('kind', 'always')),
      jsonb_build_object('id', 'e_manual_2', 'source', 'manual_name', 'target', 'manual_email', 'type', 'flow', 'data', jsonb_build_object('kind', 'always')),
      jsonb_build_object('id', 'e_manual_3', 'source', 'manual_email', 'target', 'manual_phone', 'type', 'flow', 'data', jsonb_build_object('kind', 'always')),
      jsonb_build_object('id', 'e_manual_4', 'source', 'manual_phone', 'target', 'manual_notes', 'type', 'flow', 'data', jsonb_build_object('kind', 'always')),
      jsonb_build_object('id', 'e_manual_5', 'source', 'manual_notes', 'target', 'manual_end', 'type', 'flow', 'data', jsonb_build_object('kind', 'always'))
    )
  )
)
on conflict (slug) do nothing;

-- Adds a lead by hand. Returns the new lead's id. Staff and admins only.
-- p_form_id null means the "Manual entry" form.
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
  -- "manual-" prefix marks the row as added by hand.
  insert into form_submissions (form_id, session_id, data, partial, completed)
  values (v_form_id, 'manual-' || gen_random_uuid()::text, p_data, false, true)
  returning id into v_submission_id;

  -- The form_submissions_create_lead trigger has already made the lead.
  select id into v_lead_id from leads where form_submission_id = v_submission_id;
  return v_lead_id;
end;
$$;

revoke all on function public.admin_create_manual_lead(uuid, jsonb) from public, anon;
grant execute on function public.admin_create_manual_lead(uuid, jsonb) to authenticated;
