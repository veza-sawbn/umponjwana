-- ============================================================================
-- Visit Drakensberg — Grand Tour stage features
--
-- Run AFTER 20261008_grand_tour_ops_only.sql.
--
-- Each stage of /grand-tour can feature things VD Operations picks by hand
-- from the live catalogue: activities and experiences, events, and guided
-- tours. Day tours are separate — they are activities carrying a `grandTour`
-- listing (20261008_grand_tour_ops_only.sql) — and this is the "also at this
-- stage" shelf beside them.
--
-- A row points at an existing vd_entities row; it copies nothing, so a
-- supplier's price or photo change shows up on the Grand Tour automatically,
-- and an entity that is deleted takes its features with it.
--
-- Who may curate: staff (is_admin / is_ops) and VD Operations employees
-- (profiles.organisation = 'vd_operations' with an ops_role). Curation is
-- VD's editorial programme, so unlike a supplier's own listings it is not
-- tied to a per-supplier assignment. Everyone may read: the shelf is public.
-- ============================================================================
-- @rollback: reversible — drop table vd_grand_tour_features; drop function vd_is_grand_tour_curator();

create or replace function public.vd_is_grand_tour_curator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(is_admin() or is_ops(), false)
      or exists (
           select 1 from profiles
            where id = auth.uid()
              and organisation = 'vd_operations'
              and ops_role is not null
         )
$$;
revoke execute on function public.vd_is_grand_tour_curator() from public, anon;
grant execute on function public.vd_is_grand_tour_curator() to authenticated;

create table if not exists vd_grand_tour_features (
  id          uuid primary key default gen_random_uuid(),
  -- A stage id from lib/grand-tour.ts GRAND_TOUR_STAGES (e.g. 'sani-pass').
  -- Not a foreign key: the route is editorial content in code, not a table.
  stage_id    text not null check (stage_id ~ '^[a-z0-9-]{1,60}$'),
  -- 'activity' covers activities and experiences (Experience suppliers list
  -- activities); 'event' is supplier_events; 'tour' is a guided tour.
  kind        text not null check (kind in ('activity', 'event', 'tour')),
  entity_id   text not null references vd_entities(id) on delete cascade,
  position    int  not null default 0,
  -- Optional one-line reason shown on the card, e.g. "Sundowner on Sani Top".
  note        text check (note is null or length(note) <= 140),
  added_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (stage_id, entity_id)
);
create index if not exists vd_grand_tour_features_stage_idx on vd_grand_tour_features (stage_id, position);

alter table vd_grand_tour_features enable row level security;

drop policy if exists "Grand Tour features are public"        on vd_grand_tour_features;
drop policy if exists "Curators manage Grand Tour features"   on vd_grand_tour_features;

create policy "Grand Tour features are public" on vd_grand_tour_features
  for select using (true);

create policy "Curators manage Grand Tour features" on vd_grand_tour_features
  for all using (vd_is_grand_tour_curator()) with check (vd_is_grand_tour_curator());

grant select on vd_grand_tour_features to anon, authenticated;
grant insert, update, delete on vd_grand_tour_features to authenticated;
