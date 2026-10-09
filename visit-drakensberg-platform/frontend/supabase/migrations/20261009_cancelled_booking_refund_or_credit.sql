-- ============================================================================
-- Visit Drakensberg — a cancelled, paid booking is settled by a refund or by
-- credit on the guest's account
--
-- Run AFTER 20261008_notify_rpc.sql (depends only on 20260716 and 20260913).
--
-- vd_cancel_order already moves everything a guest paid into refund_balance
-- (and books it to 2100 Refund Liability). What was missing is the other half:
-- nothing ever took that liability off the books except a manual 'refund'
-- entry on /admin/orders, and there was no way at all to keep the money as
-- credit for the guest's next trip. So cancelled bookings sat on "Refund due"
-- indefinitely, and the admin Bookings console used to paper over that by
-- printing "Paid" on every row.
--
-- This adds:
--   1. 2400 Guest Account Credit — a liability, like 2100: the platform still
--      owes the guest that money, just as travel rather than cash.
--   2. vd_guest_credits — one row per movement on a guest's credit balance
--      (+ issued, − used). The balance is the sum. Written only through the
--      SECURITY DEFINER function below; guests read their own rows.
--   3. vd_settle_cancelled_order(order, mode, amount, …) — finance-only. For
--      mode 'refund' it records the refund through vd_record_order_payment
--      (same receipt, ledger and idempotency as a refund recorded by hand);
--      for mode 'credit' it moves the amount from 2100 to 2400 and writes the
--      guest's credit row. Either way the order's refund_balance falls by the
--      amount, and once it reaches 0 the order is financially closed and its
--      payment_status reads 'refunded' or 'credited'.
--
-- The refund itself (card reversal in the iKhokha portal, or an EFT) still
-- happens outside the platform; this records that it was done.
-- ============================================================================
-- @rollback: additive — drop function vd_settle_cancelled_order, vd_my_credit_balance; drop table vd_guest_credits; delete from vd_ledger_accounts where code = '2400' (only if no ledger entries use it)

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Ledger account
-- ────────────────────────────────────────────────────────────────────────────
insert into vd_ledger_accounts (code, name, type) values
  ('2400', 'Guest Account Credit', 'liability')
on conflict (code) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Guest credit ledger
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_guest_credits (
  id              text primary key default ('crd-' || gen_random_uuid()),
  -- Null for a guest-checkout order; customer_email then identifies the guest.
  user_id         uuid references auth.users(id) on delete set null,
  customer_email  text not null default '',
  order_id        text references vd_orders(id) on delete set null,
  booking_id      text,
  -- Signed: positive when credit is issued, negative when it is used.
  amount          numeric not null check (amount <> 0),
  currency        text not null default 'ZAR',
  reason          text not null default 'cancellation',
  reference       text not null default '',
  notes           text not null default '',
  created_by      uuid,
  created_at      timestamptz not null default now()
);

create index if not exists vd_guest_credits_user_idx  on vd_guest_credits (user_id);
create index if not exists vd_guest_credits_email_idx on vd_guest_credits (lower(customer_email));
create index if not exists vd_guest_credits_order_idx on vd_guest_credits (order_id);

alter table vd_guest_credits enable row level security;

drop policy if exists "Guests read own credit"   on vd_guest_credits;
drop policy if exists "Finance read guest credit" on vd_guest_credits;
create policy "Guests read own credit" on vd_guest_credits
  for select using (user_id = auth.uid());
create policy "Finance read guest credit" on vd_guest_credits
  for select using (is_finance());
-- No insert/update/delete policies: every movement goes through
-- vd_settle_cancelled_order (or a future redemption function), so the balance
-- always has a matching ledger journal.

-- The signed-in guest's credit balance, for /account.
create or replace function public.vd_my_credit_balance()
returns numeric language sql stable security definer set search_path = public as
$$ select coalesce(sum(amount), 0) from vd_guest_credits where user_id = auth.uid() $$;

grant execute on function public.vd_my_credit_balance() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Settle a cancelled order's refund balance
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_settle_cancelled_order(
  p_order_id  text,
  p_mode      text,                    -- 'refund' | 'credit'
  p_amount    numeric default null,    -- null = the whole refund balance
  p_method    text default 'card',     -- refund only: how the money went back
  p_reference text default '',
  p_notes     text default ''
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order   vd_orders%rowtype;
  v_amount  numeric;
  v_left    numeric;
  v_result  text;
  v_journal uuid := gen_random_uuid();
begin
  -- Same rule as vd_record_order_payment: settling money is a finance action.
  if auth.uid() is not null and not is_finance() then
    raise exception 'finance role required';
  end if;
  if p_mode not in ('refund', 'credit') then
    raise exception 'mode must be refund or credit';
  end if;

  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.booking_status <> 'cancelled' then
    raise exception 'order is not cancelled';
  end if;
  if v_order.refund_balance <= 0 then
    raise exception 'nothing to refund';
  end if;

  v_amount := coalesce(p_amount, v_order.refund_balance);
  if v_amount <= 0 then raise exception 'invalid amount'; end if;
  if v_amount > v_order.refund_balance then
    raise exception 'amount exceeds refund balance';
  end if;
  v_left := v_order.refund_balance - v_amount;

  if p_mode = 'refund' then
    -- Receipt, Dr 2100 / Cr 1000, refund_balance and payment_status all come
    -- from the one function every other refund already goes through.
    v_result := vd_record_order_payment(p_order_id, v_amount, 'refund', p_method, p_reference, p_notes);
  else
    insert into vd_guest_credits (user_id, customer_email, order_id, booking_id, amount, currency,
                                  reason, reference, notes, created_by)
    values (v_order.user_id, coalesce(v_order.customer_email, ''), p_order_id, v_order.booking_id,
            v_amount, v_order.currency, 'cancellation', coalesce(p_reference, ''), coalesce(p_notes, ''), auth.uid())
    returning id into v_result;

    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '2100', p_order_id, v_amount, 0, 'Refund issued as guest credit — ' || v_order.order_number),
      (v_journal, '2400', p_order_id, 0, v_amount, 'Refund issued as guest credit — ' || v_order.order_number);

    update vd_orders set
      refund_balance = v_left,
      payment_status = case when v_left <= 0 then 'credited' else payment_status end,
      updated_at = now()
    where id = p_order_id;

    if v_left <= 0 then
      update vd_invoices set status = 'credited', updated_at = now()
      where order_id = p_order_id and status not in ('void');
    end if;

    perform vd_audit('order.credit_issued', 'order', p_order_id,
      jsonb_build_object('creditId', v_result, 'amount', v_amount));
  end if;

  if v_left <= 0 then
    update vd_orders set financial_status = 'closed', updated_at = now() where id = p_order_id;
  end if;

  return v_result;
end;
$$;

grant execute on function public.vd_settle_cancelled_order(text, text, numeric, text, text, text) to authenticated;
