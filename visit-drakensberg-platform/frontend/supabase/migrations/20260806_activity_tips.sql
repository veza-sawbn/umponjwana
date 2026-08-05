-- ============================================================================
-- Visit Drakensberg — Gratuities on activity invoices
-- Run AFTER 20260805_admin_fee_tax_override.sql.
--
-- Guests who booked a guided activity can add a tip when they pay their
-- invoice online. The money model:
--
--   * A tip is NOT a service the platform sells. It carries no commission and
--     no platform fee — every cent is allocated to the operator who ran the
--     activity, so the existing settlement engine pays it over untouched.
--   * A tip carries no VAT. A voluntary gratuity is not consideration for a
--     supply, so the invoice's tax_amount does not move when one is added.
--   * A tip is only ever written once iKhokha has confirmed the payment (see
--     the webhook route). The customer's chosen amount rides on the payment
--     link until then, so an abandoned payment leaves the invoice untouched.
--
-- That last point is why the invoice gains a line after it was issued: the
-- alternative — a second document for the gratuity — would mean a second
-- number series, a second payment path and a second thing to reconcile. The
-- line is added before the payment that settles it is recorded, so the
-- invoice never shows a customer paying more than the document asks for.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Settings — tipping can be switched off, and the offered percentages are
--    editable (Admin → Settings), like every other financial default.
-- ────────────────────────────────────────────────────────────────────────────
insert into vd_finance_settings (key, value) values
  ('tipping_enabled', 'true'),
  ('tip_presets',     '[10, 15, 20]')
on conflict (key) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. The tip rides on the payment link until the gateway confirms payment.
--    tip_applied_at makes applying it idempotent: the webhook can be retried
--    (or fire twice) without the guest being credited two gratuities.
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_payment_links add column if not exists tip_amount    numeric not null default 0;
alter table vd_payment_links add column if not exists tip_applied_at timestamptz;

do $$
begin
  alter table vd_payment_links add constraint vd_payment_links_tip_nonneg check (tip_amount >= 0);
exception
  when duplicate_object then null;
end
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Which categories can be tipped. A guest tips the person who guided,
--    drove or hosted them — not a chalet, a permit or a park levy.
--    Mirrored in lib/tips.ts (TIPPABLE_CATEGORIES); change both together.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_tippable_categories()
returns text[] language sql immutable as
$$ select array['activity', 'tour', 'hike', 'shuttle']::text[] $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RPC: apply a confirmed gratuity to an order.
--
--    Splits the tip across the operators of the order's tippable lines in
--    proportion to what each of them is owed, appends one gratuity line per
--    operator, lifts the order and invoice totals by the tip, and writes a
--    balanced journal (receivable against supplier payable / platform
--    revenue). The payment that settles it is recorded separately, straight
--    after, by vd_record_order_payment.
--
--    Callable by the payment webhook (service role — auth.uid() is null) and
--    by finance staff. Never by the customer: the guest's chosen amount
--    reaches this function through the verified payment link, not directly.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_apply_order_tip(p_order_id text, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_order    vd_orders%rowtype;
  v_invoice  vd_invoices%rowtype;
  v_tip      numeric := round(coalesce(p_amount, 0), 2);
  v_tippable numeric;
  v_groups   int;
  v_rank     int := 0;
  v_remaining numeric;
  v_share    numeric;
  v_group    record;
  v_line_id  text;
  v_journal  uuid := gen_random_uuid();
  v_supplier_total numeric := 0;
  v_platform_total numeric := 0;
begin
  if auth.uid() is not null and not is_finance() then
    raise exception 'finance role required';
  end if;
  if v_tip <= 0 then raise exception 'invalid tip amount'; end if;

  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  select coalesce(sum(gross_amount - discount_amount), 0), count(distinct coalesce(supplier_id::text, 'platform'))
    into v_tippable, v_groups
    from vd_order_lines
   where order_id = p_order_id
     and category = any (vd_tippable_categories())
     and fulfilment_status <> 'cancelled';

  if v_tippable <= 0 then
    raise exception 'order has no activity to tip';
  end if;

  v_remaining := v_tip;

  -- Largest operator first, so the rounding remainder lands on the line best
  -- able to absorb a cent rather than on a token one.
  for v_group in
    select supplier_id,
           max(supplier_name)                     as supplier_name,
           sum(gross_amount - discount_amount)    as value,
           min(service_date)                      as service_date
      from vd_order_lines
     where order_id = p_order_id
       and category = any (vd_tippable_categories())
       and fulfilment_status <> 'cancelled'
     group by supplier_id
     order by sum(gross_amount - discount_amount) desc, supplier_id nulls last
  loop
    v_rank := v_rank + 1;
    if v_rank = v_groups then
      v_share := v_remaining;                                    -- last one takes the remainder
    else
      v_share := round(v_tip * v_group.value / v_tippable, 2);
      v_remaining := v_remaining - v_share;
    end if;
    continue when v_share <= 0;

    v_line_id := 'vdl-' || gen_random_uuid();
    insert into vd_order_lines (
      id, order_id, order_number, user_id, supplier_id, supplier_name,
      category, title, description, service_date,
      quantity, unit_label, unit_price, gross_amount, discount_amount,
      tax_amount, commission_rate, commission_amount, service_fee, platform_fee,
      supplier_share, platform_share, payment_status, fulfilment_status,
      share_customer_name, customer_name, currency, destination, value
    ) values (
      v_line_id, p_order_id, v_order.order_number, v_order.user_id,
      v_group.supplier_id, coalesce(v_group.supplier_name, 'Visit Drakensberg'),
      'tip',
      case when v_group.supplier_id is null then 'Gratuity'
           else 'Gratuity — ' || coalesce(v_group.supplier_name, 'operator') end,
      'Voluntary gratuity added by the guest when paying. Paid over in full — no commission, no VAT.',
      v_group.service_date,
      1, 'tip', v_share, v_share, 0,
      0, 0, 0, 0, 0,
      case when v_group.supplier_id is null then 0 else v_share end,
      case when v_group.supplier_id is null then v_share else 0 end,
      'unpaid', 'fulfilled',
      true, v_order.customer_name, v_order.currency, v_order.destination,
      jsonb_build_object('tip', true)
    );

    if v_group.supplier_id is null then
      v_platform_total := v_platform_total + v_share;
    else
      v_supplier_total := v_supplier_total + v_share;
      insert into vd_ledger_entries (journal_id, account_code, order_id, supplier_id, debit, credit, memo)
      values (v_journal, '2000', p_order_id, v_group.supplier_id, 0, v_share,
              'Gratuity payable — ' || v_order.order_number);
    end if;
  end loop;

  -- Order: the gratuity is money the customer owes and then pays, so it lifts
  -- the subtotal and the total but never the tax.
  update vd_orders set
    subtotal            = subtotal + v_tip,
    total_value         = total_value + v_tip,
    outstanding_balance = greatest(total_value + v_tip - amount_paid, 0),
    updated_at          = now()
  where id = p_order_id;

  select * into v_invoice from vd_invoices where order_id = p_order_id order by issued_at limit 1;
  if found then
    update vd_invoices set
      subtotal = subtotal + v_tip,
      total    = total + v_tip,
      balance  = greatest(total + v_tip - amount_paid, 0),
      status   = case when status = 'paid' then 'partial' else status end,
      lines    = lines || jsonb_build_array(jsonb_build_object(
                   'title',       'Gratuity for your guide',
                   'description', 'Voluntary gratuity — paid over to the operator in full. No VAT.',
                   'category',    'tip',
                   'quantity',    1,
                   'unitLabel',   'tip',
                   'unitPrice',   v_tip,
                   'total',       v_tip)),
      updated_at = now()
    where id = v_invoice.id;
  end if;

  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
  values (v_journal, '1100', p_order_id, v_tip, 0, 'Gratuity added — ' || v_order.order_number);

  if v_platform_total > 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4000', p_order_id, 0, v_platform_total,
            'Gratuity on platform-run activity — ' || v_order.order_number);
  end if;

  perform vd_audit('order.tip_applied', 'order', p_order_id,
    jsonb_build_object('amount', v_tip, 'toSuppliers', v_supplier_total, 'toPlatform', v_platform_total));

  return v_tip;
end;
$$;

grant execute on function public.vd_tippable_categories() to authenticated;
grant execute on function public.vd_apply_order_tip(text, numeric) to authenticated;

comment on function public.vd_apply_order_tip(text, numeric) is
  'Applies a confirmed gratuity to an order: one zero-commission, zero-VAT line per operator, order and invoice totals lifted by the tip, balanced journal written. Called by the payment webhook once the gateway confirms payment.';
