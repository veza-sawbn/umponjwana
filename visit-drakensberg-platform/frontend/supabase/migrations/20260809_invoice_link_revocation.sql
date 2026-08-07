-- ============================================================================
-- Visit Drakensberg — Revoking and re-issuing an invoice share link
-- Run AFTER 20260808_invoice_share_links.sql.
--
-- 20260808 made the invoice link openable by whoever holds it. That is what
-- makes it work over email and WhatsApp, and it is also why there has to be a
-- way to take one back: a link pasted into the wrong chat, forwarded on by a
-- customer, or sitting in a mailbox someone else now reads, cannot otherwise
-- be un-shared.
--
-- Revoke kills the link. Re-issue mints a fresh one, which kills the old one
-- as a side effect — both work by rotating share_token, so a copy of the old
-- URL matches nothing afterwards. share_revoked_at is the state flag on top
-- of that: rotation alone would leave a revoked invoice holding a perfectly
-- valid token that simply nobody has, and staff could hand it out again by
-- copying the link.
--
-- share_issued_at dates the *current* link, so "opened" in the console can be
-- read against the link the customer actually has rather than against a
-- previous one.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Columns. Existing invoices' links were issued when the invoice was.
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_invoices add column if not exists share_revoked_at timestamptz;
alter table vd_invoices add column if not exists share_issued_at  timestamptz;

update vd_invoices set share_issued_at = issued_at where share_issued_at is null;

alter table vd_invoices alter column share_issued_at set default now();
alter table vd_invoices alter column share_issued_at set not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. A revoked token opens nothing.
--    Rotation already guarantees this — the guard is here so revocation does
--    not silently depend on it, and so a token that leaks between the two
--    statements of a rotation is still refused.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_invoice_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_invoice  vd_invoices%rowtype;
  v_order    vd_orders%rowtype;
  v_receipts jsonb;
begin
  -- A short or empty token can never be a real one; don't even probe.
  if p_token is null or length(p_token) < 32 then return null; end if;

  select * into v_invoice from vd_invoices where share_token = p_token;
  if not found then return null; end if;
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
      'share_token', v_invoice.share_token,
      'share_issued_at', v_invoice.share_issued_at,
      'share_revoked_at', v_invoice.share_revoked_at,
      'first_viewed_at', v_invoice.first_viewed_at,
      'last_viewed_at', v_invoice.last_viewed_at,
      'view_count', v_invoice.view_count
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

-- A revoked link is no link at all — don't hand one to a guest who just
-- accepted a quote; the page falls back to asking them to sign in.
create or replace function public.vd_quote_invoice_link(p_quote_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_quote   vd_quotes%rowtype;
  v_invoice vd_invoices%rowtype;
begin
  select * into v_quote from vd_quotes where id = p_quote_id;
  if not found or v_quote.order_id is null then return null; end if;

  if v_quote.user_id is not null
     and auth.uid() is distinct from v_quote.user_id
     and not is_ops() then
    return null;
  end if;

  select * into v_invoice from vd_invoices
   where order_id = v_quote.order_id order by issued_at limit 1;
  if not found or v_invoice.share_revoked_at is not null then return null; end if;

  return jsonb_build_object('invoiceId', v_invoice.id, 'shareToken', v_invoice.share_token);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Revoke / re-issue. Staff only.
--
--    SECURITY DEFINER because the table's write policy is admin-only, while
--    the Invoices console is worked by finance and operations too — the same
--    people who send the links. is_ops() is the check, applied here rather
--    than inherited from RLS.
--
--    Both go through vd_audit: taking a customer's access to their own
--    invoice away, or replacing it, should be attributable afterwards.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_revoke_invoice_link(p_invoice_id text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_invoice vd_invoices%rowtype;
begin
  if not is_ops() then raise exception 'staff only'; end if;

  select * into v_invoice from vd_invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  if v_invoice.share_revoked_at is not null then return; end if; -- already revoked

  update vd_invoices set
    -- Rotated as well as flagged, so a copy of the old URL matches no row at
    -- all rather than relying on the flag being checked everywhere.
    share_token      = vd_new_share_token(),
    share_revoked_at = now()
  where id = p_invoice_id;

  perform vd_audit('invoice.link_revoked', 'invoice', p_invoice_id,
                   jsonb_build_object('invoiceNumber', v_invoice.invoice_number));
end;
$$;

create or replace function public.vd_reissue_invoice_link(p_invoice_id text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_invoice vd_invoices%rowtype;
  v_token   text := vd_new_share_token();
begin
  if not is_ops() then raise exception 'staff only'; end if;

  select * into v_invoice from vd_invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;

  update vd_invoices set
    share_token      = v_token,
    share_revoked_at = null,
    share_issued_at  = now()
  where id = p_invoice_id;

  perform vd_audit('invoice.link_reissued', 'invoice', p_invoice_id,
                   jsonb_build_object('invoiceNumber', v_invoice.invoice_number,
                                      'replacedRevokedLink', v_invoice.share_revoked_at is not null));

  return v_token;
end;
$$;

-- Staff-only, so no anon grant. Both are SECURITY DEFINER: revoke the default
-- PUBLIC execute first, or "staff only" would be the sole thing standing
-- between an anonymous caller and a customer's invoice link.
revoke execute on function public.vd_revoke_invoice_link(text)  from public;
revoke execute on function public.vd_reissue_invoice_link(text) from public;
grant  execute on function public.vd_revoke_invoice_link(text)  to authenticated;
grant  execute on function public.vd_reissue_invoice_link(text) to authenticated;
