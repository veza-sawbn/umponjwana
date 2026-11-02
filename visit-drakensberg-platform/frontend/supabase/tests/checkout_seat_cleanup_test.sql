-- ============================================================================
-- Unpaid checkouts give their seats back; suppliers see online bookings.
-- See supabase/migrations/20261102_checkout_seat_cleanup.sql. Rebuilds the
-- Thukela Falls case: a customer's first attempt is declined, they retry and
-- pay, and the departure must end up counting one seat for them, not two.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_supplier uuid;
  v_guest    uuid;
  v_other    uuid;
  v_dep      text := 'dep-' || gen_random_uuid();
  v_failed   text := 'bk-' || gen_random_uuid();
  v_paid     text := 'bk-' || gen_random_uuid();
  v_open     text := 'bk-' || gen_random_uuid();
  v_hold     uuid;
  v_order    text;
  v_n        int;
  v_booked   int;
  r          record;
begin
  raise notice 'checkout seat cleanup';

  v_supplier := vdtest.make_user('scs-supplier@example.test', 'supplier', null, true);
  v_guest    := vdtest.make_user('scs-guest@example.test', 'visitor');
  v_other    := vdtest.make_user('scs-other@example.test', 'visitor');

  perform vdtest.act_as_nobody();
  insert into vd_entities (id, kind, owner_id, status, value)
  values (v_dep, 'departure', v_supplier, 'open',
          jsonb_build_object('id', v_dep, 'tour', 'Thukela Falls', 'date', '2026-11-14',
                             'maxSeats', 10, 'bookedSeats', 0, 'status', 'open'));

  -- ── Attempt 1: held, booked, claimed — then the card is declined ──────────
  perform vdtest.act_as(v_guest);
  v_hold := vd_hold_inventory('departure', v_dep, '', 1);
  perform vdtest.act_as_nobody();
  insert into vd_bookings (id, reference, user_id, status, value, created_at)
  values (v_failed, 'DBK-FAIL-1', v_guest, 'pending',
          jsonb_build_object('customerName', 'Prosperity Ngobeni', 'customerEmail', 'p@example.test',
                             'customerPhone', '0820000000',
                             'addons', jsonb_build_array(jsonb_build_object('id', v_dep, 'guests', 1,
                                       'packageId', 'pkg-1', 'title', 'Thukela Falls (Self-Drive)'))),
          now() - interval '20 minutes');
  perform vdtest.act_as(v_guest);
  perform vd_claim_inventory_holds(v_failed, array[v_hold]);

  -- ── Attempt 2: the retry, paid ─────────────────────────────────────────────
  v_hold := vd_hold_inventory('departure', v_dep, '', 1);
  perform vdtest.act_as_nobody();
  insert into vd_bookings (id, reference, user_id, status, value)
  values (v_paid, 'DBK-PAID-1', v_guest, 'pending',
          jsonb_build_object('customerName', 'Prosperity Ngobeni', 'customerEmail', 'p@example.test',
                             'addons', jsonb_build_array(jsonb_build_object('id', v_dep, 'guests', 1))));
  perform vdtest.act_as(v_guest);
  perform vd_claim_inventory_holds(v_paid, array[v_hold]);

  perform vdtest.act_as_nobody();
  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_dep;
  perform vdtest.eq(v_booked, 2, 'before the fix: both attempts hold a seat');

  -- ── What a supplier sees ──────────────────────────────────────────────────
  perform vdtest.act_as(v_supplier);
  select count(*) into v_n from vd_departure_bookings(v_dep);
  perform vdtest.eq(v_n, 2, 'the supplier sees both online bookings on their departure');
  select * into r from vd_departure_bookings(v_dep) where reference = 'DBK-FAIL-1';
  perform vdtest.eq(r.customer_name, 'Prosperity Ngobeni', 'with the guest''s name');
  perform vdtest.eq(r.seats, 1, 'and seats');
  perform vdtest.eq(r.rate_title, 'Thukela Falls (Self-Drive)', 'and the rate they chose');
  perform vdtest.ok(r.releases_at is not null, 'an unpaid booking says when it gives its seat back');
  perform vdtest.act_as(v_other);
  perform vdtest.raises(format('select * from vd_departure_bookings(%L)', v_dep),
    'not allowed', 'another customer cannot list a departure''s guests');

  -- An unpaid booking that ALSO holds a second departure is not a repeat of
  -- the retry: it must survive the retry being paid.
  perform vdtest.act_as_nobody();
  insert into vd_entities (id, kind, owner_id, status, value)
  values (v_dep || '-b', 'departure', v_supplier, 'open',
          jsonb_build_object('id', v_dep || '-b', 'maxSeats', 10, 'bookedSeats', 0, 'status', 'open'));
  insert into vd_bookings (id, reference, user_id, status, value)
  values (v_failed || '-multi', 'DBK-MULTI-1', v_guest, 'pending', '{}'::jsonb);
  perform vdtest.act_as(v_guest);
  perform vd_claim_inventory_holds(v_failed || '-multi', array[
    vd_hold_inventory('departure', v_dep, '', 1),
    vd_hold_inventory('departure', v_dep || '-b', '', 1)]);
  -- And one with a stay alongside the same departure.
  perform vdtest.act_as_nobody();
  insert into vd_bookings (id, reference, user_id, status, value)
  values (v_failed || '-stay', 'DBK-STAY-1', v_guest, 'pending', '{"stay":{"id":"prop-x"}}'::jsonb);
  perform vdtest.act_as(v_guest);
  perform vd_claim_inventory_holds(v_failed || '-stay', array[vd_hold_inventory('departure', v_dep, '', 1)]);

  -- ── Paying the retry releases the failed attempt at once ──────────────────
  perform vdtest.act_as_nobody();
  update vd_bookings set status = 'confirmed' where id = v_paid;
  perform vdtest.act_as_service();
  select vd_supersede_pending_bookings(v_paid) into v_n;
  perform vdtest.eq(v_n, 1, 'one earlier unpaid attempt is superseded');
  perform vdtest.eq((select status from vd_bookings where reference = 'DBK-MULTI-1'), 'pending',
    'a booking that also holds another departure is left alone');
  perform vdtest.eq((select status from vd_bookings where reference = 'DBK-STAY-1'), 'pending',
    'and so is one with a stay');
  -- Clear them away so the seat counts below are about the retry only.
  perform vd_cancel_pending_booking(v_failed || '-multi');
  perform vd_cancel_pending_booking(v_failed || '-stay');
  perform vdtest.act_as_nobody();
  perform vdtest.eq((select status from vd_bookings where id = v_failed), 'cancelled', 'it is cancelled');
  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_dep;
  perform vdtest.eq(v_booked, 1, 'and the departure counts one seat for the guest, not two');
  perform vdtest.eq((select status from vd_bookings where id = v_paid), 'confirmed', 'the paid booking is untouched');

  -- ── Expiry: 30 minutes, or 2 hours while the payment page is open ─────────
  perform vdtest.act_as(v_other);
  v_hold := vd_hold_inventory('departure', v_dep, '', 2);
  perform vdtest.act_as_nobody();
  insert into vd_bookings (id, reference, user_id, status, value, created_at)
  values (v_open, 'DBK-OPEN-1', v_other, 'pending',
          jsonb_build_object('addons', jsonb_build_array(jsonb_build_object('id', v_dep, 'guests', 2))),
          now() - interval '45 minutes');
  perform vdtest.act_as(v_other);
  perform vd_claim_inventory_holds(v_open, array[v_hold]);
  perform vdtest.act_as_nobody();
  v_order := 'vdo-' || gen_random_uuid();
  insert into vd_orders (id, order_number, user_id, booking_id, customer_name, customer_email, total_value)
  values (v_order, vd_next_number('VDO'), v_other, v_open, 'Open Payer', 'o@example.test', 100);
  insert into vd_payment_links (id, order_id, external_transaction_id, amount, status)
  values ('pl-' || gen_random_uuid(), v_order, 'tx-' || gen_random_uuid(), 100, 'pending');

  select vd_sweep_abandoned_checkouts() into v_n;
  perform vdtest.eq((select status from vd_bookings where id = v_open), 'pending',
    'a 45-minute-old booking whose payment page is still open keeps its seats');

  update vd_bookings set created_at = now() - interval '3 hours' where id = v_open;
  select vd_sweep_abandoned_checkouts() into v_n;
  perform vdtest.eq((select status from vd_bookings where id = v_open), 'cancelled',
    'after 2 hours it is released');
  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_dep;
  perform vdtest.eq(v_booked, 1, 'its two seats are back');

  -- A declined / never-started payment goes after 30 minutes.
  perform vdtest.act_as(v_guest);
  v_hold := vd_hold_inventory('departure', v_dep, '', 1);
  perform vdtest.act_as_nobody();
  insert into vd_bookings (id, reference, user_id, status, value, created_at)
  values ('bk-late-' || gen_random_uuid(), 'DBK-LATE-1', v_guest, 'pending', '{}'::jsonb, now() - interval '31 minutes');
  perform vdtest.act_as(v_guest);
  perform vd_claim_inventory_holds((select id from vd_bookings where reference = 'DBK-LATE-1'), array[v_hold]);
  perform vdtest.act_as_nobody();
  perform vd_sweep_abandoned_checkouts();
  perform vdtest.eq((select status from vd_bookings where reference = 'DBK-LATE-1'), 'cancelled',
    'an unpaid booking with no open payment page is released after 30 minutes');
  select (value->>'bookedSeats')::int into v_booked from vd_entities where id = v_dep;
  perform vdtest.eq(v_booked, 1, 'and only the paid guest''s seat remains');

  -- ── The sweep can no longer be triggered by just anyone ──────────────────
  set local role authenticated;
  perform vdtest.act_as(v_other);
  perform vdtest.raises('select vd_expire_pending_bookings(0)', 'permission denied',
    'a customer can no longer cancel everyone''s pending bookings');
  perform vdtest.raises('select vd_sweep_abandoned_checkouts()', 'permission denied',
    'nor run the sweep');
  perform vdtest.raises(format('select vd_supersede_pending_bookings(%L)', v_paid), 'permission denied',
    'nor supersede bookings');
  reset role;
end $$;
