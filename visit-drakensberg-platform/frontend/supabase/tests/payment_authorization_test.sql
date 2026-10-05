-- ============================================================================
-- vd_record_order_payment — authorization and idempotency
--
-- Regression tests for audit findings C2 and H3.
-- See supabase/migrations/20260913_payment_authorization_and_idempotency.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_customer  uuid;
  v_stranger  uuid;
  v_finance   uuid;
  v_admin     uuid;
  v_order     text;
  v_guest_order text;
  v_payment   text;
  v_again     text;
  v_paid      numeric;
  v_count     int;
begin
  raise notice 'vd_record_order_payment';

  v_customer := vdtest.make_user('customer@example.test', 'visitor');
  v_stranger := vdtest.make_user('stranger@example.test', 'visitor');
  v_finance  := vdtest.make_user('finance@example.test',  'visitor', 'finance');
  v_admin    := vdtest.make_user('admin@example.test',    'admin');

  perform vdtest.act_as_nobody();
  v_order       := vdtest.make_order(v_customer, 5000);
  v_guest_order := vdtest.make_order(null, 2500);

  -- ── C2: the finding itself ────────────────────────────────────────────────
  -- The order's own owner clears every ownership test, and 'card' is not an
  -- instrument the old guard reserved for staff. This was the whole exploit.
  perform vdtest.act_as(v_customer);
  perform vdtest.raises(
    format('select vd_record_order_payment(%L, 5000, %L, %L, %L, %L)',
           v_order, 'payment', 'card', 'self-service', ''),
    'finance role required',
    'C2: the order owner cannot mark their own order paid');

  -- Every instrument, not just the two the old guard happened to reserve.
  perform vdtest.raises(
    format('select vd_record_order_payment(%L, 5000, %L, %L, %L, %L)', v_order, 'payment', 'eft', '', ''),
    'finance role required', 'C2: …not by EFT either');
  perform vdtest.raises(
    format('select vd_record_order_payment(%L, 5000, %L, %L, %L, %L)', v_order, 'payment', 'online', '', ''),
    'finance role required', 'C2: …nor by claiming an online payment');
  perform vdtest.raises(
    format('select vd_record_order_payment(%L, 5000, %L, %L, %L, %L)', v_order, 'deposit', 'card', '', ''),
    'finance role required', 'C2: …nor as a deposit');
  perform vdtest.raises(
    format('select vd_record_order_payment(%L, 500, %L, %L, %L, %L)', v_order, 'refund', 'card', '', ''),
    'finance role required', 'C2: …nor refund themselves');

  -- The order is untouched by all of that.
  select amount_paid into v_paid from vd_orders where id = v_order;
  perform vdtest.eq(v_paid, 0::numeric, 'C2: nothing was credited to the order');
  select count(*) into v_count from vd_order_payments where order_id = v_order;
  perform vdtest.eq(v_count, 0, 'C2: no payment row was written');
  select count(*) into v_count from vd_receipts where order_id = v_order;
  perform vdtest.eq(v_count, 0, 'C2: no receipt was issued');
  select count(*) into v_count from vd_ledger_entries where order_id = v_order;
  perform vdtest.eq(v_count, 0, 'C2: no journal was written');

  -- ── Other people's orders, and guest orders ───────────────────────────────
  perform vdtest.act_as(v_stranger);
  perform vdtest.raises(
    format('select vd_record_order_payment(%L, 5000, %L, %L, %L, %L)', v_order, 'payment', 'card', '', ''),
    'finance role required', 'a stranger cannot pay someone else''s order');
  perform vdtest.raises(
    format('select vd_record_order_payment(%L, 2500, %L, %L, %L, %L)', v_guest_order, 'payment', 'card', '', ''),
    'finance role required', 'a signed-in user cannot settle a guest order');

  -- ── Who may still record a payment ────────────────────────────────────────
  perform vdtest.act_as(v_finance);
  perform vdtest.allows(
    format('select vd_record_order_payment(%L, 1000, %L, %L, %L, %L)', v_order, 'deposit', 'eft', 'eft-001', ''),
    'finance staff may record a payment');

  perform vdtest.act_as(v_admin);
  perform vdtest.allows(
    format('select vd_record_order_payment(%L, 1000, %L, %L, %L, %L)', v_order, 'payment', 'cash', 'cash-001', ''),
    'an admin may record a payment');

  -- The service role has no user JWT: it is the iKhokha webhook, which has
  -- already verified the payment out-of-band with the gateway.
  perform vdtest.act_as_service();
  perform vdtest.allows(
    format('select vd_record_order_payment(%L, 1000, %L, %L, %L, %L)', v_order, 'payment', 'online', 'ikhokha:PL-1', ''),
    'the service role (webhook) may record a payment');

  select amount_paid into v_paid from vd_orders where id = v_order;
  perform vdtest.eq(v_paid, 3000::numeric, 'the three legitimate payments all landed');

  -- ── H3: idempotency on the gateway reference ──────────────────────────────
  -- The webhook's catch block resets vd_payment_links.status to 'pending' even
  -- when vd_record_order_payment already committed, so a retry re-enters here
  -- with the same reference. It must not credit the order twice.
  perform vdtest.act_as_service();
  v_payment := vd_record_order_payment(v_guest_order, 2500, 'payment', 'online', 'ikhokha:PL-RETRY', '');
  v_again   := vd_record_order_payment(v_guest_order, 2500, 'payment', 'online', 'ikhokha:PL-RETRY', '');

  perform vdtest.eq(v_again, v_payment, 'H3: a retried webhook returns the original payment id');

  select count(*) into v_count from vd_order_payments where reference = 'ikhokha:PL-RETRY';
  perform vdtest.eq(v_count, 1, 'H3: only one payment row exists for the reference');

  select amount_paid into v_paid from vd_orders where id = v_guest_order;
  perform vdtest.eq(v_paid, 2500::numeric, 'H3: the order was credited once, not twice');

  select count(*) into v_count from vd_receipts where order_id = v_guest_order;
  perform vdtest.eq(v_count, 1, 'H3: only one receipt was issued');

  select count(*) into v_count from vd_ledger_entries where order_id = v_guest_order;
  perform vdtest.eq(v_count, 2, 'H3: only one balanced journal was written');

  -- A different reference is a different payment, and still goes through.
  perform vdtest.allows(
    format('select vd_record_order_payment(%L, 100, %L, %L, %L, %L)', v_guest_order, 'payment', 'online', 'ikhokha:PL-OTHER', ''),
    'H3: a different reference is still a new payment');

  -- Manual staff entries carry no reference and must never collide with
  -- each other — the unique index is partial for exactly this reason.
  perform vdtest.act_as(v_finance);
  perform vdtest.allows(
    format('select vd_record_order_payment(%L, 10, %L, %L, %L, %L)', v_order, 'payment', 'cash', '', ''),
    'H3: two manual entries with no reference do not collide (1/2)');
  perform vdtest.allows(
    format('select vd_record_order_payment(%L, 10, %L, %L, %L, %L)', v_order, 'payment', 'cash', '', ''),
    'H3: two manual entries with no reference do not collide (2/2)');

  raise notice 'vd_record_order_payment: all assertions passed';
end $$;
