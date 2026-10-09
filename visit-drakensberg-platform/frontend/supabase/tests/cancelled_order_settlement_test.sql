-- ============================================================================
-- vd_settle_cancelled_order — a cancelled, paid order is closed out by a
-- refund or by credit on the guest's account.
-- See supabase/migrations/20261009_cancelled_booking_refund_or_credit.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_customer uuid;
  v_finance  uuid;
  v_refund_order text;
  v_credit_order text;
  v_live_order   text;
  v_order vd_orders%rowtype;
  v_balance numeric;
  v_count int;
  v_debits numeric; v_credits numeric;
begin
  raise notice 'vd_settle_cancelled_order';

  v_customer := vdtest.make_user('guest@example.test', 'visitor');
  v_finance  := vdtest.make_user('finance2@example.test', 'visitor', 'finance');

  perform vdtest.act_as_nobody();
  v_refund_order := vdtest.make_order(v_customer, 3000);
  v_credit_order := vdtest.make_order(v_customer, 5000);
  v_live_order   := vdtest.make_order(v_customer, 1000);

  -- Paid in full (as the iKhokha webhook would), then cancelled.
  perform vdtest.act_as_service();
  perform vd_record_order_payment(v_refund_order, 3000, 'payment', 'card', 'ikhokha:r1', '');
  perform vd_record_order_payment(v_credit_order, 5000, 'payment', 'card', 'ikhokha:c1', '');
  perform vd_record_order_payment(v_live_order,   1000, 'payment', 'card', 'ikhokha:l1', '');
  perform vd_cancel_order(v_refund_order);
  perform vd_cancel_order(v_credit_order);

  select * into v_order from vd_orders where id = v_credit_order;
  perform vdtest.eq(v_order.refund_balance, 5000::numeric, 'cancelling a paid order leaves the payment owed back');

  -- ── Authorization ─────────────────────────────────────────────────────────
  perform vdtest.act_as(v_customer);
  perform vdtest.raises(format('select vd_settle_cancelled_order(%L, %L)', v_credit_order, 'credit'),
    'finance role required', 'a guest cannot credit themselves');

  perform vdtest.act_as(v_finance);
  perform vdtest.raises(format('select vd_settle_cancelled_order(%L, %L)', v_live_order, 'refund'),
    'order is not cancelled', 'a booking that still stands cannot be refunded this way');
  perform vdtest.raises(format('select vd_settle_cancelled_order(%L, %L, 6000)', v_credit_order, 'credit'),
    'amount exceeds refund balance', 'cannot credit more than was paid');
  perform vdtest.raises(format('select vd_settle_cancelled_order(%L, %L)', v_credit_order, 'cash'),
    'mode must be refund or credit', 'unknown mode is refused');

  -- ── Refund ────────────────────────────────────────────────────────────────
  perform vd_settle_cancelled_order(v_refund_order, 'refund', null, 'card', 'ikhokha-refund:r1', '');
  select * into v_order from vd_orders where id = v_refund_order;
  perform vdtest.eq(v_order.refund_balance, 0::numeric, 'refund clears the refund balance');
  perform vdtest.eq(v_order.payment_status, 'refunded', 'refunded order reads refunded');
  perform vdtest.eq(v_order.financial_status, 'closed', 'refunded order is financially closed');
  perform vdtest.eq(v_order.booking_status, 'cancelled', 'and stays cancelled');
  perform vdtest.raises(format('select vd_settle_cancelled_order(%L, %L)', v_refund_order, 'refund'),
    'nothing to refund', 'a settled order cannot be refunded twice');

  -- ── Credit, in two parts ──────────────────────────────────────────────────
  perform vd_settle_cancelled_order(v_credit_order, 'credit', 2000, 'card', '', 'part one');
  select * into v_order from vd_orders where id = v_credit_order;
  perform vdtest.eq(v_order.refund_balance, 3000::numeric, 'part credit leaves the rest owed');
  perform vdtest.eq(v_order.financial_status, 'open', 'and the order still open');

  perform vd_settle_cancelled_order(v_credit_order, 'credit');
  select * into v_order from vd_orders where id = v_credit_order;
  perform vdtest.eq(v_order.refund_balance, 0::numeric, 'full credit clears the refund balance');
  perform vdtest.eq(v_order.payment_status, 'credited', 'credited order reads credited');
  perform vdtest.eq(v_order.financial_status, 'closed', 'credited order is financially closed');

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into v_debits, v_credits
    from vd_ledger_entries where order_id = v_credit_order and account_code = '2400';
  perform vdtest.eq(v_credits - v_debits, 5000::numeric, 'the credit is booked to 2400 Guest Account Credit');
  select coalesce(sum(debit), 0) - coalesce(sum(credit), 0) into v_balance
    from vd_ledger_entries where order_id = v_credit_order and account_code = '2100';
  perform vdtest.eq(v_balance, 0::numeric, 'and the refund liability is cleared');

  perform set_config('test.customer', v_customer::text, false);
  perform set_config('test.other', vdtest.make_user('other@example.test', 'visitor')::text, false);
end $$;

-- Reads and writes below go through RLS, as they would from the app.
set local role authenticated;

do $$
declare
  v_customer uuid := current_setting('test.customer')::uuid;
  v_other    uuid := current_setting('test.other')::uuid;
  v_count    int;
begin
  -- ── The guest sees their credit, and only theirs ──────────────────────────
  perform vdtest.act_as(v_customer);
  perform vdtest.eq(vd_my_credit_balance(), 5000::numeric, 'guest sees R5000 credit on their account');
  select count(*) into v_count from vd_guest_credits;
  perform vdtest.eq(v_count, 2, 'guest reads their own credit rows');
  perform vdtest.raises(format('insert into vd_guest_credits (user_id, amount) values (%L, 99999)', v_customer),
    'row-level security', 'a guest cannot write credit for themselves');
  perform vdtest.raises(format('select vd_settle_cancelled_order(%L, %L)', 'any', 'credit'),
    'finance role required', 'nor settle an order under RLS');

  perform vdtest.act_as(v_other);
  perform vdtest.eq(vd_my_credit_balance(), 0::numeric, 'another guest sees none of it');
  select count(*) into v_count from vd_guest_credits;
  perform vdtest.eq(v_count, 0, 'nor any of the rows');

  raise notice 'cancelled order settlement: all assertions passed';
end $$;

reset role;
