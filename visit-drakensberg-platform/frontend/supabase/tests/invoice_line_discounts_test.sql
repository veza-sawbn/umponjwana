-- ============================================================================
-- Per-line discounts on invoices — bundled packages with an included item
-- written off. See supabase/migrations/20261101_invoice_line_discounts.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin     uuid;
  v_customer  uuid;
  v_hikes     uuid;
  v_transport uuid;
  v_res       jsonb;
  v_order     text;
  v_o         vd_orders%rowtype;
  v_hike      vd_order_lines%rowtype;
  v_shuttle   vd_order_lines%rowtype;
  v_inv       jsonb;
  v_debit     numeric;
  v_credit    numeric;
  v_n         numeric;
  v_lines     jsonb;
begin
  raise notice 'invoice line discounts';

  v_admin     := vdtest.make_user('ild-admin@example.test', 'admin');
  v_customer  := vdtest.make_user('ild-customer@example.test', 'visitor');
  v_hikes     := vdtest.make_user('ild-hikes@example.test', 'supplier', null, true);
  v_transport := vdtest.make_user('ild-shuttle@example.test', 'supplier', null, true);

  -- Fixed rates so the arithmetic below is exact.
  insert into vd_finance_settings (key, value) values
    ('vat_rate', '0.15'), ('service_fee_rate', '0'), ('default_commission_rate', '0.10')
  on conflict (key) do update set value = excluded.value;

  v_lines := jsonb_build_array(
    jsonb_build_object('supplierId', v_hikes, 'supplierName', 'Umphafa Berg Tours', 'category', 'hike',
      'title', 'Northern Mini Traverse', 'quantity', 2, 'unitPrice', 1500, 'grossAmount', 3000),
    jsonb_build_object('supplierId', v_transport, 'supplierName', 'Berg Shuttles', 'category', 'shuttle',
      'title', 'Shuttle: Sentinel car park to Mahai', 'quantity', 2, 'unitPrice', 300, 'grossAmount', 600,
      'discountAmount', 600, 'discountFundedBy', 'platform',
      'discountReason', 'Included in the Northern Mini Traverse package'));

  -- ── Platform-funded write-off ─────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  v_res := vd_create_order(
    jsonb_build_object('guest', true, 'customerName', 'Thandi', 'customerEmail', 'thandi@example.test',
                       'tripName', 'Northern Mini Traverse'),
    v_lines, null, null, null);
  v_order := v_res->>'orderId';

  perform vdtest.act_as_nobody();
  select * into v_o from vd_orders where id = v_order;
  perform vdtest.eq(v_o.subtotal, 3000::numeric, 'the written-off shuttle adds nothing to the subtotal');
  perform vdtest.eq(v_o.total_value, 3450::numeric, 'total is the hike plus VAT');

  select * into v_shuttle from vd_order_lines where order_id = v_order and category = 'shuttle';
  select * into v_hike    from vd_order_lines where order_id = v_order and category = 'hike';
  perform vdtest.eq(v_shuttle.supplier_id, v_transport, 'the shuttle still routes to the transport supplier');
  perform vdtest.eq(v_shuttle.discount_amount, 600::numeric, 'discount stored on the line');
  perform vdtest.eq(v_shuttle.discount_funded_by, 'platform', 'funded by the platform');
  perform vdtest.eq(v_shuttle.discount_reason, 'Included in the Northern Mini Traverse package', 'reason stored');
  perform vdtest.eq(v_shuttle.supplier_share, 540::numeric, 'the transport supplier is still paid on the full price (600 less 10%)');
  perform vdtest.eq(v_shuttle.platform_share, -540::numeric, 'and the platform carries the cost');
  perform vdtest.eq(v_shuttle.tax_amount, 0::numeric, 'no VAT on a line the customer is not charged for');
  perform vdtest.eq(v_hike.supplier_share, 2700::numeric, 'the hike supplier is untouched');

  select sum(debit), sum(credit) into v_debit, v_credit from vd_ledger_entries where order_id = v_order;
  perform vdtest.eq(v_debit, v_credit, 'the journal balances');
  select coalesce(sum(debit), 0) into v_n from vd_ledger_entries where order_id = v_order and account_code = '5100';
  perform vdtest.eq(v_n, 600::numeric, 'the write-off is booked as a platform package discount');
  select coalesce(sum(credit - debit), 0) into v_n from vd_ledger_entries where order_id = v_order and account_code = '2000';
  perform vdtest.eq(v_n, 3240::numeric, 'supplier payable covers both suppliers');

  select lines into v_inv from vd_invoices where order_id = v_order;
  perform vdtest.eq((v_inv->1->>'total')::numeric, 0::numeric, 'the invoice shows the shuttle at R0');
  perform vdtest.eq((v_inv->1->>'grossTotal')::numeric, 600::numeric, 'with its full price');
  perform vdtest.eq(v_inv->1->>'discountLabel', 'Included in the Northern Mini Traverse package', 'and why');
  perform vdtest.ok(not (v_inv->1 ? 'discountFundedBy'), 'who funds it never reaches the customer');

  -- ── Supplier-funded: the existing behaviour ──────────────────────────────
  perform vdtest.act_as(v_admin);
  v_res := vd_update_order(v_order, '{}'::jsonb,
    jsonb_set(v_lines, '{1,discountFundedBy}', '"supplier"'), null);
  perform vdtest.act_as_nobody();
  select * into v_shuttle from vd_order_lines where order_id = v_order and category = 'shuttle';
  perform vdtest.eq(v_shuttle.discount_funded_by, 'supplier', 'editing switches who funds it');
  perform vdtest.eq(v_shuttle.supplier_share, 0::numeric, 'a supplier-funded write-off pays the supplier nothing');
  perform vdtest.eq(v_shuttle.platform_share, 0::numeric, 'and costs the platform nothing');
  select sum(debit), sum(credit) into v_debit, v_credit from vd_ledger_entries where order_id = v_order;
  perform vdtest.eq(v_debit, v_credit, 'the ledger still balances after the edit and its reversal');
  select coalesce(sum(debit - credit), 0) into v_n from vd_ledger_entries where order_id = v_order and account_code = '5100';
  perform vdtest.eq(v_n, 0::numeric, 'the earlier platform discount is reversed');

  -- A partial platform-funded discount.
  perform vdtest.act_as(v_admin);
  v_res := vd_update_order(v_order, '{}'::jsonb,
    jsonb_set(v_lines, '{1,discountAmount}', '200'), null);
  perform vdtest.act_as_nobody();
  select * into v_shuttle from vd_order_lines where order_id = v_order and category = 'shuttle';
  perform vdtest.eq(v_shuttle.supplier_share, 540::numeric, 'partial platform discount: supplier still on the full price');
  perform vdtest.eq(v_shuttle.platform_share, -140::numeric, 'platform keeps 400 charged less 540 paid out');
  select subtotal into v_n from vd_orders where id = v_order;
  perform vdtest.eq(v_n, 3400::numeric, 'the customer pays for the undiscounted part');
  select sum(debit), sum(credit) into v_debit, v_credit from vd_ledger_entries where order_id = v_order;
  perform vdtest.eq(v_debit, v_credit, 'balanced');

  -- ── Guards ────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  perform vdtest.raises(format('select vd_create_order(%L::jsonb, %L::jsonb)',
      '{"guest":true,"customerName":"X","customerEmail":"x@example.test"}',
      jsonb_set(v_lines, '{1,discountAmount}', '601')),
    'more than its price', 'a discount cannot exceed the line''s price');
  perform vdtest.raises(format('select vd_create_order(%L::jsonb, %L::jsonb)',
      '{"guest":true,"customerName":"X","customerEmail":"x@example.test"}',
      jsonb_set(v_lines, '{1,discountAmount}', '-50')),
    'cannot be negative', 'nor be negative');

  perform vdtest.act_as(v_customer);
  perform vdtest.raises(format('select vd_create_order(%L::jsonb, %L::jsonb)',
      '{"customerName":"Me","customerEmail":"ild-customer@example.test"}', v_lines),
    'only staff', 'a customer cannot discount their own checkout');
  perform vdtest.allows(format('select vd_create_order(%L::jsonb, %L::jsonb)',
      '{"customerName":"Me","customerEmail":"ild-customer@example.test"}',
      jsonb_set(v_lines, '{1,discountAmount}', '0')),
    'an ordinary checkout with no discount still works');
end $$;
