-- ============================================================================
-- vd_update_order_customer — who may edit an order's customer, and what it
-- accepts. See supabase/migrations/20261014_order_customer_details.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_customer uuid;
  v_ops      uuid;
  v_admin    uuid;
  v_order    text;
  v_invoice  text;
  v_row      vd_orders%rowtype;
  v_line     text;
  v_public   jsonb;
  v_audits   int;
  v_supplier uuid;
  v_booking  text := 'bk-' || gen_random_uuid();
  v_bvalue   jsonb;
  v_bovalue  jsonb;
  v_company  jsonb := '{"name":"Thandi Mokoena","email":" Accounts@Acme.CO.ZA ","phone":"+27 82 000 0000",
                        "isCompany":true,"company":"Acme Tours (Pty) Ltd","vatNumber":"4123 456 789",
                        "registrationNumber":"2019/123456/07","address":"1 Main Rd, Bergville, 3350"}';
begin
  raise notice 'vd_update_order_customer';

  v_customer := vdtest.make_user('ocd-customer@example.test', 'visitor');
  v_ops      := vdtest.make_user('ocd-ops@example.test',      'visitor', 'operations');
  v_admin    := vdtest.make_user('ocd-admin@example.test',    'admin');
  v_supplier := vdtest.make_user('ocd-supplier@example.test', 'supplier');

  perform vdtest.act_as_nobody();
  v_order := vdtest.make_order(v_customer, 5000);
  select id into v_invoice from vd_invoices where order_id = v_order;

  -- A checkout order: the booking and the supplier's copy of it each keep
  -- their own snapshot of the contact details. The supplier's copy carries
  -- no phone number, and must not be given one.
  insert into vd_bookings (id, reference, user_id, supplier_ids, value)
  values (v_booking, 'VD-OCD-1', v_customer, array[v_supplier],
          '{"customerName":"Old Name","customerEmail":"old@example.test","customerPhone":"000","checkIn":"2026-11-01"}');
  insert into vd_booking_orders (id, booking_id, reference, supplier_id, user_id, value)
  values ('bo-' || gen_random_uuid(), v_booking, 'VD-OCD-1', v_supplier, v_customer,
          '{"customerName":"Old Name","customerEmail":"old@example.test"}');
  update vd_orders set booking_id = v_booking where id = v_order;

  -- ── Who ───────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_customer);
  perform vdtest.raises(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order, v_company),
    'staff only', 'the customer cannot rewrite their own billing details');

  perform vdtest.act_as(v_ops);
  perform vdtest.allows(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order, v_company),
    'operations staff can set company billing details');

  perform vdtest.act_as_nobody();
  select * into v_row from vd_orders where id = v_order;
  perform vdtest.eq(v_row.customer_name, 'Thandi Mokoena', 'name saved');
  perform vdtest.eq(v_row.customer_email, 'accounts@acme.co.za', 'email trimmed and lower-cased');
  perform vdtest.eq(v_row.customer_vat_number, '4123456789', 'VAT number has its spaces removed');
  perform vdtest.eq(v_row.customer_registration_number, '2019/123456/07', 'registration number saved');
  perform vdtest.eq(v_row.customer_company, 'Acme Tours (Pty) Ltd', 'company name saved');
  perform vdtest.ok(v_row.customer_is_company, 'flagged as a company customer');

  select customer_name into v_line from vd_order_lines where order_id = v_order limit 1;
  perform vdtest.eq(v_line, 'Thandi Mokoena', 'the name shared with the supplier follows the change');

  select value into v_bvalue from vd_bookings where id = v_booking;
  perform vdtest.eq(v_bvalue->>'customerPhone', '+27 82 000 0000',
    'the booking snapshot carries the corrected phone (the supplier address book reads it)');
  perform vdtest.eq(v_bvalue->>'checkIn', '2026-11-01', 'the rest of the booking is untouched');
  select value into v_bovalue from vd_booking_orders where booking_id = v_booking;
  perform vdtest.eq(v_bovalue->>'customerEmail', 'accounts@acme.co.za', 'the supplier''s booking copy has the corrected email');
  perform vdtest.eq(v_bovalue->>'customerName', 'Thandi Mokoena', 'and the corrected name');
  perform vdtest.ok(not (v_bovalue ? 'customerPhone'), 'and is not given a phone number it never had');

  select count(*) into v_audits from vd_audit_log where entity_id = v_order and action = 'order.customer_updated';
  perform vdtest.eq(v_audits, 1, 'the change is audited');

  v_public := vd_invoice_public(v_invoice);
  perform vdtest.eq(v_public->'order'->>'customer_vat_number', '4123456789', 'the tax invoice carries the VAT number');
  perform vdtest.eq(v_public->'order'->>'customer_company', 'Acme Tours (Pty) Ltd', 'and the company name');

  -- ── What ──────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  perform vdtest.raises(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order, '{"name":"","email":"a@b.co"}'),
    'name is required', 'a blank name is refused');
  perform vdtest.raises(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order, '{"name":"A","email":"not-an-email"}'),
    'valid customer email', 'a malformed email is refused');
  perform vdtest.raises(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order, '{"name":"A","email":"a@b.co","isCompany":true}'),
    'company name is required', 'a company customer needs a company name');
  perform vdtest.raises(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order,
      '{"name":"A","email":"a@b.co","isCompany":true,"company":"X","vatNumber":"12345"}'),
    '10 digits starting with 4', 'a short all-digit VAT number is refused');
  perform vdtest.allows(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order,
      '{"name":"A","email":"a@b.co","isCompany":true,"company":"X Ltd","vatNumber":"GB123456789"}'),
    'a foreign VAT number is accepted as typed');

  -- Switching back to an individual clears the company details.
  perform vdtest.allows(
    format('select vd_update_order_customer(%L, %L::jsonb)', v_order, '{"name":"Ann Hiker","email":"ann@example.test"}'),
    'switching back to an individual');
  perform vdtest.act_as_nobody();
  select * into v_row from vd_orders where id = v_order;
  perform vdtest.ok(not v_row.customer_is_company and v_row.customer_vat_number = '' and v_row.customer_company = '',
    'an individual keeps no company details');
end $$;
