-- ============================================================================
-- Visit Drakensberg — close a live cross-tenant leak in three admin/ops views
--
-- vd_ops_assignment_details, vd_managed_suppliers_summary, and
-- vd_waiver_request_details were all created as plain views, owned by
-- postgres. Postgres views run with the privileges of their OWNER unless
-- security_invoker is set, and postgres has BYPASSRLS — so every RLS policy
-- on the underlying tables (vd_ops_assignments, profiles, vd_supplier_terms,
-- vd_waiver_requests, vd_waiver_templates, vd_waiver_submissions) was being
-- silently skipped for anyone querying through these views.
--
-- Supabase's default privileges additionally grant SELECT on new
-- public-schema objects to anon, so vd_ops_assignment_details and
-- vd_waiver_request_details — neither of which carries a WHERE filter —
-- were readable by unauthenticated requests: every ops employee/supplier
-- assignment with permissions and commission rates, and every waiver
-- participant's name, email, activity and booking reference across every
-- supplier, with no login required.
--
-- vd_managed_suppliers_summary was not exploitable in practice — its
-- `where a.employee_id = auth.uid()` is a literal predicate baked into the
-- view SQL, and auth.uid() evaluates to NULL for anon regardless of RLS
-- bypass, so it always returned zero rows for an anonymous caller. It is
-- hardened here anyway rather than left relying on that being the only
-- thing standing in the way.
--
-- Applied directly to production via the Supabase MCP on 2026-08-17;
-- this migration exists so a fresh environment (or `supabase db reset`)
-- gets the same fix, and so the history shows it happened.
-- ============================================================================

alter view public.vd_ops_assignment_details    set (security_invoker = on);
alter view public.vd_managed_suppliers_summary  set (security_invoker = on);
alter view public.vd_waiver_request_details     set (security_invoker = on);

-- No table behind any of the three carries an "anon may read" policy, so with
-- RLS now actually enforced through the views, anon would see zero rows
-- regardless. Revoke the grant anyway — there is no legitimate anon use case
-- for any of them, and a bare SELECT grant with no policy backing it is a
-- footgun for the next view built on top of these tables.
revoke all on public.vd_ops_assignment_details    from anon;
revoke all on public.vd_managed_suppliers_summary  from anon;
revoke all on public.vd_waiver_request_details     from anon;
