-- ============================================================================
-- Visit Drakensberg — An invoice link opens on its own address
-- Run AFTER 20260809_invoice_link_revocation.sql.
--
-- What went wrong
-- ---------------
-- 20260808 put the credential in a `?t=<token>` query parameter. That works
-- only while the query string survives the trip to the customer, and often it
-- doesn't:
--   * every invoice emailed before that release carries a bare /invoices/:id;
--   * staff open an invoice from the console, copy what's in the address bar
--     (which has no token) and paste that to the customer;
--   * chat clients and mail readers linkify and truncate long URLs.
-- All three land the customer on "we couldn't open this invoice", which is
-- the same dead end the whole change set was meant to remove.
--
-- The fix
-- -------
-- Stop requiring the second secret. vd_invoices.id is 'inv-' || a v4 UUID —
-- 122 bits of randomness, already unguessable, and already the thing every
-- link contains. So the id IS the credential, exactly as vd_quotes has always
-- treated a guest quote's id ("the unguessable id IS the credential, same
-- trust model as sharing an invoice PDF").
--
-- The consequence, stated plainly: anyone holding an invoice's URL can read
-- that invoice — customer name, email, trip and line items — and pay it. That
-- is what "openable without signing in" means, and it is the same exposure an
-- emailed PDF has. It is bounded by the UUID: ids cannot be guessed, and
-- nothing here lets one invoice's link reach another's.
--
-- Two things are deliberately NOT accepted here, both of which the signed-in
-- lookup does accept:
--   * invoice_number — 'INV-2608-00001' is sequential. Opening that to the
--     public would let anyone walk the whole invoice book, one number at a
--     time. Every reference must contain a UUID to be usable.
--   * a revoked link — revocation has to mean something, so it gates this
--     path too.
--
-- Keeping revocation meaningful
-- -----------------------------
-- An invoice's id can't be rotated, so if the id alone always opened it,
-- revoking would be a one-way door: re-issuing to restore the customer's
-- access would also revive the copy that leaked. That guts the main reason to
-- revoke — a link reached the wrong person and the right one still needs to
-- pay.
--
-- So an invoice that has been revoked stops accepting its id (share_id_access
-- goes false, and stays false) and can only be re-opened with a fresh share
-- token. The link staff hand out afterwards is the longer '?t=' form, which
-- the leaked bare URL does not match. Invoices that were never revoked — very
-- nearly all of them — keep the short, unbreakable link.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Does this invoice still open on its own address?
--    False only once it has been revoked; re-issuing restores the link but
--    never this, so a leaked bare URL stays dead for good.
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_invoices add column if not exists share_id_access boolean not null default true;

-- An invoice sitting revoked right now was revoked under the old rules, where
-- the id opened nothing anyway. Close its id path so re-issuing hands out a
-- token link rather than quietly reviving the address.
update vd_invoices set share_id_access = false where share_revoked_at is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Is this reference unguessable enough to be a credential?
--    Matches the UUID that vd_create_order embeds in every id it mints
--    ('inv-…', 'vdo-…'), and rejects anything else — most importantly the
--    sequential invoice_number.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_is_unguessable_ref(p_ref text)
returns boolean language sql immutable as
$$ select coalesce(p_ref, '') ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Opening an invoice from its own link.
--    Accepts the invoice id or its order's id — both UUID-bearing — and
--    returns the same whitelisted payload vd_invoice_by_token does. A share
--    token is still accepted, so links already emailed with ?t= keep working.
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

-- Links already emailed with '?t=' keep working, through the same lookup —
-- vd_invoice_public's token branch is what 20260808's function did, so this
-- is now a thin alias rather than a second copy of the payload builder.
create or replace function public.vd_invoice_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  return vd_invoice_public(p_token);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Paying it. The gateway call is made server-side by the API route, which
--    needs the invoice's payable state without a session behind it. Same
--    credential rules as opening: UUID-bearing reference, not revoked — kept
--    here rather than re-implemented in the route so there is one definition
--    of what counts as a credential.
--
--    Not public: the route calls it with the service role. Nothing an
--    anonymous caller could learn from it that vd_invoice_public doesn't
--    already return, but there's no reason to widen the surface.
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
    'balance', v_invoice.balance,
    'status', v_invoice.status,
    'lines', v_invoice.lines
  );
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. View tracking follows the same rule, so an invoice opened from a plain
--    link still registers as read. Marking by id no longer requires a session
--    — holding the id is what proves you were given the link — but it still
--    demands a UUID-bearing id, so the sequential invoice numbers can't be
--    walked, and staff opens are still discarded.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_mark_invoice_viewed(
  p_token      text default null,
  p_invoice_id text default null
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_id   text;
  v_last timestamptz;
begin
  if is_ops() then return; end if;

  if p_token is not null and length(p_token) >= 32 then
    select id, last_viewed_at into v_id, v_last
      from vd_invoices where share_token = p_token and share_revoked_at is null;
  end if;

  if v_id is null and vd_is_unguessable_ref(p_invoice_id) then
    select id, last_viewed_at into v_id, v_last
      from vd_invoices
     where id = p_invoice_id and share_revoked_at is null
       and (share_id_access or user_id = auth.uid());
  end if;

  if v_id is null then return; end if;

  update vd_invoices set
    first_viewed_at = coalesce(first_viewed_at, now()),
    last_viewed_at  = now(),
    -- One "view" per sitting. The invoice page re-fetches itself every few
    -- seconds while a payment settles, and a customer re-opening the same
    -- link an hour later is what the team actually wants counted.
    view_count = view_count + case
      when v_last is null or v_last < now() - interval '30 minutes' then 1 else 0 end
  where id = v_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Revoke closes the id path for good.
--    Re-issue restores access with a fresh token but never re-opens the id,
--    so the URL that leaked stays dead while the customer gets a working one.
--    Unchanged from 20260809 apart from that: still staff-only, still audited.
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
    share_revoked_at = now(),
    share_id_access  = false
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
    -- share_id_access is deliberately left alone: an invoice that was once
    -- revoked never opens on its bare address again.
  where id = p_invoice_id;

  perform vd_audit('invoice.link_reissued', 'invoice', p_invoice_id,
                   jsonb_build_object('invoiceNumber', v_invoice.invoice_number,
                                      'replacedRevokedLink', v_invoice.share_revoked_at is not null));

  return v_token;
end;
$$;

grant execute on function public.vd_is_unguessable_ref(text)        to anon, authenticated;
grant execute on function public.vd_invoice_public(text)            to anon, authenticated;
grant execute on function public.vd_invoice_by_token(text)          to anon, authenticated;
grant execute on function public.vd_mark_invoice_viewed(text, text) to anon, authenticated;

-- Service-role only (see section 3).
revoke execute on function public.vd_invoice_payable(text) from public;
