-- A form that has received applications cannot be deleted. Submissions, and the
-- leads built from them, cascade from the form, so a delete would wipe real
-- applicants. Close the form instead. Forms with no submissions (drafts, tests)
-- can still be deleted. The guard lives here so it holds whatever client asks.

create or replace function forms_block_delete_with_submissions()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from form_submissions where form_id = old.id) then
    raise exception 'This form has submissions and cannot be deleted. Close it instead.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists forms_block_delete_with_submissions on forms;
create trigger forms_block_delete_with_submissions
  before delete on forms
  for each row execute function forms_block_delete_with_submissions();
