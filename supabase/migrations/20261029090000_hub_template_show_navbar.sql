-- Each hub template decides whether the public hub page shows its navigation bar.
-- Additive and safe to run on production: every existing template keeps the bar
-- (default true), so no hub changes until staff switch it off on a template.

alter table hub_templates
  add column if not exists show_navbar boolean not null default true;
