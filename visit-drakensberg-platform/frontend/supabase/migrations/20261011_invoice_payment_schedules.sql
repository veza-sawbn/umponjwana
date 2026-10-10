-- ============================================================================
-- Visit Drakensberg — Deposit and split payment schedules on invoices
-- Run AFTER 20260811_invoice_payment_declined.sql and 20260812_void_invoice.sql.
--
-- Until now an invoice was payable in one go: the invoice page offered "Pay
-- Now" for the whole balance, and a deposit could only be taken by staff
-- recording a partial payment by hand. This lets staff set, per invoice, how
-- the total is to be paid:
--
--   * deposit — a deposit now (fixed amount or percentage), the balance later;
--   * split   — two to twelve instalments, each with its own due date.
--
-- The schedule lives on the invoice as payment_schedule (null = pay in full,
-- exactly the old behaviour). Shape:
--
--   { "kind": "deposit" | "split",
--     "instalments": [ { "label": text, "amount": numeric,
--                        "percent": numeric|null, "dueDate": "YYYY-MM-DD"|null }, … ] }
--
-- The last instalment is always "the remainder": its stored amount is ignored
-- and recomputed as total minus the earlier ones (see lib/payment-schedule.ts).
-- So a schedule stays valid when the total later moves — an edit that
-- re-prices the invoice, or a gratuity the iKhokha webhook adds on payment.
--
-- Payments are unchanged: vd_record_order_payment already handles partial
-- payments. The schedule only decides what the invoice page asks the customer
-- to pay next, and what the documents show.
--
-- Writes go through vd_set_invoice_payment_schedule, which validates the
-- shape and audits the change. It deliberately works on an invoice that has
-- already taken money — vd_update_order locks the lines once anything is paid,
-- but changing *when* the rest is due is exactly what staff need to do then.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

alter table vd_invoices       add column if not exists payment_schedule jsonb;
alter table vd_invoice_drafts add column if not exists payment_schedule jsonb;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Validation. Shared by the setter and usable by tests.
--    Returns null when the schedule is acceptable for p_total, otherwise the
--    reason. A null schedule is always acceptable (pay in full).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_payment_schedule_error(p_schedule jsonb, p_total numeric)
returns text language plpgsql immutable set search_path = public as $$
declare
  v_items   jsonb;
  v_n       int;
  v_i       int;
  v_item    jsonb;
  v_amount  numeric;
  v_running numeric := 0;
  v_due     text;
  v_prev    text;
begin
  if p_schedule is null or p_schedule = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p_schedule) <> 'object' then return 'schedule must be an object'; end if;
  if coalesce(p_schedule->>'kind', '') not in ('deposit', 'split') then
    return 'schedule kind must be deposit or split';
  end if;

  v_items := p_schedule->'instalments';
  if v_items is null or jsonb_typeof(v_items) <> 'array' then return 'schedule needs instalments'; end if;
  v_n := jsonb_array_length(v_items);
  if v_n < 2 then return 'a schedule needs at least two payments'; end if;
  if v_n > 12 then return 'a schedule can have at most 12 payments'; end if;
  if p_schedule->>'kind' = 'deposit' and v_n <> 2 then
    return 'a deposit schedule has exactly two payments';
  end if;

  for v_i in 0 .. v_n - 1 loop
    v_item := v_items->v_i;
    if jsonb_typeof(v_item) <> 'object' then return 'each instalment must be an object'; end if;
    if length(coalesce(v_item->>'label', '')) > 80 then return 'instalment label is too long'; end if;

    v_due := nullif(v_item->>'dueDate', '');
    if v_due is not null then
      if v_due !~ '^\d{4}-\d{2}-\d{2}$' then return 'due dates must be YYYY-MM-DD'; end if;
      if v_prev is not null and v_due < v_prev then return 'due dates must run in order'; end if;
      v_prev := v_due;
    end if;

    -- The last instalment is the remainder; its amount is not checked.
    if v_i < v_n - 1 then
      if jsonb_typeof(v_item->'amount') <> 'number' then return 'each instalment needs an amount'; end if;
      v_amount := (v_item->>'amount')::numeric;
      if v_amount <= 0 then return 'instalment amounts must be greater than zero'; end if;
      v_running := v_running + round(v_amount, 2);
    end if;
  end loop;

  if v_running >= round(coalesce(p_total, 0), 2) then
    return 'the earlier payments must add up to less than the invoice total';
  end if;
  return null;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. The setter. Finance staff (admins included) only.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_set_invoice_payment_schedule(
  p_invoice_id text,
  p_schedule   jsonb
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_invoice vd_invoices%rowtype;
  v_error   text;
  v_clean   jsonb := case when p_schedule = 'null'::jsonb then null else p_schedule end;
begin
  if not is_finance() then raise exception 'finance role required'; end if;

  select * into v_invoice from vd_invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  if v_invoice.status = 'void' then raise exception 'a void invoice cannot be rescheduled'; end if;

  v_error := vd_payment_schedule_error(v_clean, v_invoice.total);
  if v_error is not null then raise exception 'invalid payment schedule: %', v_error; end if;

  update vd_invoices set payment_schedule = v_clean, updated_at = now() where id = p_invoice_id;

  perform vd_audit('invoice.payment_schedule_set', 'invoice', p_invoice_id,
    jsonb_build_object(
      'invoiceNumber', v_invoice.invoice_number,
      'from', v_invoice.payment_schedule,
      'to', v_clean
    ));
end;
$$;

revoke execute on function public.vd_set_invoice_payment_schedule(text, jsonb) from public, anon;
grant  execute on function public.vd_set_invoice_payment_schedule(text, jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. The customer's view of the invoice carries the schedule, so the page
--    opened from a link can show it and offer the instalment due now.
--    Identical to 20260811 apart from the added key.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_invoice_public(p_ref text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_invoice  vd_invoices%rowtype;
  v_order    vd_orders%rowtype;
  v_receipts jsonb;
begin
  if p_ref is null or p_ref = '' then return null; end if;

  -- A share token from an older link.
  if length(p_ref) >= 32 and p_ref ~ '^[0-9a-f]+$' then
    select * into v_invoice from vd_invoices where share_token = p_ref;
  end if;

  if v_invoice.id is null and vd_is_unguessable_ref(p_ref) then
    select * into v_invoice from vd_invoices
     where id = p_ref and share_id_access;

    -- Not an invoice id — try it as the order's id, which is what a link
    -- built before the invoice existed (or from an order page) carries.
    if v_invoice.id is null then
      select * into v_invoice from vd_invoices
       where order_id = p_ref and share_id_access order by issued_at limit 1;
    end if;
  end if;

  if v_invoice.id is null then return null; end if;
  if v_invoice.share_revoked_at is not null then return null; end if;

  select * into v_order from vd_orders where id = v_invoice.order_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'receipt_number', r.receipt_number,
           'amount', r.amount,
           'method', r.method,
           'currency', r.currency,
           'created_at', r.created_at
         ) order by r.created_at desc), '[]'::jsonb)
    into v_receipts
    from vd_receipts r
   where r.order_id = v_invoice.order_id;

  return jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'order_id', v_invoice.order_id,
      'user_id', v_invoice.user_id,
      'currency', v_invoice.currency,
      'subtotal', v_invoice.subtotal,
      'discount', v_invoice.discount,
      'service_fee', v_invoice.service_fee,
      'tax_amount', v_invoice.tax_amount,
      'total', v_invoice.total,
      'amount_paid', v_invoice.amount_paid,
      'balance', v_invoice.balance,
      'status', v_invoice.status,
      'lines', v_invoice.lines,
      'issued_at', v_invoice.issued_at,
      'share_issued_at', v_invoice.share_issued_at,
      'share_revoked_at', v_invoice.share_revoked_at,
      'share_id_access', v_invoice.share_id_access,
      'share_token', case when v_invoice.share_id_access then null else v_invoice.share_token end,
      'first_viewed_at', v_invoice.first_viewed_at,
      'last_viewed_at', v_invoice.last_viewed_at,
      'view_count', v_invoice.view_count,
      'payment_declined_at', v_invoice.payment_declined_at,
      'payment_schedule', v_invoice.payment_schedule
    ),
    'order', case when v_order.id is null then null else jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'customer_name', v_order.customer_name,
      'customer_email', v_order.customer_email,
      'trip_name', v_order.trip_name,
      'travel_start', v_order.travel_start,
      'travel_end', v_order.travel_end,
      'currency', v_order.currency
    ) end,
    'receipts', v_receipts
  );
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. The payment route works out the instalment due now from the same
--    figures, so the payable view needs the schedule, total and amount paid.
--    Identical to 20260810 apart from the added keys.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_invoice_payable(p_ref text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_invoice vd_invoices%rowtype;
begin
  if p_ref is null or p_ref = '' then return null; end if;

  if length(p_ref) >= 32 and p_ref ~ '^[0-9a-f]+$' then
    select * into v_invoice from vd_invoices where share_token = p_ref;
  end if;
  if v_invoice.id is null and vd_is_unguessable_ref(p_ref) then
    select * into v_invoice from vd_invoices where id = p_ref and share_id_access;
  end if;
  if v_invoice.id is null or v_invoice.share_revoked_at is not null then return null; end if;

  return jsonb_build_object(
    'id', v_invoice.id,
    'order_id', v_invoice.order_id,
    'invoice_number', v_invoice.invoice_number,
    'user_id', v_invoice.user_id,
    'currency', v_invoice.currency,
    'total', v_invoice.total,
    'amount_paid', v_invoice.amount_paid,
    'balance', v_invoice.balance,
    'status', v_invoice.status,
    'lines', v_invoice.lines,
    'payment_schedule', v_invoice.payment_schedule
  );
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. A reissued invoice keeps the schedule the customer agreed to.
--    Identical to 20260812 apart from copying payment_schedule.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_reissue_invoice(
  p_invoice_id text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_source  vd_invoices%rowtype;
  v_new_id  text := 'inv-' || gen_random_uuid();
  v_new_num text := vd_next_number('INV');
begin
  if not is_finance() then raise exception 'finance role required'; end if;

  select * into v_source from vd_invoices where id = p_invoice_id;
  if not found then raise exception 'invoice not found'; end if;
  if v_source.status <> 'void'
    then raise exception 'only a voided invoice can be reissued'; end if;

  insert into vd_invoices (
    id, invoice_number, order_id, user_id, currency,
    subtotal, discount, service_fee, tax_amount, total,
    amount_paid, balance, status, lines, payment_schedule
  ) values (
    v_new_id, v_new_num, v_source.order_id, v_source.user_id, v_source.currency,
    v_source.subtotal, v_source.discount, v_source.service_fee, v_source.tax_amount, v_source.total,
    0, v_source.total, 'unpaid', v_source.lines, v_source.payment_schedule
  );

  perform vd_audit('invoice.reissued', 'invoice', v_new_id,
    jsonb_build_object(
      'invoiceNumber',         v_new_num,
      'replacedInvoiceId',     p_invoice_id,
      'replacedInvoiceNumber', v_source.invoice_number
    ));

  return v_new_id;
end;
$$;
