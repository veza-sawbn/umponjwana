-- ============================================================================
-- Visit Drakensberg — Saved listings ("favourites")
--
-- /account/saved has shipped as a working page with an empty array behind it:
-- there was no save control anywhere on the public site and nowhere to put a
-- save if there had been, so the page returned 0 saved listings for every
-- user, forever.
--
-- This is the missing persistence layer. One row per (user, listing) pair.
--
-- Why its own table rather than a jsonb blob on the profile:
--   * a save is a single small write from a heart button on a card. Read-
--     modify-write of an array means two hearts tapped in quick succession
--     (or two tabs) silently lose one of the saves.
--   * "who saved this listing" and "how many saves does this listing have"
--     are ordinary queries against a row table and impossible against a blob.
--
-- The row carries a `value` snapshot of the listing (title, image, location,
-- price…) purely so /account/saved can render a card without fanning out one
-- catalogue read per save. It is a cache, not the source of truth: the page
-- links to the live listing, and a stale snapshot shows a slightly old price,
-- not a wrong page.
-- ============================================================================


create table if not exists public.vd_saved_listings (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  -- Not a foreign key: saveable things live in three different places
  -- (vd_entities rows for stays/activities/tours/packages, site_content for
  -- trails, and editorial content besides). listing_type says which.
  listing_id   text        not null,
  listing_type text        not null,
  value        jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  primary key (user_id, listing_type, listing_id)
);

-- The PK covers "this user's saves" and "is this one saved", which is every
-- read the site makes. This index is for the ordering /account/saved uses.
create index if not exists vd_saved_listings_user_recent_idx
  on public.vd_saved_listings (user_id, created_at desc);


-- ────────────────────────────────────────────────────────────────────────────
-- RLS — a save is private to the person who made it.
--
-- No public read policy at all: nobody, signed in or not, can see another
-- account's saved listings. There is deliberately no UPDATE policy either —
-- a save has no mutable state, and re-saving is an upsert of the snapshot,
-- which the insert policy covers via ON CONFLICT ... DO UPDATE only for rows
-- the user already owns.
-- ────────────────────────────────────────────────────────────────────────────
alter table public.vd_saved_listings enable row level security;

drop policy if exists "Users read own saved listings" on public.vd_saved_listings;
create policy "Users read own saved listings" on public.vd_saved_listings
  for select using (auth.uid() = user_id);

drop policy if exists "Users save own listings" on public.vd_saved_listings;
create policy "Users save own listings" on public.vd_saved_listings
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users refresh own saved listings" on public.vd_saved_listings;
create policy "Users refresh own saved listings" on public.vd_saved_listings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users unsave own listings" on public.vd_saved_listings;
create policy "Users unsave own listings" on public.vd_saved_listings
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.vd_saved_listings to authenticated;
