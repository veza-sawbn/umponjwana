-- ============================================================================
-- B&B stays — per-person-sharing and child room rates priced server-side at
-- checkout. See supabase/migrations/20261116_bnb_stays.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_customer uuid;
  v_bnb      uuid;
  v_res      jsonb;
  v_line     vd_order_lines%rowtype;
  v_subtotal numeric;

begin
  raise notice 'B&B stays';

  v_customer := vdtest.make_user('bnb-customer@example.test', 'visitor');
  v_bnb      := vdtest.make_user('bnb-host@example.test', 'supplier', null, true);

  insert into vd_finance_settings (key, value) values
    ('vat_rate', '0'), ('service_fee_rate', '0'), ('default_commission_rate', '0.10')
  on conflict (key) do update set value = excluded.value;

  insert into vd_entities (id, kind, owner_id, status, value) values
    ('prop-bnb-test', 'property', v_bnb, 'active',
       jsonb_build_object('id', 'prop-bnb-test', 'name', 'Berg Rose B&B', 'type', 'Bed & Breakfast', 'status', 'active')),
    -- Per person sharing, with a child rate.
    ('room-bnb-pps', 'room', v_bnb, 'active',
       jsonb_build_object('id', 'room-bnb-pps', 'propertyId', 'prop-bnb-test', 'basePrice', 650,
                          'rateBasis', 'per_person', 'childMaxAge', 12, 'childPrice', 300,
                          'inclusions', jsonb_build_array('Breakfast'), 'status', 'active')),
    -- Per person sharing, no child rate: everyone pays the adult rate.
    ('room-bnb-pps-nokids', 'room', v_bnb, 'active',
       jsonb_build_object('id', 'room-bnb-pps-nokids', 'propertyId', 'prop-bnb-test', 'basePrice', 700,
                          'rateBasis', 'per_person', 'status', 'active')),
    -- A legacy room: no rateBasis at all, with a child surcharge.
    ('room-legacy', 'room', v_bnb, 'active',
       jsonb_build_object('id', 'room-legacy', 'propertyId', 'prop-bnb-test', 'basePrice', 1800,
                          'childMaxAge', 12, 'childPrice', 250, 'status', 'active')),
    -- A legacy room with no child rate.
    ('room-flat', 'room', v_bnb, 'active',
       jsonb_build_object('id', 'room-flat', 'propertyId', 'prop-bnb-test', 'basePrice', 1500, 'status', 'active'));

  -- ── The pricing function on its own ──────────────────────────────────────
  perform vdtest.eq(vd_canonical_stay_night_price('{"guests":2,"value":{"roomId":"room-bnb-pps"}}'),
    1300::numeric, 'per person sharing: two adults pay the rate twice');
  perform vdtest.eq(vd_canonical_stay_night_price('{"guests":3,"value":{"roomId":"room-bnb-pps","children":1}}'),
    1600::numeric, 'a child pays the child rate instead of the adult rate');
  perform vdtest.eq(vd_canonical_stay_night_price('{"guests":2,"value":{"roomId":"room-bnb-pps","children":5}}'),
    600::numeric, 'children are clamped to the party size');
  perform vdtest.eq(vd_canonical_stay_night_price('{"guests":3,"value":{"roomId":"room-bnb-pps-nokids","children":2}}'),
    2100::numeric, 'with no child rate, children count as adults');
  perform vdtest.eq(vd_canonical_stay_night_price('{"value":{"roomId":"room-bnb-pps"}}'),
    650::numeric, 'a missing guest count is one person');
  perform vdtest.eq(vd_canonical_stay_night_price('{"guests":"lots","value":{"roomId":"room-bnb-pps","children":"x"}}'),
    650::numeric, 'garbage counts read as the smallest party, not an error');
  perform vdtest.eq(vd_canonical_stay_night_price('{"guests":4,"value":{"roomId":"room-flat"}}'),
    1500::numeric, 'a per-room rate ignores the party size');
  perform vdtest.eq(vd_canonical_stay_night_price('{"guests":3,"value":{"roomId":"room-legacy","children":2}}'),
    2300::numeric, 'a per-room child rate is a surcharge on top');
  perform vdtest.ok(vd_canonical_stay_night_price('{"guests":2,"value":{"roomId":"room-missing"}}') is null,
    'an unknown room has no canonical price');
  perform vdtest.ok(vd_canonical_stay_night_price('{"guests":2,"value":{}}') is null,
    'nor does a line with no room');

  -- ── Through checkout ─────────────────────────────────────────────────────
  -- 3 nights in the per-person room for 2 adults and 1 child. The client
  -- claims R1/night; the server re-prices it to (2×650 + 300) × 3.
  perform vdtest.act_as(v_customer);
  v_res := vd_create_order(
    jsonb_build_object('customerName', 'Lindiwe', 'customerEmail', 'bnb-customer@example.test'),
    jsonb_build_array(jsonb_build_object(
      'supplierId', v_bnb, 'supplierName', 'Berg Rose B&B', 'category', 'accommodation',
      'productId', 'prop-bnb-test', 'title', 'Berg Rose B&B · Garden Room',
      'serviceDate', '2026-12-18', 'endDate', '2026-12-21',
      'guests', 3, 'quantity', 3, 'unitLabel', 'night',
      'value', jsonb_build_object('roomId', 'room-bnb-pps', 'children', 1),
      'unitPrice', 1, 'grossAmount', 3, 'validatePrice', true)),
    null, null, null);
  perform vdtest.act_as_nobody();

  select * into v_line from vd_order_lines where order_id = v_res->>'orderId';
  perform vdtest.eq(v_line.unit_price, 1600::numeric, 'the nightly price is the server''s, for the whole party');
  perform vdtest.eq(v_line.gross_amount, 4800::numeric, 'times the nights');
  select subtotal into v_subtotal from vd_orders where id = v_res->>'orderId';
  perform vdtest.eq(v_subtotal, 4800::numeric, 'the order subtotal follows the re-priced line');

  -- A legacy per-room line with a child: the surcharge the stay page showed
  -- is now charged, not dropped.
  perform vdtest.act_as(v_customer);
  v_res := vd_create_order(
    jsonb_build_object('customerName', 'Lindiwe', 'customerEmail', 'bnb-customer@example.test'),
    jsonb_build_array(jsonb_build_object(
      'supplierId', v_bnb, 'supplierName', 'Berg Rose B&B', 'category', 'accommodation',
      'productId', 'prop-bnb-test', 'title', 'Berg Rose B&B · Family Room',
      'guests', 3, 'quantity', 2, 'unitLabel', 'night',
      'value', jsonb_build_object('roomId', 'room-legacy', 'children', 1),
      'unitPrice', 2050, 'grossAmount', 4100, 'validatePrice', true)),
    null, null, null);
  perform vdtest.act_as_nobody();
  select * into v_line from vd_order_lines where order_id = v_res->>'orderId';
  perform vdtest.eq(v_line.gross_amount, 4100::numeric, 'per-room rate plus the child surcharge, two nights');

  -- A line that doesn't opt in to validation keeps its submitted price, as
  -- before (package components, admin manual invoices).
  perform vdtest.act_as(v_customer);
  v_res := vd_create_order(
    jsonb_build_object('customerName', 'Lindiwe', 'customerEmail', 'bnb-customer@example.test'),
    jsonb_build_array(jsonb_build_object(
      'supplierId', v_bnb, 'supplierName', 'Berg Rose B&B', 'category', 'accommodation',
      'productId', 'prop-bnb-test', 'title', 'Berg Rose B&B',
      'guests', 2, 'quantity', 1, 'unitLabel', 'night',
      'value', jsonb_build_object('roomId', 'room-bnb-pps'),
      'unitPrice', 999, 'grossAmount', 999)),
    null, null, null);
  perform vdtest.act_as_nobody();
  select * into v_line from vd_order_lines where order_id = v_res->>'orderId';
  perform vdtest.eq(v_line.gross_amount, 999::numeric, 'an un-validated line keeps its price');

  -- The pricing helper is internal — only vd_create_order (SECURITY DEFINER)
  -- calls it. The harness runs as superuser, so check the grant itself.
  perform vdtest.ok(not has_function_privilege('authenticated', 'public.vd_canonical_stay_night_price(jsonb)', 'execute'),
    'signed-in users cannot call the pricing helper directly');
  perform vdtest.ok(not has_function_privilege('anon', 'public.vd_canonical_stay_night_price(jsonb)', 'execute'),
    'nor can anonymous visitors');

  raise notice 'B&B stays: all assertions passed';
end $$;
