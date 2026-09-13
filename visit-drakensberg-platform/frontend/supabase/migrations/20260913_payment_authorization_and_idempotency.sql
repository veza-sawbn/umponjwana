-- ============================================================================
-- Visit Drakensberg — Recording money is a staff action, and it happens once
--
-- Run AFTER 20260912_orphan_entities_are_not_public.sql.
--
-- Two findings from the September 2026 security audit, both in the same
-- function, fixed together because the second fix depends on the first
-- function body.
--
-- ────────────────────────────────────────────────────────────────────────────
-- C2 — a customer could mark their own order paid without paying
-- ────────────────────────────────────────────────────────────────────────────
-- vd_record_order_payment is SECURITY DEFINER and granted to `authenticated`.
-- Its guards were:
--
--   if auth.uid() is not null and v_order.user_id is distinct from auth.uid()
--      and not is_finance() then raise exception 'not allowed'; end if;
--   if auth.uid() is not null and not is_finance()
--      and (v_direction = 'out' or p_method in ('cash','offline')) then
--        raise exception 'finance role required'; end if;
--
-- The first asks "is this your order?". The second asks "is this an instrument
-- only staff may use?". Neither asks the question that matters — "did money
-- actually arrive?" — which for a card payment is a fact only the iKhokha
-- webhook knows. So the legitimate owner of an order cleared both:
--
--   supabase.rpc('vd_record_order_payment', {
--     p_order_id: '<their own order>', p_amount: <the total>,
--     p_type: 'payment', p_method: 'card',   -- not cash/offline, so no gate
--   })
--
-- …and the order went to payment_status='paid', outstanding_balance=0, the
-- invoice to 'paid' with balance 0, a sequential receipt was issued and a
-- balanced journal debiting Cash was written. Every internal view agreed the
-- trip was paid for. The public anon key and a browser console were enough.
--
-- The fix is the shape vd_apply_order_tip (20260806_activity_tips.sql) already
-- uses and this function should always have had: ANY caller carrying a user
-- JWT must hold the finance role, whatever the instrument and whoever owns the
-- order. Ownership is not authority to record a receipt against yourself.
--
-- Callers are unaffected. The RPC has exactly two call sites in the app —
-- /admin/invoices and /admin/orders (lib/order-payments.ts recordOrderPayment),
-- both staff-only consoles — plus the iKhokha webhook, which uses the service
-- role (auth.uid() is null) and is therefore exempt, as are the in-database
-- callers vd_create_order / vd_rebuild_order_lines / vd_apply_admin_overrides.
--
-- ────────────────────────────────────────────────────────────────────────────
-- H3 — the same payment could be recorded twice
-- ────────────────────────────────────────────────────────────────────────────
-- The webhook guards against concurrent callbacks with a compare-and-swap on
-- vd_payment_links.status='pending'. But vd_record_order_payment is a separate
-- round trip that COMMITS ON ITS OWN, and the handler's catch block resets the
-- link to 'pending' so a retry can complete it:
--
--   const { data: paymentId } = await admin.rpc('vd_record_order_payment', …)
--   await admin.from('vd_payment_links').update({ payment_id: paymentId })…
--   …booking confirmation, trip request, supplier notifications, analytics…
--   } catch (e) {
--     await admin.from('vd_payment_links').update({ status: 'pending' })…
--   }
--
-- Anything throwing AFTER the RPC committed — the payment_id write, the
-- vd_bookings update, a notification, the analytics insert — reopened the CAS
-- with the money already recorded. iKhokha retries, the CAS succeeds again,
-- and the order is credited twice: two payments, two receipts, two journals,
-- and a customer refund to chase.
--
-- vd_order_payments.reference already carries a natural idempotency key
-- ('ikhokha:<paylinkID>'), it just was not enforced. Now it is, and the
-- function returns the existing payment id instead of double-crediting, so a
-- retry is a no-op rather than a liability. Manual staff entries are unaffected
-- — they default to an empty reference, which the partial index ignores.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. One payment per gateway reference.
--
--    Partial, so the many manual entries with reference='' do not collide.
--    Built before the function below so the lookup has an index to use.
--
--    If this fails, the database already holds a duplicate — find it with
--      select reference, count(*) from vd_order_payments
--       where reference <> '' group by reference having count(*) > 1;
--    and reconcile those rows before re-running.
-- ────────────────────────────────────────────────────────────────────────────
create unique index if not exists vd_order_payments_reference_key
  on vd_order_payments (reference)
  where reference <> '';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_record_order_payment — finance-only, and idempotent on the reference.
--
--    Copied from 20260804_guest_orders_repair.sql with only the guard block
--    and the new reference lookup changed; everything from the insert onwards
--    is byte-for-byte the previous body.
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
  v_existing text;
begin
  -- Recording that money arrived is a finance action, full stop. Ownership of
  -- the order is not authority to issue yourself a receipt for it — see the
  -- C2 note above. A caller with no user JWT (the service role, used by the
  -- iKhokha webhook, and the in-database callers below) is exempt: it has
  -- already verified the payment out-of-band with the gateway.
  if auth.uid() is not null and not is_finance() then
    raise exception 'finance role required';
  end if;

  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;

  -- Idempotency. A gateway reference identifies one payment; a retried webhook
  -- must get the same answer as the first call, not a second credit. Taken
  -- after the row lock above so two concurrent callbacks serialise here rather
  -- than racing the unique index.
  if coalesce(p_reference, '') <> '' then
    select id into v_existing from vd_order_payments where reference = p_reference;
    if v_existing is not null then
      return v_existing;
    end if;
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

grant execute on function public.vd_record_order_payment(text, numeric, text, text, text, text) to authenticated;
