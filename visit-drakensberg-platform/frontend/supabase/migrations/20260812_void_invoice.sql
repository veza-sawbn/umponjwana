-- ============================================================================
-- Visit Drakensberg — Void erroneously-paid invoices + reissue
-- Run AFTER 20260811_invoice_payment_declined.sql.
--
-- Problem
-- -------
-- The iKhokha webhook bug (fixed in 20260811) caused invoices to be recorded
-- as 'paid' even when iKhokha declined the card. Finance staff need two
-- controlled actions to resolve affected accounts:
--
--   1. Void — reverses the erroneous payment records on the order, resets
--      the invoice and order balances to their pre-payment state, marks the
--      invoice 'void', and writes balanced reversal ledger entries.
--
--   2. Reissue — mints a fresh invoice document on the same order so the
--      customer receives a correctly-dated, correctly-numbered replacement
--      they can actually pay.
--
-- Both actions are finance-staff-only (is_finance() guard) and audited.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Audit-trail columns
--    voided_at  — when a finance user voided this invoice
--    void_reason — the reason they gave
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_invoices add column if not exists voided_at   timestamptz;
alter table vd_invoices add column if not exists void_reason text;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_void_invoice — reverse erroneous payments and mark invoice void.
--
--    * Sums every inbound payment on the order that has not already been
--      reversed and stamps them status='reversed'.
--    * Writes a balanced reversal journal entry (debit Receivable 1100,
--      credit Cash 1000) — the mirror of what vd_record_order_payment wrote.
--    * Resets invoice: amount_paid=0, balance=total, status='void'.
--    * Resets order: amount_paid=0, outstanding=total_value, status='unpaid'.
--    * Resets order line payment statuses.
--    * Idempotent — calling twice on an already-void invoice is a no-op.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_void_invoice(
  p_invoice_id text,
  p_reason     text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_invoice        vd_invoices%rowtype;
  v_order          vd_orders%rowtype;
  v_journal        uuid    := gen_random_uuid();
  v_total_reversed numeric := 0;
begin
  if not is_finance() then raise exception 'finance role required'; end if;

  select * into v_invoice from vd_invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  if v_invoice.status = 'void' then return; end if; -- already voided — idempotent

  select * into v_order from vd_orders where id = v_invoice.order_id for update;
  if not found then raise exception 'order not found'; end if;

  -- Sum every active inbound payment on this order.
  select coalesce(sum(amount), 0) into v_total_reversed
    from vd_order_payments
   where order_id = v_invoice.order_id
     and direction = 'in'
     and status <> 'reversed';

  if v_total_reversed > 0 then
    -- Stamp the erroneous payments as reversed so the history is clear.
    update vd_order_payments
       set status = 'reversed',
           notes  = trim(both ' ' from
                      case when notes = '' then ''
                           else notes || ' | '
                      end
                      || 'Reversed: ' || coalesce(nullif(p_reason,''), 'invoice voided by staff'))
     where order_id = v_invoice.order_id
       and direction = 'in'
       and status <> 'reversed';

    -- Reversal journal — mirrors the original:
    --   vd_record_order_payment wrote  Debit 1000 Cash / Credit 1100 Receivable
    --   We reverse with               Debit 1100 Receivable / Credit 1000 Cash
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '1100', v_order.id, v_total_reversed, 0,
       'Payment reversal — invoice ' || v_invoice.invoice_number || ' voided'),
      (v_journal, '1000', v_order.id, 0, v_total_reversed,
       'Payment reversal — invoice ' || v_invoice.invoice_number || ' voided');
  end if;

  -- Void the invoice and wipe the erroneous balance.
  update vd_invoices set
    status              = 'void',
    amount_paid         = 0,
    balance             = total,
    payment_declined_at = null,
    voided_at           = now(),
    void_reason         = coalesce(nullif(p_reason,''), 'Voided by staff'),
    updated_at          = now()
  where id = p_invoice_id;

  -- Restore the order to its pre-payment state.
  update vd_orders set
    amount_paid         = 0,
    outstanding_balance = total_value,
    payment_status      = 'unpaid',
    updated_at          = now()
  where id = v_order.id;

  -- Line payment statuses back to unpaid.
  update vd_order_lines set
    payment_status = 'unpaid',
    updated_at     = now()
  where order_id = v_order.id
    and payment_status in ('paid','partial');

  perform vd_audit('invoice.voided', 'invoice', p_invoice_id,
    jsonb_build_object(
      'invoiceNumber',  v_invoice.invoice_number,
      'reason',         coalesce(nullif(p_reason,''), 'Voided by staff'),
      'amountReversed', v_total_reversed
    ));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. vd_reissue_invoice — mint a replacement invoice for the same order.
--
--    Only callable on a void invoice. Creates a fresh row with a new invoice
--    number and today's date, copying all financial fields. The new invoice
--    starts unpaid — amount_paid=0, balance=total — and immediately opens on
--    its own id-based link (share_id_access defaults true).
--    Returns the new invoice's id so the caller can redirect to it or email it.
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
    amount_paid, balance, status, lines
    -- share_id_access defaults true — the new link opens on its own address
  ) values (
    v_new_id, v_new_num, v_source.order_id, v_source.user_id, v_source.currency,
    v_source.subtotal, v_source.discount, v_source.service_fee, v_source.tax_amount, v_source.total,
    0, v_source.total, 'unpaid', v_source.lines
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

-- Finance and admin staff only (is_finance() guard is enforced inside each
-- function). Service role (webhook, server routes) can call without a session.
grant execute on function public.vd_void_invoice(text, text) to authenticated;
grant execute on function public.vd_reissue_invoice(text)    to authenticated;
