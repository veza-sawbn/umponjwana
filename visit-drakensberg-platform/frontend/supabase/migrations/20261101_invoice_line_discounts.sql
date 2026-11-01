-- ============================================================================
-- Visit Drakensberg — Per-line discounts on invoices (bundled packages)
-- Run AFTER 20261031_platform_contacts.sql.
--
-- An admin raising an invoice for a bundled package (e.g. Umphafa Berg Tours'
-- Northern Mini Traverse, with the shuttle from the end point back to the
-- start included) can now add every component as its own line and discount
-- or fully write off the included ones. Each line still routes its booking to
-- its own supplier, so the transport operator receives the shuttle, and the
-- customer's invoice shows each item's full price, what was taken off, and
-- what the package saves them.
--
-- vd_order_lines.discount_amount already existed but nothing could set it.
-- This adds, per line:
--   discount_funded_by   'supplier'  the supplier's payout is worked out on the
--                                    discounted price (the existing behaviour;
--                                    a fully written-off line pays them R0)
--                        'platform'  the supplier is paid on the full price
--                                    and Visit Drakensberg absorbs the
--                                    discount, booked to the new 5100 account
--   discount_reason      shown to the customer beside the discount, e.g.
--                        "Included in the Northern Mini Traverse package"
--
-- Only staff (is_admin) may discount a line. Until now vd_create_order took a
-- discountAmount from any caller, checkout included; it is now refused
-- unless it is zero. A discount can't be negative or exceed the line's price.
--
-- Both order functions are redefined from 20260805_admin_fee_tax_override.sql
-- (the latest version in this repository). NOTE: production was still running
-- the 20260803 versions even though the ledger lists 20260805 as applied, so
-- applying this also brings in 20260805's admin service-fee / VAT overrides
-- and per-line VAT that follows the invoice's actual tax.
-- ============================================================================
-- @rollback: additive columns; the functions can be restored from 20260805_admin_fee_tax_override.sql

alter table vd_order_lines
  add column if not exists discount_funded_by text not null default 'supplier'
    check (discount_funded_by in ('supplier', 'platform'));
alter table vd_order_lines
  add column if not exists discount_reason text not null default '';

insert into vd_ledger_accounts (code, name, type) values
  ('5100', 'Package Discounts (platform-funded)', 'expense')
on conflict (code) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- The discount a line asks for, validated. Internal.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_line_discount(p_line jsonb, p_gross numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_discount numeric;
  v_title    text := coalesce(nullif(p_line->>'title', ''), 'a line');
begin
  begin
    v_discount := round(coalesce(nullif(p_line->>'discountAmount', '')::numeric, 0), 2);
  exception when others then
    raise exception 'the discount on "%" is not a number', v_title;
  end;
  if v_discount = 0 then return 0; end if;
  if not coalesce(is_admin(), false) then
    raise exception 'only staff can discount a line';
  end if;
  if v_discount < 0 then raise exception 'the discount on "%" cannot be negative', v_title; end if;
  if v_discount > coalesce(p_gross, 0) then
    raise exception 'the discount on "%" is more than its price', v_title;
  end if;
  return v_discount;
end;
$$;
revoke all on function public.vd_line_discount(jsonb, numeric) from public, anon, authenticated;

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
  v_service_fee_rate numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'service_fee_rate'), 0.12);
  v_default_commission numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'default_commission_rate'), 0.12);
  v_booking_status text := coalesce(nullif(p_order->>'bookingStatus', ''), 'confirmed');
  v_line jsonb;
  v_priced_lines jsonb := '[]'::jsonb;
  v_canonical numeric;
  v_supplier uuid;
  v_supplier_name text;
  v_gross numeric; v_discount numeric; v_net numeric;
  v_comm_rate numeric; v_comm numeric; v_pfee_rate numeric; v_pfee numeric;
  v_supplier_share numeric; v_platform_share numeric;
  v_funded text; v_reason text; v_basis numeric;
  v_platform_discount numeric := 0;
  v_sum_supplier numeric := 0;
  v_sum_commission numeric := 0;
  v_sum_platform numeric := 0;
  v_journal uuid := gen_random_uuid();
  v_platform_revenue numeric;
  v_inv_lines jsonb;
  v_customer_name text := coalesce(p_order->>'customerName', '');
  v_line_id text;
  v_subtotal numeric := 0;
  v_service_fee numeric;
  v_tax numeric;
  v_total numeric;
  v_effective_vat numeric;
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

  -- Pass 1: re-price every opted-in line (validatePrice=true — set only by
  -- checkout's buildOrderLinesFromBooking, never by package-bookings.ts or
  -- the admin manual-invoice UI, both of which intentionally price lines at
  -- internal cost rather than retail) from its canonical vd_entities row
  -- where one exists (accommodation/activity/hike/tour/event), overwriting
  -- the client-submitted unitPrice/grossAmount so the client can no longer
  -- control what it's charged for those categories. Lines with no canonical
  -- row (shuttles, legacy fixture tour-dates) or not opted in keep their
  -- submitted amount — a known, separate follow-up (see header). The order
  -- subtotal is then the sum of these corrected line amounts, never a
  -- client-supplied number.
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    if coalesce((v_line->>'validatePrice')::boolean, false) then
      v_canonical := vd_canonical_unit_price(v_line->>'category', v_line->>'productId', v_line->'value'->>'roomId');
    else
      v_canonical := null;
    end if;
    if v_canonical is not null and v_canonical >= 0 then
      v_gross := v_canonical * coalesce((v_line->>'quantity')::numeric, 1);
      v_line := v_line || jsonb_build_object('unitPrice', v_canonical, 'grossAmount', v_gross);
    else
      v_gross := coalesce((v_line->>'grossAmount')::numeric,
                          coalesce((v_line->>'unitPrice')::numeric,0) * coalesce((v_line->>'quantity')::numeric,1));
    end if;
    v_discount := vd_line_discount(v_line, v_gross);
    v_subtotal := v_subtotal + (v_gross - v_discount);
    v_priced_lines := v_priced_lines || jsonb_build_array(v_line);
  end loop;

  -- Fee/VAT rates are always server-owned (vd_finance_settings), never the
  -- client's own calculation — total is fully derived, never trusted.
  v_service_fee := round(v_subtotal * v_service_fee_rate, 2);
  -- Staff raising a manual invoice have the final say on fees and VAT — a
  -- zero-rated booking, a waived service fee, a negotiated figure. Everyone
  -- else, checkout above all, always gets the server-derived amount, so a
  -- client still cannot zero out what it is charged.
  if is_admin() and nullif(p_order->>'serviceFeeOverride', '') is not null then
    v_service_fee := round((p_order->>'serviceFeeOverride')::numeric, 2);
  end if;
  v_tax := round((v_subtotal + v_service_fee) * v_vat_rate, 2);
  if is_admin() and nullif(p_order->>'taxOverride', '') is not null then
    v_tax := round((p_order->>'taxOverride')::numeric, 2);
  end if;
  v_total := v_subtotal + v_service_fee + v_tax;
  -- Per-line VAT has to follow the invoice's actual tax, not the configured
  -- rate, or an overridden (e.g. zero-rated) invoice would still carry tax on
  -- every line and the ledger would disagree with the document.
  v_effective_vat := case when (v_subtotal + v_service_fee) > 0
                          then v_tax / (v_subtotal + v_service_fee) else 0 end;

  insert into vd_orders (
    id, order_number, user_id, booking_id, customer_name, customer_email,
    trip_name, destination, currency, tax_rate, travel_start, travel_end,
    subtotal, service_fee, tax_amount, total_value, deposit_amount,
    amount_paid, outstanding_balance, booking_status, value
  ) values (
    v_order_id, v_order_number, v_user, p_order->>'bookingId',
    v_customer_name, coalesce(p_order->>'customerEmail', ''),
    coalesce(p_order->>'tripName', ''), v_destination, v_currency, v_effective_vat,
    vd_safe_date(p_order->>'travelStart'), vd_safe_date(p_order->>'travelEnd'),
    v_subtotal, v_service_fee, v_tax, v_total,
    coalesce((p_order->>'depositAmount')::numeric, 0),
    0, v_total, v_booking_status, coalesce(p_order->'value', '{}'::jsonb)
  );

  -- Pass 2: insert lines + supplier allocation from the already-repriced
  -- v_priced_lines, so nothing here re-derives price independently.
  for v_line in select * from jsonb_array_elements(v_priced_lines) loop
    v_supplier := case when coalesce(v_line->>'supplierId','') ~ '^[0-9a-f]{8}-'
                       then (v_line->>'supplierId')::uuid else null end;
    v_supplier_name := coalesce(nullif(v_line->>'supplierName',''),
                                case when v_supplier is null then 'Visit Drakensberg' else 'Supplier' end);
    v_gross := coalesce((v_line->>'grossAmount')::numeric,
                        coalesce((v_line->>'unitPrice')::numeric,0) * coalesce((v_line->>'quantity')::numeric,1));
    v_discount := vd_line_discount(v_line, v_gross);
    v_net := v_gross - v_discount;
    -- Who carries a discount: the supplier (their payout is worked out on
    -- the discounted price, as before) or Visit Drakensberg (the supplier is
    -- paid on the full price and the platform absorbs the difference).
    v_funded := case when v_discount > 0 and v_line->>'discountFundedBy' = 'platform'
                     then 'platform' else 'supplier' end;
    v_reason := case when v_discount > 0 then left(btrim(coalesce(v_line->>'discountReason', '')), 200) else '' end;

    if v_supplier is not null then
      select coalesce(t.commission_rate, nullif(v_line->>'commissionRate','')::numeric, v_default_commission),
             coalesce(t.platform_fee_rate, 0)
        into v_comm_rate, v_pfee_rate
        from (select 1) x
        left join vd_supplier_terms t on t.supplier_id = v_supplier;
      v_comm_rate := coalesce(v_comm_rate, v_default_commission);
      v_pfee_rate := coalesce(v_pfee_rate, 0);
      v_basis := case when v_funded = 'platform' then v_gross else v_net end;
      v_comm := round(v_basis * v_comm_rate, 2);
      v_pfee := round(v_basis * v_pfee_rate, 2);
      v_supplier_share := v_basis - v_comm - v_pfee;
      v_platform_share := v_net - v_supplier_share;
    else
      v_comm_rate := 0; v_comm := 0; v_pfee := 0;
      v_supplier_share := 0;
      v_platform_share := v_net;
    end if;

    v_line_id := 'vdl-' || gen_random_uuid();
    insert into vd_order_lines (
      id, order_id, order_number, user_id, supplier_id, supplier_name,
      category, product_id, title, description, service_date, end_date, guests,
      quantity, unit_label, unit_price, gross_amount, discount_amount,
      tax_amount, commission_rate, commission_amount, service_fee,
      platform_fee, supplier_share, platform_share,
      share_customer_name, customer_name, currency, destination, value,
      discount_funded_by, discount_reason
    ) values (
      v_line_id, v_order_id, v_order_number, v_user, v_supplier, v_supplier_name,
      coalesce(v_line->>'category', 'extra'), v_line->>'productId',
      coalesce(v_line->>'title', 'Service'),
      coalesce(v_line->>'description', ''),
      vd_safe_date(v_line->>'serviceDate'), vd_safe_date(v_line->>'endDate'),
      nullif(v_line->>'guests','')::int,
      coalesce((v_line->>'quantity')::numeric, 1),
      coalesce(v_line->>'unitLabel', 'unit'),
      coalesce((v_line->>'unitPrice')::numeric, 0),
      v_gross, v_discount,
      round(v_net * v_effective_vat, 2),
      v_comm_rate, v_comm, 0, v_pfee, v_supplier_share, v_platform_share,
      coalesce((v_line->>'shareCustomerName')::boolean, true),
      case when coalesce((v_line->>'shareCustomerName')::boolean, true) then v_customer_name else '' end,
      v_currency, v_destination, coalesce(v_line->'value', '{}'::jsonb),
      v_funded, v_reason
    );

    if v_supplier is not null then
      v_sum_supplier := v_sum_supplier + v_supplier_share;
      v_sum_commission := v_sum_commission + v_comm;
      v_sum_platform := v_sum_platform + v_pfee;
      if v_funded = 'platform' then
        v_platform_discount := v_platform_discount + v_discount;
      end if;
    else
      v_sum_platform := v_sum_platform + v_platform_share;
    end if;
  end loop;

  v_inv_lines := coalesce(p_invoice_lines, (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', l->>'title',
      'description', coalesce(l->>'description',''),
      'category', coalesce(l->>'category','extra'),
      'quantity', coalesce((l->>'quantity')::numeric, 1),
      'unitLabel', coalesce(l->>'unitLabel','unit'),
      'unitPrice', coalesce((l->>'unitPrice')::numeric, 0),
      'total', coalesce((l->>'grossAmount')::numeric,
                        coalesce((l->>'unitPrice')::numeric,0) * coalesce((l->>'quantity')::numeric,1))
               - coalesce((l->>'discountAmount')::numeric, 0),
      'grossTotal', coalesce((l->>'grossAmount')::numeric,
                             coalesce((l->>'unitPrice')::numeric,0) * coalesce((l->>'quantity')::numeric,1)),
      'discount', coalesce((l->>'discountAmount')::numeric, 0),
      'discountLabel', coalesce(l->>'discountReason', '')
    )), '[]'::jsonb)
    from jsonb_array_elements(v_priced_lines) l
  ));

  insert into vd_invoices (
    id, invoice_number, order_id, user_id, currency,
    subtotal, service_fee, tax_amount, total, amount_paid, balance, lines
  ) values (
    v_invoice_id, v_invoice_number, v_order_id, v_user, v_currency,
    v_subtotal, v_service_fee, v_tax, v_total, 0, v_total, v_inv_lines
  );

  -- Platform-funded discounts are a cost, booked to 5100, which the platform's
  -- revenue line carries on the other side of the journal.
  v_platform_revenue := v_total - v_sum_supplier - v_sum_commission - v_service_fee - v_tax + v_platform_discount;
  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
    (v_journal, '1100', v_order_id, v_total, 0, 'Order ' || v_order_number || ' — customer receivable');
  if v_platform_discount <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '5100', v_order_id, v_platform_discount, 0, 'Order ' || v_order_number || ' — package discounts funded by Visit Drakensberg');
  end if;
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
    values (v_journal, '4000', v_order_id, greatest(-v_platform_revenue, 0), greatest(v_platform_revenue, 0), 'Order ' || v_order_number || ' — platform revenue');
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

grant execute on function public.vd_create_order(jsonb, jsonb, jsonb, jsonb, uuid) to authenticated;


create or replace function public.vd_update_order(
  p_order_id      text,
  p_order         jsonb,
  p_lines         jsonb,
  p_invoice_lines jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order vd_orders%rowtype;
  v_invoice_id text;
  v_invoice_number text;
  v_paid numeric;
  v_currency text;
  v_vat_rate numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'vat_rate'), 0.15);
  v_service_fee_rate numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'service_fee_rate'), 0.12);
  v_default_commission numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'default_commission_rate'), 0.12);
  v_line jsonb;
  v_supplier uuid;
  v_supplier_name text;
  v_gross numeric; v_discount numeric; v_net numeric;
  v_comm_rate numeric; v_comm numeric; v_pfee_rate numeric; v_pfee numeric;
  v_supplier_share numeric; v_platform_share numeric;
  v_funded text; v_reason text; v_basis numeric;
  v_platform_discount numeric := 0;
  v_sum_supplier numeric := 0;
  v_sum_commission numeric := 0;
  v_sum_platform numeric := 0;
  v_subtotal numeric := 0;
  v_service_fee numeric;
  v_tax numeric;
  v_total numeric;
  v_journal uuid := gen_random_uuid();
  v_reversal uuid := gen_random_uuid();
  v_platform_revenue numeric;
  v_inv_lines jsonb;
  v_customer_name text;
  v_line_id text;
  v_effective_vat numeric;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  select * into v_order from vd_orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;

  -- Amounts are frozen once money has moved in either direction: the customer
  -- already holds a receipt for the old figures, so a correction has to be a
  -- credit note rather than a silent rewrite.
  select coalesce(count(*), 0) into v_paid from vd_order_payments where order_id = p_order_id;
  if v_paid > 0 or coalesce(v_order.amount_paid, 0) <> 0 then
    raise exception 'order % has payments recorded — amounts are locked', v_order.order_number;
  end if;
  if v_order.booking_status = 'cancelled' then
    raise exception 'order % is cancelled', v_order.order_number;
  end if;

  select id, invoice_number into v_invoice_id, v_invoice_number
    from vd_invoices where order_id = p_order_id order by issued_at limit 1;

  v_currency := coalesce(p_order->>'currency', v_order.currency, 'ZAR');
  v_customer_name := coalesce(p_order->>'customerName', v_order.customer_name, '');

  -- Pass 1: price every line. Manual invoices never opt into canonical
  -- re-pricing (see vd_create_order), so submitted amounts stand.
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_gross := coalesce((v_line->>'grossAmount')::numeric,
                        coalesce((v_line->>'unitPrice')::numeric,0) * coalesce((v_line->>'quantity')::numeric,1));
    v_discount := vd_line_discount(v_line, v_gross);
    v_subtotal := v_subtotal + (v_gross - v_discount);
  end loop;

  v_service_fee := round(v_subtotal * v_service_fee_rate, 2);
  -- Same admin override as vd_create_order. This function is already
  -- admin-only, so the overrides are simply honoured when supplied.
  if nullif(p_order->>'serviceFeeOverride', '') is not null then
    v_service_fee := round((p_order->>'serviceFeeOverride')::numeric, 2);
  end if;
  v_tax := round((v_subtotal + v_service_fee) * v_vat_rate, 2);
  if nullif(p_order->>'taxOverride', '') is not null then
    v_tax := round((p_order->>'taxOverride')::numeric, 2);
  end if;
  v_total := v_subtotal + v_service_fee + v_tax;
  v_effective_vat := case when (v_subtotal + v_service_fee) > 0
                          then v_tax / (v_subtotal + v_service_fee) else 0 end;

  -- Reverse the order's existing journal(s) rather than deleting them, so the
  -- edit leaves an audit trail on both sides.
  insert into vd_ledger_entries (journal_id, account_code, order_id, supplier_id, debit, credit, memo)
  select v_reversal, account_code, order_id, supplier_id, credit, debit,
         'Reversal — order ' || v_order.order_number || ' edited'
    from vd_ledger_entries where order_id = p_order_id;

  delete from vd_order_lines where order_id = p_order_id;

  -- Pass 2: re-insert lines with supplier allocation.
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_supplier := case when coalesce(v_line->>'supplierId','') ~ '^[0-9a-f]{8}-'
                       then (v_line->>'supplierId')::uuid else null end;
    v_supplier_name := coalesce(nullif(v_line->>'supplierName',''),
                                case when v_supplier is null then 'Visit Drakensberg' else 'Supplier' end);
    v_gross := coalesce((v_line->>'grossAmount')::numeric,
                        coalesce((v_line->>'unitPrice')::numeric,0) * coalesce((v_line->>'quantity')::numeric,1));
    v_discount := vd_line_discount(v_line, v_gross);
    v_net := v_gross - v_discount;
    -- Who carries a discount: the supplier (their payout is worked out on
    -- the discounted price, as before) or Visit Drakensberg (the supplier is
    -- paid on the full price and the platform absorbs the difference).
    v_funded := case when v_discount > 0 and v_line->>'discountFundedBy' = 'platform'
                     then 'platform' else 'supplier' end;
    v_reason := case when v_discount > 0 then left(btrim(coalesce(v_line->>'discountReason', '')), 200) else '' end;

    if v_supplier is not null then
      select coalesce(t.commission_rate, nullif(v_line->>'commissionRate','')::numeric, v_default_commission),
             coalesce(t.platform_fee_rate, 0)
        into v_comm_rate, v_pfee_rate
        from (select 1) x
        left join vd_supplier_terms t on t.supplier_id = v_supplier;
      v_comm_rate := coalesce(v_comm_rate, v_default_commission);
      v_pfee_rate := coalesce(v_pfee_rate, 0);
      v_basis := case when v_funded = 'platform' then v_gross else v_net end;
      v_comm := round(v_basis * v_comm_rate, 2);
      v_pfee := round(v_basis * v_pfee_rate, 2);
      v_supplier_share := v_basis - v_comm - v_pfee;
      v_platform_share := v_net - v_supplier_share;
    else
      v_comm_rate := 0; v_comm := 0; v_pfee := 0;
      v_supplier_share := 0;
      v_platform_share := v_net;
    end if;

    v_line_id := 'vdl-' || gen_random_uuid();
    insert into vd_order_lines (
      id, order_id, order_number, user_id, supplier_id, supplier_name,
      category, product_id, title, description, service_date, end_date, guests,
      quantity, unit_label, unit_price, gross_amount, discount_amount,
      tax_amount, commission_rate, commission_amount, service_fee,
      platform_fee, supplier_share, platform_share,
      share_customer_name, customer_name, currency, destination, value,
      discount_funded_by, discount_reason
    ) values (
      v_line_id, p_order_id, v_order.order_number, v_order.user_id, v_supplier, v_supplier_name,
      coalesce(v_line->>'category', 'extra'), v_line->>'productId',
      coalesce(v_line->>'title', 'Service'),
      coalesce(v_line->>'description', ''),
      vd_safe_date(v_line->>'serviceDate'), vd_safe_date(v_line->>'endDate'),
      nullif(v_line->>'guests','')::int,
      coalesce((v_line->>'quantity')::numeric, 1),
      coalesce(v_line->>'unitLabel', 'unit'),
      coalesce((v_line->>'unitPrice')::numeric, 0),
      v_gross, v_discount,
      round(v_net * v_effective_vat, 2),
      v_comm_rate, v_comm, 0, v_pfee, v_supplier_share, v_platform_share,
      coalesce((v_line->>'shareCustomerName')::boolean, true),
      case when coalesce((v_line->>'shareCustomerName')::boolean, true) then v_customer_name else '' end,
      v_currency, v_order.destination, coalesce(v_line->'value', '{}'::jsonb),
      v_funded, v_reason
    );

    if v_supplier is not null then
      v_sum_supplier := v_sum_supplier + v_supplier_share;
      v_sum_commission := v_sum_commission + v_comm;
      v_sum_platform := v_sum_platform + v_pfee;
      if v_funded = 'platform' then
        v_platform_discount := v_platform_discount + v_discount;
      end if;
    else
      v_sum_platform := v_sum_platform + v_platform_share;
    end if;
  end loop;

  update vd_orders set
    customer_name  = v_customer_name,
    customer_email = coalesce(p_order->>'customerEmail', customer_email),
    trip_name      = coalesce(p_order->>'tripName', trip_name),
    currency       = v_currency,
    tax_rate       = v_effective_vat,
    travel_start   = vd_safe_date(p_order->>'travelStart'),
    travel_end     = vd_safe_date(p_order->>'travelEnd'),
    subtotal       = v_subtotal,
    service_fee    = v_service_fee,
    tax_amount     = v_tax,
    total_value    = v_total,
    outstanding_balance = v_total,
    updated_at     = now()
  where id = p_order_id;

  v_inv_lines := coalesce(p_invoice_lines, (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', l->>'title',
      'description', coalesce(l->>'description',''),
      'category', coalesce(l->>'category','extra'),
      'quantity', coalesce((l->>'quantity')::numeric, 1),
      'unitLabel', coalesce(l->>'unitLabel','unit'),
      'unitPrice', coalesce((l->>'unitPrice')::numeric, 0),
      'total', coalesce((l->>'grossAmount')::numeric,
                        coalesce((l->>'unitPrice')::numeric,0) * coalesce((l->>'quantity')::numeric,1))
               - coalesce((l->>'discountAmount')::numeric, 0),
      'grossTotal', coalesce((l->>'grossAmount')::numeric,
                             coalesce((l->>'unitPrice')::numeric,0) * coalesce((l->>'quantity')::numeric,1)),
      'discount', coalesce((l->>'discountAmount')::numeric, 0),
      'discountLabel', coalesce(l->>'discountReason', '')
    )), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
  ));

  update vd_invoices set
    currency    = v_currency,
    subtotal    = v_subtotal,
    service_fee = v_service_fee,
    tax_amount  = v_tax,
    total       = v_total,
    balance     = v_total,
    lines       = v_inv_lines,
    updated_at  = now()
  where id = v_invoice_id;

  -- Platform-funded discounts are a cost, booked to 5100, which the platform's
  -- revenue line carries on the other side of the journal.
  v_platform_revenue := v_total - v_sum_supplier - v_sum_commission - v_service_fee - v_tax + v_platform_discount;
  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
    (v_journal, '1100', p_order_id, v_total, 0, 'Order ' || v_order.order_number || ' — customer receivable (edited)');
  if v_platform_discount <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '5100', p_order_id, v_platform_discount, 0, 'Order ' || v_order.order_number || ' — package discounts funded by Visit Drakensberg');
  end if;
  if v_sum_supplier <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2000', p_order_id, 0, v_sum_supplier, 'Order ' || v_order.order_number || ' — supplier payable');
  end if;
  if v_sum_commission <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4100', p_order_id, 0, v_sum_commission, 'Order ' || v_order.order_number || ' — commission revenue');
  end if;
  if v_service_fee <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4200', p_order_id, 0, v_service_fee, 'Order ' || v_order.order_number || ' — service fee');
  end if;
  if v_tax <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2200', p_order_id, 0, v_tax, 'Order ' || v_order.order_number || ' — VAT');
  end if;
  if v_platform_revenue <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4000', p_order_id, greatest(-v_platform_revenue, 0), greatest(v_platform_revenue, 0), 'Order ' || v_order.order_number || ' — platform revenue');
  end if;

  perform vd_audit('order.edited', 'order', p_order_id,
    jsonb_build_object('orderNumber', v_order.order_number, 'total', v_total,
                       'previousTotal', v_order.total_value,
                       'lines', jsonb_array_length(coalesce(p_lines,'[]'::jsonb))));

  return jsonb_build_object('orderId', p_order_id, 'orderNumber', v_order.order_number,
                            'invoiceId', v_invoice_id, 'invoiceNumber', v_invoice_number);
end;
$$;

grant execute on function public.vd_update_order(text, jsonb, jsonb, jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Re-allocating a line by hand keeps to who funds its discount: a
-- platform-funded line's supplier stays on the full price.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_update_line_allocation(
  p_line_id text, p_commission_rate numeric default null,
  p_platform_fee numeric default null, p_discount numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_line vd_order_lines%rowtype;
  v_discount numeric; v_net numeric; v_basis numeric; v_comm numeric; v_pfee numeric; v_share numeric;
  v_delta numeric; v_journal uuid := gen_random_uuid();
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into v_line from vd_order_lines where id = p_line_id for update;
  if not found then raise exception 'line not found'; end if;
  if v_line.settlement_status in ('allocated','settled') then
    raise exception 'line already in a settlement — reverse it first';
  end if;
  if v_line.supplier_id is null then raise exception 'platform-owned line has no supplier allocation'; end if;

  v_discount := coalesce(p_discount, v_line.discount_amount);
  if v_discount < 0 or v_discount > v_line.gross_amount then
    raise exception 'discount must be between 0 and the line''s price';
  end if;
  v_net := v_line.gross_amount - v_discount;
  v_basis := case when v_line.discount_funded_by = 'platform' then v_line.gross_amount else v_net end;
  v_comm := round(v_basis * coalesce(p_commission_rate, v_line.commission_rate), 2);
  v_pfee := coalesce(p_platform_fee, v_line.platform_fee);
  v_share := v_basis - v_comm - v_pfee;
  if v_share < 0 then raise exception 'allocation exceeds line value'; end if;

  -- Journal for the change in supplier payable (offset to commission revenue)
  v_delta := v_share - v_line.supplier_share;
  if v_delta <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, supplier_id, debit, credit, memo) values
      (v_journal, '2000', v_line.order_id, v_line.supplier_id,
        case when v_delta < 0 then -v_delta else 0 end,
        case when v_delta > 0 then v_delta else 0 end,
        'Allocation adjusted — line ' || v_line.title),
      (v_journal, '4100', v_line.order_id, v_line.supplier_id,
        case when v_delta > 0 then v_delta else 0 end,
        case when v_delta < 0 then -v_delta else 0 end,
        'Allocation adjusted — line ' || v_line.title);
  end if;

  update vd_order_lines set
    commission_rate = coalesce(p_commission_rate, commission_rate),
    commission_amount = v_comm,
    platform_fee = v_pfee,
    discount_amount = v_discount,
    supplier_share = v_share,
    platform_share = v_net - v_share,
    updated_at = now()
  where id = p_line_id;

  perform vd_audit('line.allocation_updated', 'order_line', p_line_id,
    jsonb_build_object('commissionRate', p_commission_rate, 'platformFee', p_platform_fee,
                       'discount', p_discount, 'supplierShareDelta', v_delta));
end;
$$;
grant execute on function public.vd_update_line_allocation(text, numeric, numeric, numeric) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Cancelling an order reverses its platform-funded discounts too. Same as
-- 20260804_guest_orders_repair.sql apart from the 5100 credit (and the 4000
-- reversal that offsets it), so a cancelled package leaves neither a
-- discount expense nor the matching revenue behind.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_cancel_order(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order vd_orders%rowtype;
  v_journal uuid := gen_random_uuid();
  v_sum_supplier numeric; v_sum_commission numeric; v_platform numeric;
  v_platform_discount numeric;
begin
  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then return; end if;
  if auth.uid() is not null and v_order.user_id is distinct from auth.uid() and not is_finance() then
    raise exception 'not allowed';
  end if;
  if v_order.booking_status = 'cancelled' then return; end if;

  select coalesce(sum(supplier_share), 0), coalesce(sum(commission_amount), 0),
         coalesce(sum(discount_amount) filter (where discount_funded_by = 'platform' and supplier_id is not null), 0)
    into v_sum_supplier, v_sum_commission, v_platform_discount
    from vd_order_lines
   where order_id = p_order_id and settlement_status in ('unsettled', 'allocated');

  v_platform := v_order.total_value - v_sum_supplier - v_sum_commission - v_order.service_fee - v_order.tax_amount
                + v_platform_discount;
  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
    (v_journal, '1100', p_order_id, 0, v_order.total_value, 'Order ' || v_order.order_number || ' cancelled');
  if v_platform_discount <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '5100', p_order_id, 0, v_platform_discount, 'Order ' || v_order.order_number || ' cancelled — package discounts reversed');
  end if;
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
    values (v_journal, '4000', p_order_id, greatest(v_platform, 0), greatest(-v_platform, 0),
            'Order ' || v_order.order_number || ' cancelled');
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
