-- ============================================================================
-- Visit Drakensberg — Suspending a supplier actually hides their listings
-- Run AFTER 20260905_supplier_compliance.sql.
--
-- Suspending or rejecting a supplier did nothing to the live site.
--
-- admin_set_supplier_status() sets profiles.approval_status='suspended' and
-- is_approved=false, and the supplier is told "your listings are hidden".
-- They were not. The public read policy on vd_entities looked only at the
-- entity's own status:
--
--     status = any (array['active','open','confirmed','full','verified'])
--
-- and never at the owner. A suspended supplier's rows stay 'active', so every
-- listing, room, activity, tour, vehicle and guide profile they own remained
-- readable — and bookable — by anyone. At the time of writing this migration
-- there were 6 publicly visible entities belonging to an already-suspended
-- supplier on the production site.
--
-- The same gap made an approval gate meaningless in the other direction: an
-- entity created while a supplier was still pending stayed visible if its own
-- status happened to be 'active'.
--
-- This adds the owner to the test. It is a widening of the WHERE clause, so it
-- can only ever hide rows, never expose new ones.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Is this entity's owner allowed to have public content right now?
--
--    Three cases have to stay visible, and getting any of them wrong takes
--    live content off the site:
--
--      * owner_id IS NULL — platform content (trails, regions, editorial).
--        Nobody's supplier status governs it.
--      * an admin owner — is_approved is a supplier-approval flag and is
--        meaningless for staff. There are admin-owned entities in production
--        with is_approved=false; they are VD's own content, not a pending
--        application.
--      * an approved supplier — the ordinary case.
--
--    Everything else — suspended, rejected, pending, or an owner whose profile
--    row has gone — is hidden.
--
--    SECURITY DEFINER because the caller is usually anon, who cannot read
--    profiles at all; STABLE so the planner evaluates it once per owner per
--    statement rather than per row.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_owner_is_listable(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    p_owner is null
    or exists (
      select 1 from profiles
      where id = p_owner
        and (role = 'admin' or (role = 'supplier' and coalesce(is_approved, false)))
    )
$$;

grant execute on function public.vd_owner_is_listable(uuid) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. The public read policy, now owner-aware
--
--    Staff and owner policies are untouched: "Admins read all entities",
--    "Owners read own entities" and "Managed ops agents read entities" are
--    separate permissive policies, so a suspended supplier still sees their own
--    listings in their portal (they are hidden from visitors, not deleted) and
--    admins still see everything in the console. Only the anonymous/public path
--    narrows.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Public entities are readable" on vd_entities;

create policy "Public entities are readable" on vd_entities
  for select using (
    status = any (array['active', 'open', 'confirmed', 'full', 'verified'])
    and vd_owner_is_listable(owner_id)
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Supporting index
--
--    The policy resolves owner_id → profiles.id, which is the primary key, so
--    the lookup is already an index scan. This partial index is for the
--    reverse question the admin console asks — "which suppliers are currently
--    listable?" — which otherwise scans every profile.
-- ────────────────────────────────────────────────────────────────────────────
create index if not exists profiles_listable_supplier_idx
  on profiles (id)
  where role = 'supplier' and is_approved;
