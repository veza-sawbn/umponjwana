-- Repair: guest orders were unusable because the schema still required a
-- user_id.
--
-- 20260718_guest_orders.sql made user_id nullable across the financial tables
-- and re-created vd_create_order with guest support. Later migrations
-- (20260802, 20260803) re-created vd_create_order again, so a database that
-- skipped 20260718 still ends up with a guest-capable function sitting on top
-- of NOT NULL columns — issuing a walk-in/phone invoice then fails with
--   null value in column "user_id" of relation "vd_orders"
-- This migration restores the two halves of 20260718 that are not superseded
-- by anything later, and is a no-op where 20260718 did run.
--
-- The nullable columns and the null-safe ownership checks below MUST ship
-- together. `v_order.user_id <> auth.uid()` evaluates to NULL for a guest
-- order, which is not TRUE, so the guard silently passes — making user_id
-- nullable without the IS DISTINCT FROM form would let any authenticated user
-- record payments against, or cancel, someone else's guest order.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Guest orders carry no account (idempotent — no-op if already nullable)
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_orders         alter column user_id drop not null;
alter table vd_order_lines    alter column user_id drop not null;
alter table vd_invoices       alter column user_id drop not null;
alter table vd_receipts       alter column user_id drop not null;
alter table vd_order_payments alter column user_id drop not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Null-safe ownership checks
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
