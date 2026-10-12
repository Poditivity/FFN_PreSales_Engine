-- Phase 3: Content Database.
--
-- Five content types (founders, case_studies, testimonials, mentors, faqs)
-- plus tracks (admin-creatable audience targeting, not a fixed enum) and the
-- join tables that connect them. Everything here is staff-only via RLS —
-- Phase 4's Proof Layer reads it through a service-role Edge Function, the
-- same pattern the source system uses (no anon policy on any of these
-- tables). Content-empty by design at this stage: no seed data.
--
-- Cross-cutting conventions, applied to every content type below (including
-- mentors and faqs, per the phase spec):
--   * visibility: three-state ('draft' | 'hidden' | 'public'), not a boolean.
--   * audience: uuid[] referencing tracks(id); empty/null = visible to every
--     track, never a required selection.
--   * featured boolean + sort_order integer.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- tracks — admin-creatable audience segments. Every content type's
-- `audience` array references rows here; there is no fixed founder/student/
-- professional enum (that was the source system's hardcoded shortcut).
-- ---------------------------------------------------------------------------
create table if not exists tracks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists tracks_touch on tracks;
create trigger tracks_touch before update on tracks
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- founders — standalone entity; startup fields stay on the individual
-- founder record rather than a separate company entity (a startup with
-- multiple founders is modeled via founder_co_founders, not by extracting
-- the startup out).
-- ---------------------------------------------------------------------------
create table if not exists founders (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  photo_url               text,
  startup_name            text,
  startup_logo_url        text,
  website_url             text,
  starting_stage          text,
  current_stage           text,
  starting_problem        text,
  journey                 text,
  industry                text,
  ffn_support             text,
  key_change              text,
  outcome                 text,
  milestones              text,
  professional_experience text,
  linkedin_url            text,
  audience                uuid[] not null default '{}',
  featured                boolean not null default false,
  visibility              text not null default 'draft' check (visibility in ('draft', 'hidden', 'public')),
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists founders_visibility_idx on founders (visibility);
create index if not exists founders_featured_idx   on founders (featured) where featured;

drop trigger if exists founders_touch on founders;
create trigger founders_touch before update on founders
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- founder_co_founders — self-referential many-to-many. One row per
-- undirected pair, stored in a canonical order (founder_id_a < founder_id_b)
-- so a pair can never be inserted twice in either direction. The
-- founder_co_founder_links view below un-normalizes that back into a
-- symmetric read: "co-founders of X" is the same query regardless of which
-- side of the stored pair X happens to be on.
-- ---------------------------------------------------------------------------
create table if not exists founder_co_founders (
  founder_id_a uuid not null references founders(id) on delete cascade,
  founder_id_b uuid not null references founders(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (founder_id_a, founder_id_b),
  check (founder_id_a < founder_id_b)
);

-- security_invoker: views created by the (BYPASSRLS) migration role would
-- otherwise silently bypass founder_co_founders' RLS for every caller —
-- this makes the view enforce RLS as the querying user, same as the table.
create or replace view founder_co_founder_links
  with (security_invoker = true) as
  select founder_id_a as founder_id, founder_id_b as co_founder_id, created_at from founder_co_founders
  union all
  select founder_id_b as founder_id, founder_id_a as co_founder_id, created_at from founder_co_founders;

-- link/unlink helpers — normalize the pair server-side so callers never have
-- to know or care which id is "a" and which is "b".
create or replace function link_co_founders(p_a uuid, p_b uuid)
returns void
language sql
as $$
  insert into founder_co_founders (founder_id_a, founder_id_b)
  values (least(p_a, p_b), greatest(p_a, p_b))
  on conflict do nothing;
$$;

create or replace function unlink_co_founders(p_a uuid, p_b uuid)
returns void
language sql
as $$
  delete from founder_co_founders
  where founder_id_a = least(p_a, p_b) and founder_id_b = greatest(p_a, p_b);
$$;

-- ---------------------------------------------------------------------------
-- case_studies — a case study can span founders from different startups, so
-- founders are a many-to-many join (case_study_founders), same shape as the
-- source system's case_study_fellows pattern. Just a link, not a PDF upload
-- (per the phase spec's field list: Founder(s), Case Study Link).
-- ---------------------------------------------------------------------------
create table if not exists case_studies (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  case_study_link text,
  audience        uuid[] not null default '{}',
  featured        boolean not null default false,
  visibility      text not null default 'draft' check (visibility in ('draft', 'hidden', 'public')),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists case_studies_visibility_idx on case_studies (visibility);
create index if not exists case_studies_featured_idx   on case_studies (featured) where featured;

drop trigger if exists case_studies_touch on case_studies;
create trigger case_studies_touch before update on case_studies
  for each row execute function touch_updated_at();

create table if not exists case_study_founders (
  id            uuid primary key default gen_random_uuid(),
  case_study_id uuid not null references case_studies(id) on delete cascade,
  founder_id    uuid not null references founders(id) on delete cascade,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (case_study_id, founder_id)
);
create index if not exists case_study_founders_cs_idx      on case_study_founders (case_study_id);
create index if not exists case_study_founders_founder_idx on case_study_founders (founder_id);

-- ---------------------------------------------------------------------------
-- testimonials — single founder (not multi, unlike case studies).
-- ---------------------------------------------------------------------------
create table if not exists testimonials (
  id                uuid primary key default gen_random_uuid(),
  founder_id        uuid not null references founders(id) on delete cascade,
  testimonial_quote text,
  video_link        text,
  audience          uuid[] not null default '{}',
  featured          boolean not null default false,
  visibility        text not null default 'draft' check (visibility in ('draft', 'hidden', 'public')),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists testimonials_visibility_idx on testimonials (visibility);
create index if not exists testimonials_founder_idx    on testimonials (founder_id);

drop trigger if exists testimonials_touch on testimonials;
create trigger testimonials_touch before update on testimonials
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- mentors — new entity, no source/skill equivalent. Carries the same
-- audience/featured/visibility/sort_order conventions as everything else.
-- ---------------------------------------------------------------------------
create table if not exists mentors (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  photo_url             text,
  role                  text,
  expertise             text,
  relevant_experience   text,
  linkedin_url          text,
  audience              uuid[] not null default '{}',
  featured              boolean not null default false,
  visibility            text not null default 'draft' check (visibility in ('draft', 'hidden', 'public')),
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists mentors_visibility_idx on mentors (visibility);
create index if not exists mentors_featured_idx   on mentors (featured) where featured;

drop trigger if exists mentors_touch on mentors;
create trigger mentors_touch before update on mentors
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- faqs — no live-feed equivalent; explicitly not building that here.
-- ---------------------------------------------------------------------------
create table if not exists faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  audience    uuid[] not null default '{}',
  featured    boolean not null default false,
  visibility  text not null default 'draft' check (visibility in ('draft', 'hidden', 'public')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists faqs_visibility_idx on faqs (visibility);

drop trigger if exists faqs_touch on faqs;
create trigger faqs_touch before update on faqs
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — staff-only on every table, no public/anon policy anywhere (Phase 4's
-- public hub reads through a service-role Edge Function, never the browser
-- anon key — matching how form_submissions' public path is the sole
-- deliberate exception in this project, not the default).
-- ---------------------------------------------------------------------------
alter table tracks               enable row level security;
alter table founders             enable row level security;
alter table founder_co_founders  enable row level security;
alter table case_studies         enable row level security;
alter table case_study_founders  enable row level security;
alter table testimonials         enable row level security;
alter table mentors              enable row level security;
alter table faqs                 enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'tracks', 'founders', 'founder_co_founders', 'case_studies',
    'case_study_founders', 'testimonials', 'mentors', 'faqs'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_staff_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t || '_staff_all', t
    );
  end loop;
end $$;
