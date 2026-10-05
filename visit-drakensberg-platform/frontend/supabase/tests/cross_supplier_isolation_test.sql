-- ============================================================================
-- Cross-supplier isolation — is the supplier console leaking between tenants?
--
-- Written in response to a suspected data breach: the VD Operations console
-- showed IDENTICAL dashboard figures (3 bookings / R20 640) while "managing"
-- two different suppliers.
--
-- app/supplier/page.tsx builds those figures from getMyOrders(), which is:
--
--   supabase.from('vd_booking_orders').select('*').order('created_at', …)
--
-- with NO supplier filter — it relies entirely on RLS, and its comment claims
-- "RLS scopes this to orders that actually belong to the signed-in supplier —
-- never another supplier's bookings."
--
-- That comment is true for a supplier and FALSE for an operations employee,
-- because 20260902_stay_booking_requests.sql added:
--
--   create policy "Managed ops agents read booking orders" on vd_booking_orders
--     for select using (is_managed_supplier(supplier_id)
--                       and has_supplier_permission(supplier_id, 'view_bookings'));
--
-- so the same unfiltered query returns the UNION of every supplier that
-- employee manages, whichever one the UI says it is showing.
--
-- These tests pin down exactly where the boundary holds and where it does not,
-- because the two have very different severities:
--
--   * a supplier seeing another supplier's rows would be a tenant breach;
--   * an ops employee seeing rows they are already authorised for, attributed
--     to the wrong supplier, is a correctness bug in the console.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_supplier_a uuid;
  v_supplier_b uuid;
  v_ops        uuid;
  v_visitor    uuid;
  v_seen       int;
  v_gross      numeric;
begin
  raise notice 'cross-supplier isolation';

  v_supplier_a := vdtest.make_user('alpha-tours@example.test', 'supplier', null, true);
  v_supplier_b := vdtest.make_user('beta-lodge@example.test',  'supplier', null, true);
  v_visitor    := vdtest.make_user('traveller2@example.test',  'visitor');
  v_ops        := vdtest.make_user('ops-agent@example.test',   'visitor', 'operations');

  update profiles set ops_role = 'reservations_manager', organisation = 'vd_operations'
   where id = v_ops;

  perform vdtest.act_as_nobody();

  -- Two suppliers, three bookings each, different values.
  insert into vd_bookings (id, reference, user_id, supplier_ids, status, value) values
    ('bk-a', 'VD-A-1', v_visitor, array[v_supplier_a], 'confirmed', '{}'::jsonb),
    ('bk-b', 'VD-B-1', v_visitor, array[v_supplier_b], 'confirmed', '{}'::jsonb);

  insert into vd_booking_orders (id, booking_id, supplier_id, user_id, reference, status, value) values
    ('bo-a1', 'bk-a', v_supplier_a, v_visitor, 'VD-A-1', 'confirmed', '{"orderTotal": 5000}'::jsonb),
    ('bo-a2', 'bk-a', v_supplier_a, v_visitor, 'VD-A-2', 'confirmed', '{"orderTotal": 5000}'::jsonb),
    ('bo-b1', 'bk-b', v_supplier_b, v_visitor, 'VD-B-1', 'confirmed', '{"orderTotal": 9000}'::jsonb),
    ('bo-b2', 'bk-b', v_supplier_b, v_visitor, 'VD-B-2', 'confirmed', '{"orderTotal": 9000}'::jsonb),
    ('bo-b3', 'bk-b', v_supplier_b, v_visitor, 'VD-B-3', 'confirmed', '{"orderTotal": 9000}'::jsonb);

  -- The ops employee manages BOTH, with booking visibility on each.
  insert into vd_ops_assignments (employee_id, supplier_id, permissions, is_active) values
    (v_ops, v_supplier_a, array['view_bookings', 'manage_bookings'], true),
    (v_ops, v_supplier_b, array['view_bookings', 'manage_bookings'], true);
end $$;

-- Everything below runs as the `authenticated` database role, so the real RLS
-- policies apply rather than the owner's bypass.
do $$
begin
  perform set_config('test.a',   (select id::text from profiles where email = 'alpha-tours@example.test'), false);
  perform set_config('test.b',   (select id::text from profiles where email = 'beta-lodge@example.test'),  false);
  perform set_config('test.ops', (select id::text from profiles where email = 'ops-agent@example.test'),   false);
  -- Stashed up front: under `set local role authenticated` the RLS on profiles
  -- ("Users can read own profile") means this lookup would return NULL and
  -- act_as(NULL) would silently test "nobody" instead of the customer.
  perform set_config('test.visitor', (select id::text from profiles where email = 'traveller2@example.test'), false);
end $$;

set local role authenticated;

do $$
declare
  v_a   uuid := current_setting('test.a')::uuid;
  v_b   uuid := current_setting('test.b')::uuid;
  v_ops uuid := current_setting('test.ops')::uuid;
  v_seen int;
  v_foreign int;
begin
  -- ══ THE BREACH QUESTION ══════════════════════════════════════════════════
  -- This is getMyOrders() verbatim: no filter, RLS only. If a supplier can
  -- see another supplier's row here, the platform has a tenant breach.
  perform vdtest.act_as(v_a);
  select count(*) into v_seen     from vd_booking_orders;
  select count(*) into v_foreign  from vd_booking_orders where supplier_id <> v_a;

  perform vdtest.eq(v_seen, 2,
    'supplier A''s unfiltered query returns ONLY their own 2 orders');
  perform vdtest.eq(v_foreign, 0,
    'NO BREACH: supplier A cannot see supplier B''s orders, even unfiltered');

  perform vdtest.act_as(v_b);
  select count(*) into v_seen    from vd_booking_orders;
  select count(*) into v_foreign from vd_booking_orders where supplier_id <> v_b;
  perform vdtest.eq(v_seen, 3, 'supplier B sees only their own 3 orders');
  perform vdtest.eq(v_foreign, 0,
    'NO BREACH: supplier B cannot see supplier A''s orders either');

  -- A signed-in visitor sees the orders that are theirs as a customer, and
  -- nothing by supplier.
  perform vdtest.act_as(current_setting('test.visitor')::uuid);
  select count(*) into v_seen from vd_booking_orders;
  perform vdtest.eq(v_seen, 5, 'the customer sees their own 5 orders (they booked both)');

  -- ══ THE ACTUAL BUG ═══════════════════════════════════════════════════════
  -- The SAME unfiltered query, run by an ops employee managing both, returns
  -- the union. The supplier console has no idea which supplier it is showing,
  -- so both "managed" dashboards render this identical set — which is exactly
  -- the 3 / R20 640 repeated across two suppliers in the screenshots.
  perform vdtest.act_as(v_ops);
  select count(*) into v_seen from vd_booking_orders;
  perform vdtest.eq(v_seen, 5,
    'THE BUG: the ops employee''s unfiltered query returns BOTH suppliers (2+3)');

  perform vdtest.ok(
    (select count(distinct supplier_id) from vd_booking_orders) = 2,
    'THE BUG: two different suppliers in one supplier-scoped dashboard');

  -- And the fix's shape: filtering by the supplier the console says it is
  -- managing gives the right answer under the same policies. No RLS change is
  -- needed — the query just has to say which supplier it means.
  select count(*) into v_seen from vd_booking_orders where supplier_id = v_a;
  perform vdtest.eq(v_seen, 2, 'FIX: filtering by supplier A gives A''s 2 orders');
  select count(*) into v_seen from vd_booking_orders where supplier_id = v_b;
  perform vdtest.eq(v_seen, 3, 'FIX: filtering by supplier B gives B''s 3 orders');
end $$;

reset role;

-- An ops employee whose assignment is revoked loses the rows immediately —
-- confirming the delegated grant is the only reason they saw them at all.
do $$
declare v_ops uuid := current_setting('test.ops')::uuid;
begin
  update vd_ops_assignments set is_active = false where employee_id = v_ops;
end $$;

set local role authenticated;

do $$
declare v_seen int;
begin
  perform vdtest.act_as(current_setting('test.ops')::uuid);
  select count(*) into v_seen from vd_booking_orders;
  perform vdtest.eq(v_seen, 0,
    'a de-assigned ops employee sees nothing — the delegation is what granted it');

  raise notice 'cross-supplier isolation: all assertions passed';
end $$;

reset role;
