-- ============================================================================
-- Visit Drakensberg — Managed-supplier access for custom trip requests
--
-- vd_trip_requests (20260707_marketplace.sql) predates the delegated-
-- management layer (20260811_delegated_management.sql) and was missed when
-- that migration extended every other supplier-facing table (vd_entities,
-- vd_order_lines, vd_message_threads, vd_bookings) with "Managed ops agents"
-- policies. Its existing "Operators read/update their requests" policies
-- only match operator_id = auth.uid() — the supplier's own auth id, not a
-- VD Operations employee managing that supplier on their behalf.
--
-- Result: a custom trip request for a managed supplier is inserted and
-- notified fine, but is invisible to the employee who actually runs that
-- supplier's portal — it never appears on /supplier/requests and none of
-- the guide/quote/decline actions there can run for it.
-- ============================================================================

drop policy if exists "Managed ops agents read requests"   on vd_trip_requests;
drop policy if exists "Managed ops agents update requests" on vd_trip_requests;

-- Read: mirrors "Managed ops agents read lines" on vd_order_lines.
create policy "Managed ops agents read requests" on vd_trip_requests
  for select using (
    operator_id is not null
    and is_managed_supplier(operator_id)
    and has_supplier_permission(operator_id, 'view_bookings')
  );

-- Update: guide approval, quote issue, and decline all go through this same
-- UPDATE path (see saveTransition() in lib/custom-trips.ts) — mirrors
-- "Managed ops agents update lines" on vd_order_lines.
create policy "Managed ops agents update requests" on vd_trip_requests
  for update using (
    operator_id is not null
    and has_supplier_permission(operator_id, 'manage_bookings')
  );
