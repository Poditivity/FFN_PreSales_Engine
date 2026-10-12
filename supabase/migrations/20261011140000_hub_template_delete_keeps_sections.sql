-- A hub with no module list of its own follows its template (hubs.modules is null).
-- Deleting the template used to leave those hubs with no template and so no sections.
-- Before a template goes, copy its sections onto every hub that was following it, so
-- those hubs keep what they show today and simply stop following a shared template.

create or replace function hub_templates_keep_following_hubs()
returns trigger
language plpgsql
as $$
begin
  update hubs
     set modules = old.modules
   where template_id = old.id
     and modules is null;
  return old;
end;
$$;

drop trigger if exists hub_templates_keep_following_hubs on hub_templates;
create trigger hub_templates_keep_following_hubs
  before delete on hub_templates
  for each row execute function hub_templates_keep_following_hubs();
