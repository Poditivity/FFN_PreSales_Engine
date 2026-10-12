-- Content collections: a content type staff define themselves.
--
-- The content database has fixed types (founders, mentors, programs, case
-- studies, testimonials, FAQs), each with fields a hub relies on. A collection
-- is the open-ended one: staff give it a name, such as Events or Partners, and
-- fill it with items that each have a title, a description, an image, a link,
-- an audience, a featured flag and a visibility. A hub section can then list a
-- collection, and every collection item follows the same rules as the other
-- content: audience (empty means every track), featured, sort order, and a
-- draft never reaches a hub.
--
-- Staff only through RLS, like every other content table. The public hub reads
-- it through the hub-hydrate edge function, which uses the service role.
create table if not exists content_collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists content_collection_items (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references content_collections(id) on delete cascade,
  title         text not null,
  description   text,
  image_url     text,
  link_url      text,
  audience      uuid[] not null default '{}',
  featured      boolean not null default false,
  visibility    text not null default 'draft' check (visibility in ('draft', 'public')),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists content_collection_items_collection_idx on content_collection_items (collection_id);
create index if not exists content_collection_items_visibility_idx on content_collection_items (visibility);

drop trigger if exists content_collections_touch on content_collections;
create trigger content_collections_touch before update on content_collections
  for each row execute function touch_updated_at();

drop trigger if exists content_collection_items_touch on content_collection_items;
create trigger content_collection_items_touch before update on content_collection_items
  for each row execute function touch_updated_at();

alter table content_collections      enable row level security;
alter table content_collection_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['content_collections', 'content_collection_items']
  loop
    execute format('drop policy if exists %I on %I', t || '_staff_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t || '_staff_all', t
    );
  end loop;
end $$;
