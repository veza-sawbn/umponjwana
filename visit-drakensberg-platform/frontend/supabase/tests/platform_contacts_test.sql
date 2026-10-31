-- ============================================================================
-- vd_contacts — the platform contact book behind the New Invoice picker.
-- See supabase/migrations/20261031_platform_contacts.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_customer uuid;
  v_ops      uuid;
  v_supplier uuid;
  v_order    text;
  v_order2   text;
  v_c        vd_contacts%rowtype;
  v_n        int;
  v_id       uuid;
begin
  raise notice 'vd_contacts';

  v_customer := vdtest.make_user('pc-customer@example.test', 'visitor');
  v_ops      := vdtest.make_user('pc-ops@example.test',      'visitor', 'operations');
  v_supplier := vdtest.make_user('pc-supplier@example.test', 'supplier');

  -- ── Registered visitors are in the book; suppliers and staff are not ─────
  perform vdtest.act_as_nobody();
  select * into v_c from vd_contacts where email = 'pc-customer@example.test';
  perform vdtest.ok(found, 'a new visitor account becomes a contact');
  perform vdtest.eq(v_c.user_id, v_customer, 'linked to the account');
  perform vdtest.ok('account' = any(v_c.sources), 'tagged as an account');
  perform vdtest.ok(not exists (select 1 from vd_contacts where email = 'pc-supplier@example.test'),
    'a supplier is not a customer contact');

  -- ── Every invoice adds its customer ───────────────────────────────────────
  v_order := vdtest.make_order(null, 1200);   -- a guest invoice
  update vd_orders set customer_name = 'Walk In', customer_email = 'Walk.In@Example.test',
                       value = '{"customerPhone":"+27 82 111 2222"}'
   where id = v_order;
  -- make_order wrote the customer before the update, so the invoice trigger
  -- filed the fixture's default customer; the update trigger files the real one.
  select * into v_c from vd_contacts where email = 'walk.in@example.test';
  perform vdtest.ok(found, 'a corrected invoiced customer is filed under their email, lower-cased');
  perform vdtest.eq(v_c.name, 'Walk In', 'with their name');
  perform vdtest.eq(v_c.invoice_count, 1, 'and one invoiced order');

  -- A fresh invoice for a brand-new guest, the way vd_create_order writes it.
  v_order2 := 'vdo-' || gen_random_uuid();
  insert into vd_orders (id, order_number, user_id, customer_name, customer_email, total_value,
                         amount_paid, outstanding_balance, refund_balance, payment_status, booking_status,
                         currency, value)
  values (v_order2, vd_next_number('VDO'), null, 'Nomsa Dlamini', 'nomsa@example.test', 900, 0, 900, 0,
          'unpaid', 'confirmed', 'ZAR', '{"manual":true,"customerPhone":"082 333 4444"}');
  insert into vd_invoices (id, invoice_number, order_id, user_id, currency, subtotal, discount,
                           service_fee, tax_amount, total, amount_paid, balance, status)
  values ('inv-' || gen_random_uuid(), vd_next_number('INV'), v_order2, null, 'ZAR', 900, 0, 0, 0, 900, 0, 900, 'issued');
  select * into v_c from vd_contacts where email = 'nomsa@example.test';
  perform vdtest.ok(found, 'issuing an invoice adds the customer automatically');
  perform vdtest.eq(v_c.phone, '082 333 4444', 'with the phone from the order');
  perform vdtest.ok('invoice' = any(v_c.sources), 'tagged as invoiced');
  perform vdtest.eq(v_c.invoice_count, 1, 'invoice count');

  -- Company details saved on the order afterwards follow.
  update vd_orders set customer_is_company = true, customer_company = 'Dlamini Trading',
                       customer_vat_number = '4111111111' where id = v_order2;
  select * into v_c from vd_contacts where email = 'nomsa@example.test';
  perform vdtest.eq(v_c.company, 'Dlamini Trading', 'company billing follows a correction on the order');
  perform vdtest.ok(v_c.is_company, 'flagged as a company');

  -- ── Imports fill blanks, never overwrite ──────────────────────────────────
  perform vdtest.act_as(v_customer);
  perform vdtest.raises($q$select vd_import_contacts('[{"name":"X","email":"x@example.test"}]')$q$,
    'staff only', 'a customer cannot import contacts');
  perform vdtest.raises($q$select vd_save_contact('{"name":"X","email":"x@example.test"}')$q$,
    'staff only', 'a customer cannot add contacts');

  perform vdtest.act_as(v_ops);
  select vd_import_contacts('[
    {"name":"Someone Else","email":"NOMSA@example.test","phone":"000 000 0000"},
    {"name":"Wix Person","email":"wix@example.test"},
    {"name":"","email":"","phone":"12014864320"},
    {"name":"","email":"","phone":"+1 201 486 4320"},
    {"name":"","email":"","phone":""}
  ]') into v_n;
  perform vdtest.eq(v_n, 4, 'four usable rows filed (the empty one is skipped)');
  select * into v_c from vd_contacts where email = 'nomsa@example.test';
  perform vdtest.eq(v_c.name, 'Nomsa Dlamini', 'an import does not overwrite a name we already have');
  perform vdtest.eq(v_c.phone, '082 333 4444', 'nor a phone number');
  perform vdtest.ok('imported' = any(v_c.sources), 'but is recorded as a source');
  select count(*) into v_n from vd_contacts where phone_digits = '12014864320';
  perform vdtest.eq(v_n, 1, 'a phone-only Wix contact is kept once, matched on its digits');

  -- ── Manual add, and RLS ──────────────────────────────────────────────────
  perform vdtest.raises($q$select vd_save_contact('{"name":"No Way"}')$q$,
    'email or a phone', 'a contact needs some way to reach them');
  perform vdtest.raises($q$select vd_save_contact('{"name":"Bad","email":"not-an-email"}')$q$,
    'not valid', 'a malformed email is refused');
  select vd_save_contact('{"name":"Phone Friend","phone":"+27 83 555 6666"}') into v_id;
  perform vdtest.ok(v_id is not null, 'staff can add a phone-only contact');

  set local role authenticated;
  perform vdtest.act_as(v_ops);
  select count(*) into v_n from vd_contacts;
  perform vdtest.ok(v_n >= 5, 'staff can read the book');
  perform vdtest.act_as(v_customer);
  select count(*) into v_n from vd_contacts;
  perform vdtest.eq(v_n, 0, 'a customer reads nothing — not even their own row');
  perform vdtest.raises($q$insert into vd_contacts (name, email) values ('x', 'y@example.test')$q$,
    'row-level security|permission denied', 'nobody writes to the table directly');
  reset role;
end $$;
