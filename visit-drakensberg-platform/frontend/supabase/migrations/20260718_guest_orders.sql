-- ============================================================================
-- Visit Drakensberg — Guest Orders for Manual Invoicing
-- Run AFTER 20260716_order_management.sql.
--
-- Lets staff raise invoices for walk-in / phone customers who have no
-- account: user_id becomes nullable across the financial tables, and
-- vd_create_order accepts a "guest" order (admin-only) that carries the
-- customer's name, email and phone on the order itself.
--
-- Also hardens vd_record_order_payment / vd_cancel_order: the ownership
-- check now uses IS DISTINCT FROM so a NULL user_id (guest order) can never
-- slip past the authorisation test — guest orders are staff-managed only.
-- ============================================================================

alter table vd_orders         alter column user_id drop not null;
alter table vd_order_lines    alter column user_id drop not null;
alter table vd_invoices       alter column user_id drop not null;
alter table vd_receipts       alter column user_id drop not null;
alter table vd_order_payments alter column user_id drop not null;

-- ────────────────────────────────────────────────────────────────────────────
-- vd_create_order: add guest support. A guest order (p_order.guest = true)
-- has no user account — only admins (or the migration context) may create
-- one, and only staff can see it (the customer-facing RLS policies match on
-- user_id, which stays NULL).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_create_order(
  p_order         jsonb,
  p_lines         jsonb,
  p_invoice_lines jsonb default null,
  p_payment       jsonb default null,
  p_user_id       uuid  default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_guest boolean := coalesce((p_order->>'guest')::boolean, false);
  v_order_id text := 'vdo-' || gen_random_uuid();
  v_order_number text := vd_next_number('VD');
  v_invoice_id text := 'inv-' || gen_random_uuid();
  v_invoice_number text := vd_next_number('INV');
  v_currency text := coalesce(p_order->>'currency', (select value #>> '{}' from vd_finance_settings where key = 'default_currency'), 'ZAR');
  v_destination text := coalesce(p_order->>'destination', (select value #>> '{}' from vd_finance_settings where key = 'default_destination'), 'drakensberg');
  v_vat_rate numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'vat_rate'), 0.15);
  v_default_commission numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'default_commission_rate'), 0.12);
  v_subtotal numeric := coalesce((p_order->>'subtotal')::numeric, 0);
  v_service_fee numeric := coalesce((p_order->>'serviceFee')::numeric, 0);
  v_tax numeric := coalesce((p_order->>'taxAmount')::numeric, 0);
  v_total numeric := coalesce((p_order->>'total')::numeric, v_subtotal + v_service_fee + v_tax);
  v_line jsonb;
  v_supplier uuid;
  v_supplier_name text;
  v_gross numeric; v_discount numeric; v_net numeric;
  v_comm_rate numeric; v_comm numeric; v_pfee_rate numeric; v_pfee numeric;
  v_supplier_share numeric; v_platform_share numeric;
  v_sum_supplier numeric := 0;
  v_sum_commission numeric := 0;
  v_sum_platform numeric := 0;
  v_journal uuid := gen_random_uuid();
  v_platform_revenue numeric;
  v_inv_lines jsonb;
  v_customer_name text := coalesce(p_order->>'customerName', '');
  v_line_id text;
begin
  if v_guest then
    -- Guest orders carry customer contact details on the order row itself
    -- and belong to no user account. Staff-only.
    if auth.uid() is not null and not is_admin() then
      raise exception 'admin only for guest orders';
    end if;
    v_user := null;
  elsif p_user_id is not null and (auth.uid() is null or is_admin()) then
    v_user := p_user_id;
  elsif auth.uid() is not null then
    v_user := auth.uid();
  else
    raise exception 'authentication required';
  end if;

  insert into vd_orders (
    id, order_number, user_id, booking_id, customer_name, customer_email,
    trip_name, destination, currency, tax_rate, travel_start, travel_end,
    subtotal, service_fee, tax_amount, total_value, deposit_amount,
    amount_paid, outstanding_balance, value
  ) values (
    v_order_id, v_order_number, v_user, p_order->>'bookingId',
    v_customer_name, coalesce(p_order->>'customerEmail', ''),
    coalesce(p_order->>'tripName', ''), v_destination, v_currency, v_vat_rate,
    vd_safe_date(p_order->>'travelStart'), vd_safe_date(p_order->>'travelEnd'),
    v_subtotal, v_service_fee, v_tax, v_total,
    coalesce((p_order->>'depositAmount')::numeric, 0),
    0, v_total, coalesce(p_order->'value', '{}'::jsonb)
  );

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_supplier := case when coalesce(v_line->>'supplierId','') ~ '^[0-9a-f]{8}-'
                       then (v_line->>'supplierId')::uuid else null end;
    v_supplier_name := coalesce(nullif(v_line->>'supplierName',''),
                                case when v_supplier is null then 'Visit Drakensberg' else 'Supplier' end);
    v_gross := coalesce((v_line->>'grossAmount')::numeric,
                        coalesce((v_line->>'unitPrice')::numeric,0) * coalesce((v_line->>'quantity')::numeric,1));
    v_discount := coalesce((v_line->>'discountAmount')::numeric, 0);
    v_net := greatest(v_gross - v_discount, 0);

    if v_supplier is not null then
      select coalesce(t.commission_rate, nullif(v_line->>'commissionRate','')::numeric, v_default_commission),
             coalesce(t.platform_fee_rate, 0)
        into v_comm_rate, v_pfee_rate
        from (select 1) x
        left join vd_supplier_terms t on t.supplier_id = v_supplier;
      v_comm_rate := coalesce(v_comm_rate, v_default_commission);
      v_pfee_rate := coalesce(v_pfee_rate, 0);
      v_comm := round(v_net * v_comm_rate, 2);
      v_pfee := round(v_net * v_pfee_rate, 2);
      v_supplier_share := v_net - v_comm - v_pfee;
      v_platform_share := v_comm + v_pfee;
    else
      v_comm_rate := 0; v_comm := 0; v_pfee := 0;
      v_supplier_share := 0;
      v_platform_share := v_net;
    end if;

    v_line_id := 'vdl-' || gen_random_uuid();
    insert into vd_order_lines (
      id, order_id, order_number, user_id, supplier_id, supplier_name,
      category, product_id, title, service_date, end_date, guests,
      quantity, unit_label, unit_price, gross_amount, discount_amount,
      tax_amount, commission_rate, commission_amount, service_fee,
      platform_fee, supplier_share, platform_share,
      share_customer_name, customer_name, currency, destination, value
    ) values (
      v_line_id, v_order_id, v_order_number, v_user, v_supplier, v_supplier_name,
      coalesce(v_line->>'category', 'extra'), v_line->>'productId',
      coalesce(v_line->>'title', 'Service'),
      vd_safe_date(v_line->>'serviceDate'), vd_safe_date(v_line->>'endDate'),
      nullif(v_line->>'guests','')::int,
      coalesce((v_line->>'quantity')::numeric, 1),
      coalesce(v_line->>'unitLabel', 'unit'),
      coalesce((v_line->>'unitPrice')::numeric, 0),
      v_gross, v_discount,
      round(v_net * v_vat_rate, 2),
      v_comm_rate, v_comm, 0, v_pfee, v_supplier_share, v_platform_share,
      coalesce((v_line->>'shareCustomerName')::boolean, true),
      case when coalesce((v_line->>'shareCustomerName')::boolean, true) then v_customer_name else '' end,
      v_currency, v_destination, coalesce(v_line->'value', '{}'::jsonb)
    );

    if v_supplier is not null then
      v_sum_supplier := v_sum_supplier + v_supplier_share;
      v_sum_commission := v_sum_commission + v_comm;
      v_sum_platform := v_sum_platform + v_pfee;
    else
      v_sum_platform := v_sum_platform + v_platform_share;
    end if;
  end loop;

  v_inv_lines := coalesce(p_invoice_lines, (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', l->>'title',
      'category', coalesce(l->>'category','extra'),
      'quantity', coalesce((l->>'quantity')::numeric, 1),
      'unitLabel', coalesce(l->>'unitLabel','unit'),
      'unitPrice', coalesce((l->>'unitPrice')::numeric, 0),
      'total', coalesce((l->>'grossAmount')::numeric,
                        coalesce((l->>'unitPrice')::numeric,0) * coalesce((l->>'quantity')::numeric,1))
               - coalesce((l->>'discountAmount')::numeric, 0)
    )), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
  ));

  insert into vd_invoices (
    id, invoice_number, order_id, user_id, currency,
    subtotal, service_fee, tax_amount, total, amount_paid, balance, lines
  ) values (
    v_invoice_id, v_invoice_number, v_order_id, v_user, v_currency,
    v_subtotal, v_service_fee, v_tax, v_total, 0, v_total, v_inv_lines
  );

  v_platform_revenue := v_total - v_sum_supplier - v_sum_commission - v_service_fee - v_tax;
  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
    (v_journal, '1100', v_order_id, v_total, 0, 'Order ' || v_order_number || ' — customer receivable');
  if v_sum_supplier <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2000', v_order_id, 0, v_sum_supplier, 'Order ' || v_order_number || ' — supplier payable');
  end if;
  if v_sum_commission <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4100', v_order_id, 0, v_sum_commission, 'Order ' || v_order_number || ' — commission revenue');
  end if;
  if v_service_fee <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4200', v_order_id, 0, v_service_fee, 'Order ' || v_order_number || ' — service fee');
  end if;
  if v_tax <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2200', v_order_id, 0, v_tax, 'Order ' || v_order_number || ' — VAT');
  end if;
  if v_platform_revenue <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4000', v_order_id, 0, v_platform_revenue, 'Order ' || v_order_number || ' — platform revenue');
  end if;

  perform vd_audit('order.created', 'order', v_order_id,
    jsonb_build_object('orderNumber', v_order_number, 'total', v_total, 'guest', v_guest,
                       'lines', jsonb_array_length(coalesce(p_lines,'[]'::jsonb))));

  if p_payment is not null and coalesce((p_payment->>'amount')::numeric, 0) > 0 then
    perform vd_record_order_payment(
      v_order_id,
      (p_payment->>'amount')::numeric,
      coalesce(p_payment->>'type', 'payment'),
      coalesce(p_payment->>'method', 'card'),
      coalesce(p_payment->>'reference', ''),
      ''
    );
  end if;

  return jsonb_build_object('orderId', v_order_id, 'orderNumber', v_order_number,
                            'invoiceId', v_invoice_id, 'invoiceNumber', v_invoice_number);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Null-safe ownership checks: IS DISTINCT FROM means a NULL user_id (guest
-- order) fails the ownership test and therefore requires the finance role.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_record_order_payment(
  p_order_id text, p_amount numeric, p_type text default 'payment',
  p_method text default 'card', p_reference text default '', p_notes text default ''
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order vd_orders%rowtype;
  v_payment_id text := 'pay-' || gen_random_uuid();
  v_receipt_id text := 'rcpt-' || gen_random_uuid();
  v_invoice vd_invoices%rowtype;
  v_journal uuid := gen_random_uuid();
  v_direction text := case when p_type in ('refund') then 'out' else 'in' end;
  v_paid numeric; v_refund numeric; v_status text;
begin
  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if auth.uid() is not null and v_order.user_id is distinct from auth.uid() and not is_finance() then
    raise exception 'not allowed';
  end if;
  if auth.uid() is not null and not is_finance()
     and (v_direction = 'out' or p_method in ('cash','offline')) then
    raise exception 'finance role required';
  end if;

  insert into vd_order_payments (id, order_id, user_id, direction, type, method, amount, currency, reference, notes, created_by)
  values (v_payment_id, p_order_id, v_order.user_id, v_direction, p_type, p_method, p_amount, v_order.currency, p_reference, p_notes, auth.uid());

  if v_direction = 'in' then
    v_paid := v_order.amount_paid + p_amount;
    v_refund := v_order.refund_balance;
  else
    v_paid := v_order.amount_paid;
    v_refund := greatest(v_order.refund_balance - p_amount, 0);
  end if;

  v_status := case
    when v_direction = 'out' then (case when v_refund <= 0 then 'refunded' else v_order.payment_status end)
    when v_paid >= v_order.total_value then 'paid'
    when p_type = 'deposit' then 'deposit'
    when v_paid > 0 then 'partial'
    else 'unpaid' end;

  update vd_orders set
    amount_paid = v_paid,
    outstanding_balance = greatest(total_value - v_paid, 0),
    refund_balance = v_refund,
    payment_status = v_status,
    updated_at = now()
  where id = p_order_id;

  select * into v_invoice from vd_invoices where order_id = p_order_id order by issued_at limit 1;
  if found and v_direction = 'in' then
    update vd_invoices set
      amount_paid = amount_paid + p_amount,
      balance = greatest(total - (amount_paid + p_amount), 0),
      status = case when amount_paid + p_amount >= total then 'paid'
                    when amount_paid + p_amount > 0 then 'partial' else status end,
      updated_at = now()
    where id = v_invoice.id;
  elsif found and v_direction = 'out' then
    update vd_invoices set status = case when v_refund <= 0 then 'refunded' else status end, updated_at = now()
    where id = v_invoice.id;
  end if;

  insert into vd_receipts (id, receipt_number, payment_id, invoice_id, order_id, user_id, amount, method, currency)
  values (v_receipt_id, vd_next_number('RCP'), v_payment_id, v_invoice.id, p_order_id, v_order.user_id,
          case when v_direction = 'out' then -p_amount else p_amount end, p_method, v_order.currency);

  if v_direction = 'in' then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '1000', p_order_id, p_amount, 0, initcap(p_type) || ' received — ' || v_order.order_number),
      (v_journal, '1100', p_order_id, 0, p_amount, initcap(p_type) || ' received — ' || v_order.order_number);
  else
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '2100', p_order_id, p_amount, 0, 'Refund paid — ' || v_order.order_number),
      (v_journal, '1000', p_order_id, 0, p_amount, 'Refund paid — ' || v_order.order_number);
  end if;

  if v_status = 'paid' then
    update vd_order_lines set payment_status = 'paid', updated_at = now()
    where order_id = p_order_id and payment_status <> 'refunded';
  elsif v_status in ('partial', 'deposit') then
    update vd_order_lines set payment_status = 'partial', updated_at = now()
    where order_id = p_order_id and payment_status = 'unpaid';
  end if;

  perform vd_audit('payment.' || p_type, 'order', p_order_id,
    jsonb_build_object('paymentId', v_payment_id, 'amount', p_amount, 'method', p_method, 'direction', v_direction));

  return v_payment_id;
end;
$$;

create or replace function public.vd_cancel_order(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order vd_orders%rowtype;
  v_journal uuid := gen_random_uuid();
  v_sum_supplier numeric; v_sum_commission numeric; v_platform numeric;
begin
  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then return; end if;
  if auth.uid() is not null and v_order.user_id is distinct from auth.uid() and not is_finance() then
    raise exception 'not allowed';
  end if;
  if v_order.booking_status = 'cancelled' then return; end if;

  select coalesce(sum(supplier_share), 0), coalesce(sum(commission_amount), 0)
    into v_sum_supplier, v_sum_commission
    from vd_order_lines
   where order_id = p_order_id and settlement_status in ('unsettled', 'allocated');

  v_platform := v_order.total_value - v_sum_supplier - v_sum_commission - v_order.service_fee - v_order.tax_amount;
  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
    (v_journal, '1100', p_order_id, 0, v_order.total_value, 'Order ' || v_order.order_number || ' cancelled');
  if v_sum_supplier <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2000', p_order_id, v_sum_supplier, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_sum_commission <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4100', p_order_id, v_sum_commission, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_order.service_fee <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4200', p_order_id, v_order.service_fee, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_order.tax_amount <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2200', p_order_id, v_order.tax_amount, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_platform <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4000', p_order_id, v_platform, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;

  if v_order.amount_paid > 0 then
    v_journal := gen_random_uuid();
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '1100', p_order_id, v_order.amount_paid, 0, 'Order ' || v_order.order_number || ' — reinstate receivable for refund'),
      (v_journal, '2100', p_order_id, 0, v_order.amount_paid, 'Order ' || v_order.order_number || ' — refund liability');
  end if;

  update vd_orders set
    booking_status = 'cancelled', trip_status = 'cancelled',
    financial_status = case when amount_paid > 0 then 'open' else 'closed' end,
    refund_balance = amount_paid,
    outstanding_balance = 0,
    updated_at = now()
  where id = p_order_id;

  update vd_order_lines set fulfilment_status = 'cancelled', updated_at = now()
  where order_id = p_order_id and settlement_status in ('unsettled', 'allocated');

  update vd_invoices set status = 'void', updated_at = now() where order_id = p_order_id;

  perform vd_audit('order.cancelled', 'order', p_order_id,
    jsonb_build_object('refundBalance', v_order.amount_paid));
end;
$$;
