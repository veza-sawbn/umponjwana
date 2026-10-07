-- ============================================================================
-- Operator-edited booking itineraries — who may read and write them
--
-- See supabase/migrations/20261007_booking_itineraries.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_tours    uuid;
  v_lodge    uuid;
  v_guest    uuid;
  v_stranger uuid;
  v_ops      uuid;
  v_viewer   uuid;
begin
  raise notice 'booking itineraries';

  v_tours    := vdtest.make_user('itin-tours@example.test', 'supplier', null, true);
  v_lodge    := vdtest.make_user('itin-lodge@example.test', 'supplier', null, true);
  v_guest    := vdtest.make_user('itin-guest@example.test', 'visitor');
  v_stranger := vdtest.make_user('itin-stranger@example.test', 'visitor');
  v_ops      := vdtest.make_user('itin-ops@example.test', 'visitor', 'operations');
  v_viewer   := vdtest.make_user('itin-viewer@example.test', 'visitor', 'operations');

  perform vdtest.act_as_nobody();

  -- One booking: a private trip with the tour operator, a tour with the lodge.
  insert into vd_bookings (id, reference, user_id, supplier_ids, status, value) values
    ('bk-itin', 'VD-ITIN', v_guest, array[v_tours, v_lodge], 'confirmed', jsonb_build_object(
      'addons', jsonb_build_array(
        jsonb_build_object('id', 'trip-request-trq-1', 'title', 'Private trip — Amphitheatre',
                           'date', '2026-11-01', 'supplierId', v_tours, 'price_per_person', 4000),
        jsonb_build_object('id', 'dep-lodge', 'title', 'Lodge walk', 'date', '2026-11-03',
                           'packageId', 'pkg-1', 'supplierId', v_lodge, 'price_per_person', 900))));

  insert into vd_booking_orders (id, booking_id, supplier_id, user_id, reference, status, value) values
    ('bo-itin-t', 'bk-itin', v_tours, v_guest, 'VD-ITIN', 'confirmed',
      '{"items": [{"id": "trip-request-trq-1", "type": "hike"}]}'::jsonb),
    ('bo-itin-l', 'bk-itin', v_lodge, v_guest, 'VD-ITIN', 'confirmed',
      '{"items": [{"id": "dep-lodge", "type": "tour"}]}'::jsonb);

  insert into vd_ops_assignments (employee_id, supplier_id, permissions, is_active) values
    (v_ops,    v_tours, array['view_bookings', 'manage_bookings'], true),
    (v_viewer, v_tours, array['view_bookings'], true);

  perform set_config('test.tours',    v_tours::text, false);
  perform set_config('test.lodge',    v_lodge::text, false);
  perform set_config('test.guest',    v_guest::text, false);
  perform set_config('test.stranger', v_stranger::text, false);
  perform set_config('test.ops',      v_ops::text, false);
  perform set_config('test.viewer',   v_viewer::text, false);
end $$;

set local role authenticated;

do $$
declare
  v_tours    uuid := current_setting('test.tours')::uuid;
  v_lodge    uuid := current_setting('test.lodge')::uuid;
  v_guest    uuid := current_setting('test.guest')::uuid;
  v_stranger uuid := current_setting('test.stranger')::uuid;
  v_ops      uuid := current_setting('test.ops')::uuid;
  v_viewer   uuid := current_setting('test.viewer')::uuid;
  v_count    int;
  v_item     jsonb;
begin
  -- ── Writing ──────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_tours);
  perform vdtest.allows(format(
    $q$insert into vd_booking_itineraries (booking_id, item_id, supplier_id, value)
       values ('bk-itin', 'trip-request-trq-1', %L, '{"days": [{"label": "Day one"}]}')$q$, v_tours),
    'the operator sets the itinerary of an item they deliver');
  perform vdtest.raises(format(
    $q$insert into vd_booking_itineraries (booking_id, item_id, supplier_id)
       values ('bk-itin', 'dep-lodge', %L)$q$, v_tours),
    'row-level security', 'the operator cannot claim another supplier''s item');
  perform vdtest.raises(format(
    $q$insert into vd_booking_itineraries (booking_id, item_id, supplier_id)
       values ('bk-itin', 'dep-lodge', %L)$q$, v_lodge),
    'row-level security', 'the operator cannot write in another supplier''s name');

  -- ── Other suppliers ──────────────────────────────────────────────────────
  perform vdtest.act_as(v_lodge);
  select count(*) into v_count from vd_booking_itineraries;
  perform vdtest.eq(v_count, 0, 'another supplier on the same booking cannot read it');
  update vd_booking_itineraries set value = '{"days": []}' where item_id = 'trip-request-trq-1';
  get diagnostics v_count = row_count;
  perform vdtest.eq(v_count, 0, 'another supplier cannot change it');

  -- ── The guest ────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_guest);
  select count(*) into v_count from vd_booking_itineraries where booking_id = 'bk-itin';
  perform vdtest.eq(v_count, 1, 'the guest reads the itinerary on their booking');
  update vd_booking_itineraries set value = '{"days": []}' where booking_id = 'bk-itin';
  get diagnostics v_count = row_count;
  perform vdtest.eq(v_count, 0, 'the guest cannot change it');
  perform vdtest.raises(format(
    $q$insert into vd_booking_itineraries (booking_id, item_id, supplier_id)
       values ('bk-itin', 'dep-lodge', %L)$q$, v_lodge),
    'row-level security', 'the guest cannot write one');

  perform vdtest.act_as(v_stranger);
  select count(*) into v_count from vd_booking_itineraries;
  perform vdtest.eq(v_count, 0, 'someone else''s guest sees nothing');

  -- ── VD Operations staff managing the operator ────────────────────────────
  perform vdtest.act_as(v_ops);
  update vd_booking_itineraries set value = '{"days": [{"label": "Fixed by ops"}]}'
   where booking_id = 'bk-itin' and item_id = 'trip-request-trq-1';
  get diagnostics v_count = row_count;
  perform vdtest.eq(v_count, 1, 'an ops employee with manage_bookings can adjust it');

  perform vdtest.act_as(v_viewer);
  select count(*) into v_count from vd_booking_itineraries;
  perform vdtest.eq(v_count, 1, 'an ops employee with view_bookings can read it');
  update vd_booking_itineraries set value = '{"days": []}' where booking_id = 'bk-itin';
  get diagnostics v_count = row_count;
  perform vdtest.eq(v_count, 0, 'view_bookings alone cannot change it');

  -- ── vd_supplier_booking_item ─────────────────────────────────────────────
  perform vdtest.act_as(v_tours);
  v_item := vd_supplier_booking_item('bk-itin', 'trip-request-trq-1');
  perform vdtest.eq(v_item->>'date', '2026-11-01', 'the operator reads their own item''s date');
  perform vdtest.ok(not (v_item ? 'price_per_person'), 'only routing fields are returned');
  perform vdtest.ok(vd_supplier_booking_item('bk-itin', 'dep-lodge') is null,
    'the operator cannot read another supplier''s item');

  perform vdtest.act_as(v_lodge);
  perform vdtest.eq(vd_supplier_booking_item('bk-itin', 'dep-lodge')->>'packageId', 'pkg-1',
    'the package travels with the item');

  perform vdtest.act_as(v_viewer);
  perform vdtest.ok(vd_supplier_booking_item('bk-itin', 'trip-request-trq-1') is not null,
    'an ops employee with view_bookings reads the managed supplier''s item');

  perform vdtest.act_as(v_stranger);
  perform vdtest.ok(vd_supplier_booking_item('bk-itin', 'trip-request-trq-1') is null,
    'nobody else reads the item');

  perform vdtest.act_as_nobody();
  perform vdtest.ok(vd_supplier_booking_item('bk-itin', 'trip-request-trq-1') is null,
    'no JWT reads nothing');

  -- ── Reset ────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_lodge);
  delete from vd_booking_itineraries where booking_id = 'bk-itin';
  get diagnostics v_count = row_count;
  perform vdtest.eq(v_count, 0, 'another supplier cannot delete it');

  perform vdtest.act_as(v_tours);
  delete from vd_booking_itineraries where booking_id = 'bk-itin' and item_id = 'trip-request-trq-1';
  get diagnostics v_count = row_count;
  perform vdtest.eq(v_count, 1, 'the operator resets it to the standard itinerary');

  raise notice 'booking itineraries: all assertions passed';
end $$;

reset role;
