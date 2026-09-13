-- ============================================================================
-- vd_release_seats / vd_book_seats — who may move seat inventory
--
-- Regression tests for audit finding H4.
-- See supabase/migrations/20260913_notification_provenance_and_seat_authorization.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_operator  uuid;
  v_guest     uuid;
  v_attacker  uuid;
  v_admin     uuid;
  v_departure text := 'dep-' || gen_random_uuid();
  v_booked    int;
begin
  raise notice 'vd_release_seats / vd_book_seats';

  v_operator := vdtest.make_user('operator@example.test', 'supplier', null, true);
  v_guest    := vdtest.make_user('guest@example.test',    'visitor');
  v_attacker := vdtest.make_user('attacker@example.test', 'visitor');
  v_admin    := vdtest.make_user('ops@example.test',      'admin');

  perform vdtest.act_as_nobody();
  insert into vd_entities (id, kind, owner_id, status, value)
  values (v_departure, 'departure', v_operator, 'open',
          jsonb_build_object('maxSeats', 20, 'bookedSeats', 10, 'tourId', 'tour-1'));

  -- The guest holds 4 of those seats.
  insert into vd_bookings (id, reference, user_id, supplier_ids, status, value)
  values ('bk-' || gen_random_uuid(), 'VD-TEST-1', v_guest, array[v_operator], 'confirmed',
          jsonb_build_object('addons', jsonb_build_array(
            jsonb_build_object('id', v_departure, 'guests', 4))));

  -- ── H4: the finding itself ────────────────────────────────────────────────
  -- A signed-in stranger with no booking and no relationship to the operator
  -- could decrement the count to zero, so the next checkout's capacity test
  -- passes for seats that are already sold.
  perform vdtest.act_as(v_attacker);
  perform vdtest.raises(
    format('select vd_release_seats(%L, 10)', v_departure),
    'not allowed to release seats',
    'H4: a stranger cannot release seats on someone else''s departure');

  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_departure;
  perform vdtest.eq(v_booked, 10, 'H4: the seat count is untouched');

  perform vdtest.raises(
    format('select vd_release_seats(%L, 1)', v_departure),
    'not allowed to release seats',
    'H4: …not even one seat at a time');

  -- ── Who may still release ─────────────────────────────────────────────────
  perform vdtest.act_as(v_guest);
  perform vdtest.allows(
    format('select vd_release_seats(%L, 4)', v_departure),
    'a guest may give back the seats they hold');
  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_departure;
  perform vdtest.eq(v_booked, 6, 'the guest''s release landed');

  perform vdtest.act_as(v_operator);
  perform vdtest.allows(
    format('select vd_release_seats(%L, 2)', v_departure),
    'the operator may release on their own departure');

  perform vdtest.act_as(v_admin);
  perform vdtest.allows(
    format('select vd_release_seats(%L, 1)', v_departure),
    'staff may release on anyone''s departure');

  perform vdtest.act_as_service();
  perform vdtest.allows(
    format('select vd_release_seats(%L, 1)', v_departure),
    'the service role (cancellation sweep) may release');

  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_departure;
  perform vdtest.eq(v_booked, 2, 'all four legitimate releases landed');

  -- A cancelled booking is no longer a claim on the seats.
  update vd_bookings set status = 'cancelled' where user_id = v_guest;
  perform vdtest.act_as(v_guest);
  perform vdtest.raises(
    format('select vd_release_seats(%L, 1)', v_departure),
    'not allowed to release seats',
    'a cancelled booking is no longer a claim on the seats');

  -- ── vd_book_seats: still open to customers, but bounded ───────────────────
  perform vdtest.act_as(v_guest);
  perform vdtest.allows(
    format('select vd_book_seats(%L, 3)', v_departure),
    'a customer may still reserve seats at checkout');

  perform vdtest.raises(
    format('select vd_book_seats(%L, 500)', v_departure),
    'cannot reserve more than',
    'H4: a single call cannot exhaust the departure');

  perform vdtest.raises(
    format('select vd_book_seats(%L, 0)', v_departure),
    'invalid seat count', 'zero seats is rejected');
  perform vdtest.raises(
    format('select vd_book_seats(%L, -5)', v_departure),
    'invalid seat count', 'a negative seat count is rejected');
  -- A negative release used to ADD seats back — greatest(0, booked - (-5)) is
  -- booked + 5 — so even an authorised caller must not get through with one.
  perform vdtest.act_as(v_operator);
  perform vdtest.raises(
    format('select vd_release_seats(%L, -5)', v_departure),
    'invalid seat count', 'a negative release is rejected even for the owner');
  perform vdtest.act_as(v_guest);

  -- Capacity is still enforced.
  perform vdtest.raises(
    format('select vd_book_seats(%L, 20)', v_departure),
    'not enough seats available', 'capacity is still enforced');

  -- And the booking left an audit trail, so a slow exhaustion attempt shows up.
  perform vdtest.ok(
    exists (select 1 from vd_audit_log
             where action = 'departure.seats_booked' and entity_id = v_departure),
    'H4: seat bookings are audited');

  raise notice 'seat authorization: all assertions passed';
end $$;
