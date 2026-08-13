-- ============================================================================
-- Visit Drakensberg — restore ops-employee visibility of managed suppliers
--
-- Regression introduced by 20260817_view_security_invoker.sql.
--
-- vd_managed_suppliers_summary INNER JOINs profiles (aliased sp) to attach
-- the supplier's name/email/type to each assignment row:
--
--   from vd_ops_assignments a
--   join profiles sp on sp.id = a.supplier_id
--   left join vd_supplier_terms st on st.supplier_id = a.supplier_id
--   where a.employee_id = auth.uid() and a.is_active = true ...
--
-- Before 20260817, the view ran as its owner (postgres, BYPASSRLS), so this
-- join always succeeded regardless of who was querying — the view's own
-- `where a.employee_id = auth.uid()` was already sufficient to scope it
-- correctly, which is why that migration correctly assessed this specific
-- view as "not exploitable in practice" before hardening it anyway.
--
-- After 20260817 set security_invoker = on, the view began requiring RLS to
-- actually pass on every table it touches — including profiles. But no
-- policy has ever let an ops employee read the PROFILE of a supplier they
-- manage; only "own profile" and "admin reads everything" have existed
-- since 20260704. For a non-admin ops employee, `join profiles sp` now
-- matches zero rows, which drops the entire assignment row from an INNER
-- JOIN — not just the supplier's name, the whole row. getMyManagedSuppliers()
-- (lib/ops-assignments.ts) returns empty, so OperationsProvider's supplier
-- list is empty, and the whole /operations environment reads as if nothing
-- were assigned: no tools, no workspace, "Supplier not assigned to you" —
-- regardless of how correct the assignment's permissions[] array is.
--
-- vd_supplier_terms is LEFT JOINed in the same view, so its RLS gap doesn't
-- drop rows, but it does silently null out commission_rate/management_fee
-- and fall back to the view's COALESCE defaults for model/status — wrong
-- data rather than a missing row, fixed here for the same reason.
--
-- Fix: grant read access scoped to exactly the supplier(s) an employee
-- actively manages, using the existing is_managed_supplier() helper — the
-- same function every other ops-delegation RLS policy already keys on, so
-- this follows the established pattern rather than inventing a new one.
-- ============================================================================

drop policy if exists "Ops employees read managed supplier profiles" on profiles;

create policy "Ops employees read managed supplier profiles" on profiles
  for select using (
    role = 'supplier'
    and is_managed_supplier(id)
  );

drop policy if exists "Ops employees read managed supplier terms" on vd_supplier_terms;

create policy "Ops employees read managed supplier terms" on vd_supplier_terms
  for select using (is_managed_supplier(supplier_id));
