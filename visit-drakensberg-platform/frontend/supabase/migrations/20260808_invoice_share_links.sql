-- ============================================================================
-- Visit Drakensberg — Invoice share links + view tracking
-- Run AFTER 20260716_order_management.sql and 20260804_guest_orders_repair.sql.
--
-- The problem this fixes
-- ----------------------
-- vd_invoices is readable only by `user_id = auth.uid()` or by staff. That
-- makes the invoice link we email essentially unopenable for the people it is
-- sent to:
--   * a customer reading mail on a phone they have never signed in on;
--   * a *guest* order (walk-in / phone booking, or an accepted guest quote),
--     where user_id IS NULL — no account can ever match, so the customer is
--     locked out permanently;
--   * anyone the team forwards the link to over WhatsApp/SMS.
-- All of them land on "Invoice not found, or you don't have access to it."
--
-- The fix
-- -------
-- Every invoice carries an unguessable share_token (256 bits of randomness).
-- Holding the token is what grants read access — the same trust model already
-- used for guest quotes ("the link IS the credential"), and the same one a
-- PDF attached to an email has always had.
--
-- The token is spent through SECURITY DEFINER functions rather than by
-- loosening RLS, so:
--   * the table itself stays closed (no anon SELECT policy to get wrong);
--   * the returned payload is a whitelist — the customer-safe invoice, the
--     customer's own order header and their receipts. No supplier payout
--     data, no commission, no other orders.
--
-- It also records when the link was opened, so the team can tell an invoice
-- that was never read from one that is being ignored.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Token generator
--    Two v4 UUIDs' worth of entropy rendered as 64 hex characters. Built on
--    gen_random_uuid(), which the rest of the schema already relies on, so
--    this needs no extension that isn't already present.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_new_share_token()
returns text language sql volatile as
$$ select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Columns. Backfill before the default/NOT NULL so existing invoices —
--    the ones customers are currently unable to open — become shareable too.
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_invoices add column if not exists share_token     text;
alter table vd_invoices add column if not exists first_viewed_at timestamptz;
alter table vd_invoices add column if not exists last_viewed_at  timestamptz;
alter table vd_invoices add column if not exists view_count      integer not null default 0;

update vd_invoices set share_token = vd_new_share_token() where share_token is null;

alter table vd_invoices alter column share_token set default vd_new_share_token();
alter table vd_invoices alter column share_token set not null;

-- Unique both as a correctness guard and because the lookups below are by
-- token — this index is what makes them a single-row probe.
create unique index if not exists vd_invoices_share_token_idx on vd_invoices (share_token);

-- vd_create_order inserts an explicit column list that does not mention
-- share_token, so every future invoice picks the token up from the default.
-- No change to that function is needed.

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Reading an invoice with its token
--    Whitelisted payload, assembled server-side. Deliberately returns NULL
--    (not an exception) for an unknown token: the page shows one honest
--    "this link is no longer valid" message either way, and a distinct error
--    would confirm which tokens exist.
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
      'first_viewed_at', v_invoice.first_viewed_at,
      'last_viewed_at', v_invoice.last_viewed_at,
      'view_count', v_invoice.view_count
    ),
    -- Order header only: what the invoice document prints. No totals beyond
    -- the invoice's own, no booking payload, no supplier allocation.
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
-- 4. Recording that the customer opened it
--    Either by token (the shared link) or by id (a signed-in customer opening
--    their own invoice from their account) — both are the customer reading
--    the invoice, which is what the team wants to see.
--
--    Staff opens are ignored on purpose: a colleague checking the link before
--    sending it must not read back as "the customer has seen this".
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
    select id, last_viewed_at into v_id, v_last from vd_invoices where share_token = p_token;
  elsif p_invoice_id is not null and auth.uid() is not null then
    -- No token: only the invoice's own account holder may mark it read, so
    -- this can't be used to probe for or touch someone else's invoice.
    select id, last_viewed_at into v_id, v_last
      from vd_invoices where id = p_invoice_id and user_id = auth.uid();
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
-- 5. The three finance settings the invoice document itself renders.
--    vd_finance_settings is otherwise authenticated-only, which was invisible
--    while invoices needed a login anyway — now that a customer opens theirs
--    with no session, an unreadable tipping_enabled would silently hide the
--    gratuity block from exactly the guests it exists for. Only these three
--    keys open up; commission and fee rates stay staff-only.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Public read display finance settings" on vd_finance_settings;
create policy "Public read display finance settings" on vd_finance_settings
  for select using (key in ('tipping_enabled', 'tip_presets', 'default_currency'));

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Quote acceptance → payable invoice
--    A guest accepting a quote gets an invoice they immediately cannot open,
--    for exactly the reason above. They already hold the quote link, which is
--    that quote's credential, so trade it for the new invoice's share token.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_quote_invoice_link(p_quote_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_quote   vd_quotes%rowtype;
  v_invoice vd_invoices%rowtype;
begin
  select * into v_quote from vd_quotes where id = p_quote_id;
  if not found or v_quote.order_id is null then return null; end if;

  -- A quote that belongs to an account is only tradeable by that account (or
  -- staff). A guest quote's id is its own credential, as it is everywhere
  -- else in the quote flow.
  if v_quote.user_id is not null
     and auth.uid() is distinct from v_quote.user_id
     and not is_ops() then
    return null;
  end if;

  select * into v_invoice from vd_invoices
   where order_id = v_quote.order_id order by issued_at limit 1;
  if not found then return null; end if;

  return jsonb_build_object('invoiceId', v_invoice.id, 'shareToken', v_invoice.share_token);
end;
$$;

grant execute on function public.vd_invoice_by_token(text)          to anon, authenticated;
grant execute on function public.vd_mark_invoice_viewed(text, text) to anon, authenticated;
grant execute on function public.vd_quote_invoice_link(text)        to anon, authenticated;
