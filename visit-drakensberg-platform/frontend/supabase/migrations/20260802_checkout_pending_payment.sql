-- ============================================================================
-- Visit Drakensberg — Real payment gate on checkout (iKhokha)
-- Run AFTER 20260724_ikhokha_payments.sql.
--
-- Checkout previously hardcoded every booking as status='confirmed' and
-- self-recorded a "card" payment with no gateway involved (see
-- PRODUCTION_READINESS_REPORT.md, C1). Checkout now creates the booking as
-- status='pending' — inventory-holding but unconfirmed — and only the
-- iKhokha webhook (app/api/payments/ikhokha/webhook/route.ts), after
-- verifying payment with iKhokha's own status API, flips it to 'confirmed'.
--
-- This revision of vd_create_order also closes a second, more serious gap:
-- the customer's cart lives in browser localStorage, and vd_create_order
-- previously trusted p_order->>'subtotal'/'serviceFee'/'taxAmount'/'total'
-- and each line's unitPrice/grossAmount verbatim — a tampered cart could
-- book a real stay/activity/tour/event and pay iKhokha almost nothing for
-- it. vd_create_order now recomputes each line's price from its canonical
-- vd_entities row (room/activity/departure/supplier_events) via the new
-- vd_canonical_unit_price() helper wherever one exists, derives the order
-- subtotal as the sum of those (corrected) line amounts rather than a
-- client-supplied number, and derives service_fee/tax/total server-side
-- from vd_finance_settings rates rather than trusting the client's own fee
-- calculation.
--
-- IMPORTANT: this redefinition is based on 20260718_guest_orders.sql (the
-- most recent prior definition, which added guest-order support) — not the
-- older 20260716_order_management.sql version, so guest orders keep working.
--
-- Follow-ups this migration deliberately does NOT solve:
--   1. A 'pending' booking holds room/seat inventory indefinitely if the
--      customer abandons payment — needs a scheduled job to expire stale
--      pending bookings (and release their departure seats) after some TTL.
--   2. Supplier notifications and transport dispatch still fire at booking
--      creation (pre-payment), not on confirmation — unchanged for now.
--   3. Price validation has no canonical row to check for two categories,
--      which remain client-trusted same as before:
--        - Shuttles: prices are live distance-based quotes (Google Maps),
--          not a catalog value — closing this needs a server-side re-quote
--          (or a signed/expiring quote token), not a SQL lookup.
--        - "Upcoming Departures" widgets fed by lib/tour-dates.ts hardcoded
--          fixture data have no backing vd_entities row at all — needs a
--          data-model fix (real departures) before it's validatable.
--      Per-package pricing within a departure (vd_entities.value->'packages')
--      is also not resolved — validation falls back to the departure's own
--      top-level pricePerPerson regardless of which package was selected.
-- ============================================================================

-- A 'pending' booking must hold the room the same as 'confirmed', otherwise
-- a second visitor could book the same room while the first is off at
-- iKhokha paying.
create or replace function public.vd_room_booked_count(
  p_room_id text, p_check_in text, p_check_out text
) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from vd_bookings b
  where b.status in ('confirmed', 'pending')
    and b.value->'stay'->>'roomId' = p_room_id
    and coalesce(b.value->>'checkIn', '')  < p_check_out
    and coalesce(b.value->>'checkOut', '') > p_check_in
    and not exists (
      select 1 from vd_booking_orders o
      where o.booking_id = b.id
        and o.status = 'cancelled'
        and exists (
          select 1 from jsonb_array_elements(coalesce(o.value->'items', '[]'::jsonb)) i
          where i->>'type' = 'stay'
        )
    )
$$;

-- Canonical per-unit price for an order line, or null when the category has
-- no single-row source of truth (shuttles, legacy hardcoded tour-date ids —
-- see header). p_room_id is only used for category='accommodation', where
-- the line's productId is the *property* id, not the room.
create or replace function public.vd_canonical_unit_price(
  p_category text, p_product_id text, p_room_id text default null
) returns numeric language sql stable security definer set search_path = public as $$
  select case coalesce(p_category, '')
    when 'accommodation' then
      (select (value->>'basePrice')::numeric from vd_entities where id = p_room_id and kind = 'room')
    when 'activity' then
      (select (value->>'pricePerPerson')::numeric from vd_entities where id = p_product_id and kind = 'activity')
    when 'hike' then
      (select (value->>'pricePerPerson')::numeric from vd_entities where id = p_product_id and kind = 'departure')
    when 'tour' then
      (select (value->>'pricePerPerson')::numeric from vd_entities where id = p_product_id and kind = 'departure')
    when 'event' then
      (select (value->>'ticket_price')::numeric from vd_entities where id = p_product_id and kind = 'supplier_events')
    else null
  end
$$;
grant execute on function public.vd_canonical_unit_price(text, text, text) to authenticated;

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
    v_discount := coalesce((v_line->>'discountAmount')::numeric, 0);
    v_subtotal := v_subtotal + greatest(v_gross - v_discount, 0);
    v_priced_lines := v_priced_lines || jsonb_build_array(v_line);
  end loop;

  -- Fee/VAT rates are always server-owned (vd_finance_settings), never the
  -- client's own calculation — total is fully derived, never trusted.
  v_service_fee := round(v_subtotal * v_service_fee_rate, 2);
  v_tax := round((v_subtotal + v_service_fee) * v_vat_rate, 2);
  v_total := v_subtotal + v_service_fee + v_tax;

  insert into vd_orders (
    id, order_number, user_id, booking_id, customer_name, customer_email,
    trip_name, destination, currency, tax_rate, travel_start, travel_end,
    subtotal, service_fee, tax_amount, total_value, deposit_amount,
    amount_paid, outstanding_balance, booking_status, value
  ) values (
    v_order_id, v_order_number, v_user, p_order->>'bookingId',
    v_customer_name, coalesce(p_order->>'customerEmail', ''),
    coalesce(p_order->>'tripName', ''), v_destination, v_currency, v_vat_rate,
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
    from jsonb_array_elements(v_priced_lines) l
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
