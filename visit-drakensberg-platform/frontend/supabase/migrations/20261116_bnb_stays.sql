-- ============================================================================
-- Visit Drakensberg — B&B stays: per-person-sharing room rates
-- Run AFTER 20261109_departure_drafts.sql.
--
-- "Bed & Breakfast" is now a property type (lib/properties.ts). What a B&B
-- needs from the database is a price it can actually charge: B&Bs and many
-- guesthouses quote "R650 per person sharing, breakfast included", not a
-- flat price for the room. A room's value now carries
--
--   rateBasis   'per_room'   basePrice is the room's nightly price (the
--                            default — every existing room has no rateBasis)
--               'per_person' basePrice is per adult per night
--
-- Breakfast itself is already a room inclusion ("Breakfast" / "All Meals")
-- and needs nothing here.
--
-- Checkout re-prices accommodation lines server-side (validatePrice), but
-- vd_canonical_unit_price() only knows the room id, so it returned basePrice
-- whoever was staying. That can't price a per-person room, and it also
-- silently dropped the per-child surcharge the stay page already shows and
-- the customer agreed to (rooms with childMaxAge). vd_create_order now prices
-- accommodation through vd_canonical_stay_night_price(), which reads the
-- party from the line:
--
--   guests             the line's guest count (whole party)
--   value.children     children at or under the room's childMaxAge; ignored
--                      when the room has no child rate, clamped to guests
--
--   per_room    basePrice + childPrice × children
--   per_person  basePrice × adults + childPrice × children
--
-- The line's quantity stays the number of nights. lib/rooms.ts
-- stayNightPrice() is the client half of this and must stay in step.
--
-- vd_create_order is redefined from 20261101_invoice_line_discounts.sql (the
-- latest version); the only change is the accommodation re-pricing call.
-- ============================================================================
-- @rollback: re-run vd_create_order from 20261101_invoice_line_discounts.sql; drop function vd_canonical_stay_night_price(jsonb)

-- ────────────────────────────────────────────────────────────────────────────
-- One night's canonical price for an accommodation order line, or null when
-- the line names no room (or a room with no usable basePrice) — null keeps
-- the submitted price, same as vd_canonical_unit_price.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_canonical_stay_night_price(p_line jsonb)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_room     jsonb;
  v_base     numeric;
  v_child    numeric := 0;
  v_has_kids boolean := false;
  v_guests   int;
  v_children int := 0;
begin
  select value into v_room
    from vd_entities
   where id = p_line->'value'->>'roomId' and kind = 'room';
  if v_room is null then return null; end if;

  begin
    v_base := nullif(v_room->>'basePrice', '')::numeric;
  exception when others then
    return null;
  end;
  if v_base is null or v_base < 0 then return null; end if;

  -- Child rate: same rule as the stay page — it only exists once the
  -- supplier set an age cutoff.
  begin
    v_has_kids := coalesce(nullif(v_room->>'childMaxAge', '')::numeric, 0) > 0;
    if v_has_kids then
      v_child := greatest(coalesce(nullif(v_room->>'childPrice', '')::numeric, 0), 0);
    end if;
  exception when others then
    v_has_kids := false;
    v_child := 0;
  end;

  -- The party as the customer declared it. A malformed count reads as the
  -- smallest party rather than failing the order.
  begin
    v_guests := greatest(coalesce(floor(nullif(p_line->>'guests', '')::numeric)::int, 1), 1);
  exception when others then
    v_guests := 1;
  end;
  if v_has_kids then
    begin
      v_children := least(greatest(coalesce(floor(nullif(p_line->'value'->>'children', '')::numeric)::int, 0), 0), v_guests);
    exception when others then
      v_children := 0;
    end;
  end if;

  if coalesce(v_room->>'rateBasis', 'per_room') = 'per_person' then
    return v_base * (v_guests - v_children) + v_child * v_children;
  end if;
  return v_base + v_child * v_children;
end;
$$;
revoke all on function public.vd_canonical_stay_night_price(jsonb) from public, anon, authenticated;

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
      -- Accommodation is priced for the party staying (B&B per-person rates,
      -- child rates) — see vd_canonical_stay_night_price above.
      if v_line->>'category' = 'accommodation' then
        v_canonical := vd_canonical_stay_night_price(v_line);
      else
        v_canonical := vd_canonical_unit_price(v_line->>'category', v_line->>'productId', v_line->'value'->>'roomId');
      end if;
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
