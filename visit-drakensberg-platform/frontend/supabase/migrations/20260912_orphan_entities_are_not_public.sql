-- ============================================================================
-- Visit Drakensberg — an ownerless entity is an orphan, not platform content
-- Run AFTER 20260906_suspension_hides_listings.sql.
--
-- vd_owner_is_listable() treats owner_id IS NULL as platform content and
-- returns true, so the public read policy lets every ownerless row through
-- regardless of any supplier's status. That exemption was written for
-- trails/regions/editorial, but none of that lives in vd_entities — it is all
-- in site_content. What actually has a NULL owner_id here is orphans: rows the
-- 20260814 backfill could not reunite with an owner, because their
-- value.supplierId copy was missing (it only matched a valid uuid of an
-- existing user). That migration flagged the leftovers for a manual pass and
-- deleted nothing; the pass never happened.
--
-- At the time of writing, production had two such rows — both open departures
-- on the Mnweni Circuit, one of them for a tour owned by a supplier that has
-- since been SUSPENDED. Anonymous visitors could read both. Their tour is
-- correctly hidden, so lib/experiences.ts drops them from the marketplace
-- view ("draft or deleted tour → not published"), but nothing about that is
-- by design: the rows are publicly readable, they are immune to suspension,
-- and any future orphan — a supplier row whose owner is cleared, or written
-- by a path that skips owner_id — becomes public the same way.
--
-- Platform-owned content in this table is ADMIN-owned, which
-- vd_owner_is_listable already allows via `role = 'admin'` (see the
-- 20260906 migration's own note about admin-owned entities with
-- is_approved = false). So nothing legitimate needs the NULL exemption.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Reunite orphan departures with the owner of the tour they sell
--
--    A departure is a dated instance of a tour, so the tour's owner is the
--    departure's owner. This is the same reasoning as the 20260814 backfill,
--    using the tour edge rather than the missing value.supplierId copy.
--
--    The vd_entities_sync_owner trigger mirrors owner_id back into
--    value.supplierId, so the JSON copy is repaired as a side effect.
--
--    A re-owned row inherits its owner's status: for a suspended owner the
--    row goes non-public here and returns to the public site by itself if the
--    supplier is ever reinstated — which is exactly what suspension means.
-- ────────────────────────────────────────────────────────────────────────────
update vd_entities d
   set owner_id = t.owner_id
  from vd_entities t
 where d.owner_id is null
   and d.kind = 'departure'
   and t.kind = 'tour'
   and t.id = d.value->>'tourId'
   and t.owner_id is not null;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Drop the NULL exemption
--
--    A row nobody owns is no longer publicly readable. This is a narrowing of
--    the same WHERE clause 20260906 widened, so it can only ever hide rows,
--    never expose new ones. Orphans left after step 1 (a departure whose tour
--    no longer exists, say) stop being served to visitors while staying fully
--    visible to admins via "Admins read all entities", which is where they
--    should be triaged.
--
--    Genuine platform content added to this table later must be owned by an
--    admin account, the pattern already in production.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_owner_is_listable(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = p_owner
      and (role = 'admin' or (role = 'supplier' and coalesce(is_approved, false)))
  )
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. What's left over
--
-- Run this after the migration. Anything it returns is an orphan whose owner
-- could not be derived from a tour — no longer public, and needing an owner
-- or deletion. Nothing is deleted here.
--
--   select id, kind, status, value->>'tourId' as claimed_tour, created_at
--     from vd_entities
--    where owner_id is null
--    order by kind, created_at;
-- ────────────────────────────────────────────────────────────────────────────
