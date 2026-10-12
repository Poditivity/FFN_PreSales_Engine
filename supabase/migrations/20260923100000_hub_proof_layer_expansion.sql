-- Phase 4 (expansion): Proof Layer — About-FFN profile, Programs, per-hub
-- Lead Context, and CTA/contact settings.
--
-- Fully additive: the existing Founders/Case Studies/Testimonials/Mentors/
-- FAQs content types, hub_templates, hubs and hub_settings columns from the
-- earlier Phase 4 migrations are untouched. Every new column/table here is
-- nullable (or has a harmless empty default) and nothing is compulsory —
-- staff can leave any of it blank and the corresponding hub block is simply
-- omitted (enforced in hub-hydrate/src/lib/hubs, not here).
--
--   * ffn_profile — a single global editable "About FFN" profile, same
--     singleton-row shape as hub_settings/email_provider_settings (one
--     row, staff-only RLS, no public policy). Array fields are admin-typed
--     lists (founder stages supported, industries, etc.), not derived from
--     other tables — matches the user's explicit "admin-typed stats"
--     answer for the Community/Credibility proof numbers, which are plain
--     nullable text fields here (not computed from founders/case_studies
--     counts) so staff can phrase them freely ("120+ founders supported").
--   * programs — a real content type, same conventions as founders/mentors
--     (audience uuid[], featured, visibility, sort_order). stages[] and
--     problems_addressed[] are its own admin-typed tag lists, used for
--     "Personalisation / Matching Tags" — deliberately scoped to just this
--     table rather than retrofitting tag columns onto the five existing
--     content types.
--   * hubs gains nullable Lead Context columns (startup_name, founder_stage,
--     current_context) — per-hub, staff-entered, since a hub's lead is not
--     necessarily an existing founder record. Lead name/source are not
--     duplicated here: name already lives on leads, and source is derived
--     from the originating form at render time.
--   * hub_settings gains nullable CTA/contact columns, extending the
--     existing global singleton rather than introducing a per-hub CTA.
-- ---------------------------------------------------------------------------

create table if not exists ffn_profile (
  id                          boolean primary key default true check (id),
  one_liner                   text,
  helps_founders_do           text,
  approach                    text,
  differentiator              text,
  founder_stages_supported    text[] not null default '{}',
  startup_stages_supported    text[] not null default '{}',
  founder_types               text[] not null default '{}',
  industries                  text[] not null default '{}',
  problems_addressed          text[] not null default '{}',
  support_formats             text[] not null default '{}',
  community_founders_stat     text,
  community_stages_stat       text,
  community_industries_stat   text,
  community_experience_stat   text,
  credibility_founders_stat   text,
  credibility_programs_stat   text,
  credibility_events_stat     text,
  credibility_partnerships_stat text,
  website_url                 text,
  updated_at                  timestamptz not null default now()
);
insert into ffn_profile (id) values (true) on conflict (id) do nothing;

alter table ffn_profile enable row level security;

create policy ffn_profile_staff_all on ffn_profile
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- programs — same shape as founders/mentors (Phase 3 conventions).
-- ---------------------------------------------------------------------------
create table if not exists programs (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  stages              text[] not null default '{}',
  problems_addressed  text[] not null default '{}',
  audience            uuid[] not null default '{}',
  featured            boolean not null default false,
  visibility          text not null default 'draft' check (visibility in ('draft', 'hidden', 'public')),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists programs_visibility_idx on programs (visibility);
create index if not exists programs_featured_idx   on programs (featured) where featured;

drop trigger if exists programs_touch on programs;
create trigger programs_touch before update on programs
  for each row execute function touch_updated_at();

alter table programs enable row level security;

create policy programs_staff_all on programs
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- hubs — nullable per-hub Lead Context, staff-entered.
-- ---------------------------------------------------------------------------
alter table hubs add column if not exists startup_name    text;
alter table hubs add column if not exists founder_stage   text;
alter table hubs add column if not exists current_context text;

-- ---------------------------------------------------------------------------
-- hub_settings — nullable global CTA/contact fields.
-- ---------------------------------------------------------------------------
alter table hub_settings add column if not exists cta_text      text;
alter table hub_settings add column if not exists contact_name  text;
alter table hub_settings add column if not exists contact_phone text;
alter table hub_settings add column if not exists contact_email text;
