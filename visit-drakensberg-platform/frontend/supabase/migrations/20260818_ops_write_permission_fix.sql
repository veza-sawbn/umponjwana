-- ============================================================================
-- Visit Drakensberg — widen ops-managed inserts; repair a dead permission key
--
-- Two related bugs surfaced by an ops_administrator unable to create a
-- company profile (vd_entities kind='operator_profile') for a supplier they
-- manage, despite holding what should have been full control:
--
-- 1. "Managed ops agents write entities" (INSERT) only accepted
--    manage_inventory. The matching UPDATE policy already accepts
--    manage_inventory OR manage_content — INSERT was narrower than UPDATE
--    for no reason, and narrower than what lib/ops-permissions.ts already
--    promises client-side (edit_supplier gates /supplier/company,
--    manage_content gates /supplier/media). An assignment with edit_supplier
--    but not manage_inventory could see the Company tool yet be refused by
--    RLS the moment it tried to save for the first time.
--
-- 2. POST /api/admin/ops/create-supplier's auto-assignment (source, now
--    fixed) granted a hand-picked permission list that included
--    'manage_listings' — not a key in ALL_PERMISSIONS, matching no route
--    gate and no RLS check — and omitted 'view_supplier', which every
--    unmapped route (including the portal's own Overview page) falls back
--    to. Any supplier created through that flow ended up looking almost
--    entirely locked to the very administrator who had just created it.
--    This repairs existing rows carrying that dead key.
-- ============================================================================

-- ─── 1. Widen the INSERT policy to match UPDATE's inclusiveness ────────────
drop policy if exists "Managed ops agents write entities" on vd_entities;

create policy "Managed ops agents write entities" on vd_entities
  for insert with check (
    owner_id is not null
    and (
      has_supplier_permission(owner_id, 'manage_inventory')
      or has_supplier_permission(owner_id, 'manage_content')
      or has_supplier_permission(owner_id, 'edit_supplier')
    )
  );

-- ─── 2. Repair assignments carrying the dead 'manage_listings' key ─────────
-- Replaces it with 'manage_inventory' (the closest real equivalent — content
-- creation/management for the supplier's catalog) and adds 'view_supplier'
-- wherever it was missing, since every assignment should carry the baseline
-- read permission regardless of what else was granted.
update vd_ops_assignments
   set permissions = (
         select array_agg(distinct p)
           from unnest(
             array_replace(permissions, 'manage_listings', 'manage_inventory')
             || case when not ('view_supplier' = any(permissions))
                     then array['view_supplier']
                     else array[]::text[]
                end
           ) as p
       ),
       updated_at = now()
 where 'manage_listings' = any(permissions)
    or not ('view_supplier' = any(permissions));

-- ─── 3. Check what changed ──────────────────────────────────────────────────
--   select id, employee_id, supplier_id, permissions
--     from vd_ops_assignments
--    order by updated_at desc
--    limit 20;
-- No row should contain 'manage_listings', and every row should contain
-- 'view_supplier'.
