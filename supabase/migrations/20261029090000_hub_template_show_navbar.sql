-- Each hub template decides whether the public hub page shows the menu items in its
-- navigation bar (the section links and the Sections menu). The bar itself, with the
-- logo and the booking button, always shows.
-- Additive and safe to run on production: every existing template keeps its menu items
-- (default true), so no hub changes until staff switch it off on a template.

alter table hub_templates
  add column if not exists show_navbar boolean not null default true;
