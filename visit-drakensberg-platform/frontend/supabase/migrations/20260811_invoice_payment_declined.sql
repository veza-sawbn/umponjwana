-- ============================================================================
-- Visit Drakensberg — Track payment declines on invoices
-- Run AFTER 20260810_invoice_open_by_id.sql.
--
-- Problem
-- -------
-- When iKhokha declines a payment, the webhook correctly marks the
-- vd_payment_links row as status='failed' and leaves the invoice untouched
-- (unpaid). But the invoice page has no persistent record of the decline:
-- the customer only sees the "payment didn't go through" banner while the
-- ?payment=failed query parameter is in their URL. On the next visit — or
-- if they open the link from a different device — the invoice shows nothing
-- to indicate that a payment attempt was made and rejected.
--
-- Fix
-- ---
-- Add payment_declined_at to vd_invoices. The webhook sets it whenever iKhokha
-- reports a non-success outcome. The invoice page reads it from the public RPC
-- and renders a persistent banner ("a recent payment attempt was declined")
-- for any invoice whose status is not yet 'paid'. The field is included in
-- vd_invoice_public (and its thin alias vd_invoice_by_token) so it reaches
-- customers opening their invoice from an emailed or pasted link without a
-- session.
-- ============================================================================

alter table vd_invoices add column if not exists payment_declined_at timestamptz;

-- ────────────────────────────────────────────────────────────────────────────
-- Update public invoice RPC to include payment_declined_at.
-- vd_invoice_by_token is already a thin alias for vd_invoice_public
-- (20260810), so only one function needs changing.
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
      -- Only for an invoice whose id no longer opens it — where the caller
      -- must have arrived holding this very token, so returning it discloses
      -- nothing, and the page needs it to offer a working "copy link".
      'share_token', case when v_invoice.share_id_access then null else v_invoice.share_token end,
      'first_viewed_at', v_invoice.first_viewed_at,
      'last_viewed_at', v_invoice.last_viewed_at,
      'view_count', v_invoice.view_count,
      -- Set by the webhook when iKhokha reports a non-success payment outcome.
      -- Null when no online payment attempt has been declined, or once the
      -- invoice has been paid (the webhook only sets this for unpaid invoices).
      'payment_declined_at', v_invoice.payment_declined_at
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
