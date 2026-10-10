-- ============================================================================
-- vd_set_invoice_payment_schedule — who may set it, and what it accepts
--
-- See supabase/migrations/20261011_invoice_payment_schedules.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_customer uuid;
  v_finance  uuid;
  v_admin    uuid;
  v_order    text;
  v_invoice  text;
  v_deposit  jsonb := '{"kind":"deposit","instalments":[
                         {"label":"Deposit","amount":3000,"percent":30,"dueDate":"2026-11-01"},
                         {"label":"Balance","amount":0,"dueDate":"2026-12-01"}]}';
  v_split    jsonb := '{"kind":"split","instalments":[
                         {"label":"Payment 1","amount":2500,"dueDate":null},
                         {"label":"Payment 2","amount":2500,"dueDate":"2026-11-15"},
                         {"label":"Payment 3","amount":0,"dueDate":"2026-12-15"}]}';
  v_stored   jsonb;
  v_public   jsonb;
  v_payable  jsonb;
begin
  raise notice 'vd_set_invoice_payment_schedule';

  v_customer := vdtest.make_user('sched-customer@example.test', 'visitor');
  v_finance  := vdtest.make_user('sched-finance@example.test',  'visitor', 'finance');
  v_admin    := vdtest.make_user('sched-admin@example.test',    'admin');

  perform vdtest.act_as_nobody();
  v_order := vdtest.make_order(v_customer, 10000);
  select id into v_invoice from vd_invoices where order_id = v_order;

  -- ── Who ───────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_customer);
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice, v_deposit),
    'finance role required', 'the customer cannot set their own payment terms');

  perform vdtest.act_as(v_finance);
  perform vdtest.allows(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice, v_deposit),
    'finance staff can set a deposit');

  perform vdtest.act_as(v_admin);
  perform vdtest.allows(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice, v_split),
    'an admin can replace it with a split');

  perform vdtest.act_as_nobody();
  select payment_schedule into v_stored from vd_invoices where id = v_invoice;
  perform vdtest.eq(v_stored->>'kind', 'split', 'the split was stored');
  perform vdtest.eq(jsonb_array_length(v_stored->'instalments'), 3, 'with all three instalments');

  -- ── What ──────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice,
      '{"kind":"deposit","instalments":[{"label":"Deposit","amount":10000},{"label":"Balance","amount":0}]}'),
    'less than the invoice total', 'a deposit equal to the total is refused');
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice,
      '{"kind":"split","instalments":[{"label":"Only","amount":0}]}'),
    'at least two', 'a one-payment split is refused');
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice,
      '{"kind":"split","instalments":[{"label":"A"},{"label":"B","amount":0}]}'),
    'needs an amount', 'an earlier instalment with no amount is refused');
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice,
      '{"kind":"split","instalments":[{"label":"A","amount":"500"},{"label":"B","amount":0}]}'),
    'needs an amount', 'an amount given as text is refused');
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice,
      '{"kind":"split","instalments":[{"label":"A","amount":-5},{"label":"B","amount":0}]}'),
    'greater than zero', 'a negative instalment is refused');
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice,
      '{"kind":"split","instalments":[{"label":"A","amount":100,"dueDate":"2026-12-01"},{"label":"B","amount":0,"dueDate":"2026-11-01"}]}'),
    'run in order', 'due dates out of order are refused');
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice,
      '{"kind":"layaway","instalments":[{"label":"A","amount":100},{"label":"B","amount":0}]}'),
    'deposit or split', 'an unknown kind is refused');

  -- Still the split after all those refusals.
  perform vdtest.act_as_nobody();
  select payment_schedule into v_stored from vd_invoices where id = v_invoice;
  perform vdtest.eq(v_stored->>'kind', 'split', 'refused schedules left the stored one alone');

  -- ── Changing it after money has come in ───────────────────────────────────
  perform vdtest.act_as(v_finance);
  perform vd_record_order_payment(v_order, 2500, 'deposit', 'eft', 'sched-test-1', '');
  perform vdtest.allows(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice, v_deposit),
    'the schedule can still be changed once a payment is recorded');

  -- ── Visible where the customer and the payment route read it ─────────────
  perform vdtest.act_as_nobody();
  v_public := vd_invoice_public(v_invoice);
  perform vdtest.eq(v_public->'invoice'->'payment_schedule'->>'kind', 'deposit',
    'the public invoice view carries the schedule');
  v_payable := vd_invoice_payable(v_invoice);
  perform vdtest.eq(v_payable->'payment_schedule'->>'kind', 'deposit', 'the payable view carries it too');
  perform vdtest.eq((v_payable->>'amount_paid')::numeric, 2500::numeric, 'with the amount paid so far');

  -- ── Clearing it ───────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  perform vdtest.allows(
    format('select vd_set_invoice_payment_schedule(%L, null)', v_invoice),
    'clearing the schedule returns the invoice to pay-in-full');
  perform vdtest.act_as_nobody();
  select payment_schedule into v_stored from vd_invoices where id = v_invoice;
  perform vdtest.ok(v_stored is null, 'the schedule is gone');

  -- ── Void invoices are closed ──────────────────────────────────────────────
  update vd_invoices set status = 'void' where id = v_invoice;
  perform vdtest.act_as(v_admin);
  perform vdtest.raises(
    format('select vd_set_invoice_payment_schedule(%L, %L::jsonb)', v_invoice, v_deposit),
    'void', 'a void invoice cannot be given a schedule');
end $$;
