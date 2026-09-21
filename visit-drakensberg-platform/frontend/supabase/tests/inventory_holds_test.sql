-- ============================================================================
-- Inventory holds — quota, expiry, claiming, and the activity-timeslot half
-- of H4 the original audit missed.
--
-- See supabase/migrations/20260914_inventory_holds.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_operator  uuid;
  v_guest     uuid;
  v_attacker  uuid;
  v_admin     uuid;
  v_departure text := 'dep-' || gen_random_uuid();
  v_activity  text := 'act-' || gen_random_uuid();
  v_slot_key  text := '2026-10-01:morning';
  v_hold      uuid;
  v_hold2     uuid;
  v_booking   text := 'bk-' || gen_random_uuid();
  v_booked    int;
  v_claimed   int;
  v_released  int;
begin
  raise notice 'inventory holds';

  v_operator := vdtest.make_user('op@example.test',       'supplier', null, true);
  v_guest    := vdtest.make_user('guest2@example.test',   'visitor');
  v_attacker := vdtest.make_user('attacker2@example.test','visitor');
  v_admin    := vdtest.make_user('staff2@example.test',   'admin');

  perform vdtest.act_as_nobody();
  insert into vd_entities (id, kind, owner_id, status, value) values
    (v_departure, 'departure', v_operator, 'open',
     jsonb_build_object('maxSeats', 40, 'bookedSeats', 0)),
    (v_activity, 'activity', v_operator, 'active',
     jsonb_build_object('timeslots', jsonb_build_array(
       jsonb_build_object('id', 'morning', 'capacity', 12))));

  -- ══ H4 (activity half): the defect the audit missed ══════════════════════
  -- vd_release_activity_slot checked only that the caller was signed in, and
  -- never validated p_seats. A negative release ran greatest(booked - (-n), 0)
  -- and INFLATED the count, so one call marked any timeslot permanently full.
  perform vdtest.act_as(v_attacker);
  perform vdtest.raises(
    format('select vd_release_activity_slot(%L, %L::date, %L, -500)', v_activity, '2026-10-01', 'morning'),
    'invalid seat count',
    'H4b: a negative release on a timeslot is rejected');

  perform vdtest.raises(
    format('select vd_release_activity_slot(%L, %L::date, %L, 5)', v_activity, '2026-10-01', 'morning'),
    'not allowed to release seats',
    'H4b: a stranger cannot release someone else''s timeslot');

  perform vdtest.raises(
    format('select vd_book_activity_slot(%L, %L::date, %L, 5)', v_activity, '2026-10-01', 'morning'),
    'not allowed to book seats',
    'H4b: a stranger cannot take seats directly on an activity');

  perform vdtest.raises(
    format('select vd_book_seats(%L, 5)', v_departure),
    'not allowed to book seats',
    'H4: …nor directly on a departure — checkout holds instead');

  perform vdtest.eq(
    (select (value #>> array['slotBookings', v_slot_key])::int from vd_entities where id = v_activity),
    null::int, 'H4b: the timeslot count is untouched');

  -- ══ Holding ══════════════════════════════════════════════════════════════
  perform vdtest.act_as(v_guest);
  v_hold  := vd_hold_inventory('departure', v_departure, '', 4);
  v_hold2 := vd_hold_inventory('activity_slot', v_activity, v_slot_key, 3);

  perform vdtest.ok(v_hold is not null, 'a guest may hold departure seats at checkout');
  perform vdtest.ok(v_hold2 is not null, 'a guest may hold an activity timeslot at checkout');

  perform vdtest.eq(
    (select (value->>'bookedSeats')::int from vd_entities where id = v_departure), 4,
    'the departure count moved with the hold');
  -- Note the starting state: this activity has no 'slotBookings' object at
  -- all, which is every activity until its first booking. 20260829's
  -- jsonb_set(value, array['slotBookings', key], …, true) creates only the
  -- LAST level of a path, so with the parent missing it returned the value
  -- unchanged — the count was never written, the parent was therefore never
  -- created, and every later booking hit the same wall. Activity timeslots
  -- had no working capacity limit at all.
  perform vdtest.eq(
    (select (value #>> array['slotBookings', v_slot_key])::int from vd_entities where id = v_activity), 3,
    'the timeslot count moved with the hold, from a value with no slotBookings object');

  perform vdtest.eq(
    (select user_id from vd_inventory_holds where id = v_hold), v_guest,
    'the hold records who took the seats — which the old counter never did');

  -- Capacity is still enforced through the hold path.
  perform vdtest.raises(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'activity_slot', v_activity, v_slot_key, 10),
    'fully booked', 'capacity is enforced on a held timeslot');

  -- And so are the per-call bounds.
  perform vdtest.raises(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'departure', v_departure, '', 500),
    'cannot reserve more than', 'a single hold cannot exhaust the departure');
  perform vdtest.raises(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'departure', v_departure, '', 0),
    'invalid seat count', 'zero seats is rejected');
  perform vdtest.raises(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'activity_slot', v_activity, 'not-a-slot-key', 1),
    'invalid timeslot reference', 'a malformed slot key is rejected');

  -- ══ The quota: what actually stops the loop ══════════════════════════════
  -- 20260913 capped ONE call at 20 seats, which does not stop a loop. The
  -- attacker's own outstanding holds now count against them.
  perform vdtest.act_as(v_attacker);
  perform vdtest.allows(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'departure', v_departure, '', 20),
    'an attacker may take one hold of 20');
  perform vdtest.allows(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'departure', v_departure, '', 10),
    '…and a second, up to the 30-seat quota');
  perform vdtest.raises(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'departure', v_departure, '', 1),
    'you already hold',
    'H4: the loop stops at the quota — this is the fix the ceiling could not be');

  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_departure;
  perform vdtest.eq(v_booked, 34, 'the departure is not exhausted (4 guest + 30 attacker of 40)');

  -- ══ Expiry frees the quota and the seats ═════════════════════════════════
  update vd_inventory_holds
     set expires_at = now() - interval '1 minute'
   where user_id = v_attacker;

  -- An expired hold stops counting against the quota immediately, before the
  -- sweep runs — a genuine customer is never locked out by their own
  -- abandoned tab.
  perform vdtest.allows(
    format('select vd_hold_inventory(%L, %L, %L, %s)', 'departure', v_departure, '', 1),
    'an expired hold no longer counts against the quota');
  perform vdtest.act_as_service();
  v_released := vd_expire_inventory_holds();
  perform vdtest.ok(v_released >= 2, 'the sweep released the expired holds');

  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_departure;
  perform vdtest.eq(v_booked, 5, 'the attacker''s 30 seats came back (4 guest + 1 fresh hold)');

  -- ══ Claiming ═════════════════════════════════════════════════════════════
  perform vdtest.act_as_nobody();
  insert into vd_bookings (id, reference, user_id, supplier_ids, status, value)
  values (v_booking, 'VD-HOLD-1', v_guest, array[v_operator], 'pending',
          jsonb_build_object('addons', jsonb_build_array()));

  perform vdtest.act_as(v_guest);
  v_claimed := vd_claim_inventory_holds(v_booking, array[v_hold, v_hold2]);
  perform vdtest.eq(v_claimed, 2, 'the booking claims the guest''s holds');

  perform vdtest.eq(
    (select expires_at from vd_inventory_holds where id = v_hold), 'infinity'::timestamptz,
    'a claimed hold stops expiring — a confirmed booking must not lose its seats to a TTL');

  -- A claimed hold survives the sweep.
  perform vdtest.act_as_service();
  perform vdtest.eq(vd_expire_inventory_holds(), 0, 'the sweep leaves claimed holds alone');
  perform vdtest.eq(
    (select (value->>'bookedSeats')::int from vd_entities where id = v_departure), 5,
    'and leaves their seats taken');

  -- Someone else's holds cannot be moved onto your booking.
  perform vdtest.act_as(v_guest);
  v_hold := vd_hold_inventory('departure', v_departure, '', 2);
  perform vdtest.act_as(v_attacker);
  perform vdtest.raises(
    format('select vd_claim_inventory_holds(%L, array[%L]::uuid[])', v_booking, v_hold),
    'not allowed', 'a stranger cannot claim holds onto someone else''s booking');

  -- ══ Releasing ════════════════════════════════════════════════════════════
  perform vdtest.raises(
    format('select vd_release_inventory_hold(%L)', v_hold),
    'not allowed to release this hold',
    'a stranger cannot release someone else''s hold');

  perform vdtest.act_as(v_guest);
  perform vdtest.allows(format('select vd_release_inventory_hold(%L)', v_hold),
    'the holder may release their own hold');
  perform vdtest.allows(format('select vd_release_inventory_hold(%L)', v_hold),
    'releasing twice is a no-op, not a double refund');
  perform vdtest.eq(
    (select (value->>'bookedSeats')::int from vd_entities where id = v_departure), 5,
    'the double release did not return the seats twice');

  -- Cancelling the booking releases exactly what it holds, both kinds.
  v_released := vd_release_booking_inventory(v_booking);
  perform vdtest.eq(v_released, 2, 'cancelling releases both of the booking''s holds');
  perform vdtest.eq(
    (select (value->>'bookedSeats')::int from vd_entities where id = v_departure), 1,
    'the departure seats came back');
  perform vdtest.eq(
    (select (value #>> array['slotBookings', v_slot_key])::int from vd_entities where id = v_activity), 0,
    'and so did the timeslot — which the old sweep never released at all');

  perform vdtest.eq(vd_release_booking_inventory(v_booking), 0,
    'releasing the same booking twice returns nothing further');

  -- The operator and staff keep their direct paths.
  perform vdtest.act_as(v_operator);
  perform vdtest.allows(format('select vd_book_seats(%L, 2)', v_departure),
    'the operator may still record an off-platform guest');
  perform vdtest.allows(
    format('select vd_book_activity_slot(%L, %L::date, %L, 2)', v_activity, '2026-10-01', 'morning'),
    '…and on their own activity');
  perform vdtest.act_as(v_admin);
  perform vdtest.allows(format('select vd_book_seats(%L, 1)', v_departure),
    'staff may too');

  raise notice 'inventory holds: all assertions passed';
end $$;

-- The sweep refuses a plain signed-in caller. Separate block so the failure
-- of the guard is unambiguous rather than folded into the flow above.
do $$
declare v_someone uuid;
begin
  v_someone := vdtest.make_user('nobody-special@example.test', 'visitor');
  perform vdtest.act_as(v_someone);
  perform vdtest.raises('select vd_expire_inventory_holds()', 'admin only',
    'the hold sweep is admin/service-role only');
end $$;
