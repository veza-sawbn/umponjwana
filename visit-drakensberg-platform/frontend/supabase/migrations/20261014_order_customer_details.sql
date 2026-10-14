-- ============================================================================
-- Visit Drakensberg — Editable customer details on Master Orders, with
-- company (VAT / registration number) billing
-- Run AFTER 20261011_invoice_payment_schedules.sql.
--
-- Until now an order's customer was fixed at checkout: a typo in the name or
-- email could only be fixed in the SQL editor, and there was nowhere to put a
-- company's VAT or registration number, which a company customer needs on its
-- tax invoice to claim the input VAT.
--
-- This adds, on vd_orders:
--   customer_phone               — was only in value->>'customerPhone' (guests)
--   customer_is_company          — bill to a company rather than a person
--   customer_company             — registered company name
--   customer_vat_number          — the company's VAT number
--   customer_registration_number — CIPC (or foreign) registration number
--   customer_address             — billing address, free text
--
-- Writes go through vd_update_order_customer (staff only, validated, audited).
-- It also keeps the copy of the name on vd_order_lines in step, for lines
-- that share the customer's name with their supplier.
--
-- The customer's invoice view (vd_invoice_public) now carries the company
-- fields, so the tax invoice shows who it is addressed to.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

alter table vd_orders add column if not exists customer_phone               text not null default '';
alter table vd_orders add column if not exists customer_is_company          boolean not null default false;
alter table vd_orders add column if not exists customer_company             text not null default '';
alter table vd_orders add column if not exists customer_vat_number          text not null default '';
alter table vd_orders add column if not exists customer_registration_number text not null default '';
alter table vd_orders add column if not exists customer_address             text not null default '';

-- Guests' phone numbers were only kept in the order's value blob.
update vd_orders
   set customer_phone = value->>'customerPhone'
 where customer_phone = ''
   and coalesce(value->>'customerPhone', '') <> '';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. The setter. Operations, finance and admins — the people who take the
--    customer's call — may correct the details. Every change is audited with
--    what it was before.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_update_order_customer(
  p_order_id text,
  p_details  jsonb
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_order   vd_orders%rowtype;
  v_name    text := btrim(coalesce(p_details->>'name', ''));
  v_email   text := lower(btrim(coalesce(p_details->>'email', '')));
  v_phone   text := btrim(coalesce(p_details->>'phone', ''));
  v_company boolean := coalesce((p_details->>'isCompany')::boolean, false);
  v_cname   text := btrim(coalesce(p_details->>'company', ''));
  v_vat     text := upper(regexp_replace(btrim(coalesce(p_details->>'vatNumber', '')), '\s+', '', 'g'));
  v_reg     text := upper(btrim(coalesce(p_details->>'registrationNumber', '')));
  v_address text := btrim(coalesce(p_details->>'address', ''));
begin
  if not is_ops() then raise exception 'staff only'; end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then raise exception 'details required'; end if;

  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  if v_name = '' then raise exception 'customer name is required'; end if;
  if length(v_name) > 200 then raise exception 'customer name is too long'; end if;
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'a valid customer email is required';
  end if;
  if length(v_email) > 320 then raise exception 'customer email is too long'; end if;
  if length(v_phone) > 40 then raise exception 'phone number is too long'; end if;
  if length(v_address) > 500 then raise exception 'billing address is too long'; end if;

  if v_company then
    if v_cname = '' then raise exception 'company name is required for a company customer'; end if;
    if length(v_cname) > 200 then raise exception 'company name is too long'; end if;
    if length(v_vat) > 30 then raise exception 'VAT number is too long'; end if;
    if length(v_reg) > 40 then raise exception 'registration number is too long'; end if;
    -- A South African VAT number is ten digits starting with 4. Anything else
    -- that is all digits is almost certainly a typo; a foreign number (with
    -- letters, e.g. GB123456789) is allowed through as typed.
    if v_vat ~ '^\d+$' and v_vat !~ '^4\d{9}$' then
      raise exception 'a South African VAT number is 10 digits starting with 4';
    end if;
  else
    -- An individual has no company details; clear any left from before.
    v_cname := ''; v_vat := ''; v_reg := '';
  end if;

  update vd_orders set
    customer_name                = v_name,
    customer_email               = v_email,
    customer_phone               = v_phone,
    customer_is_company          = v_company,
    customer_company             = v_cname,
    customer_vat_number          = v_vat,
    customer_registration_number = v_reg,
    customer_address             = v_address,
    updated_at                   = now()
  where id = p_order_id;

  -- Suppliers see the guest's name on their own lines where it was shared.
  if v_name <> v_order.customer_name then
    update vd_order_lines set customer_name = v_name, updated_at = now()
     where order_id = p_order_id and share_customer_name;
  end if;

  perform vd_audit('order.customer_updated', 'order', p_order_id,
    jsonb_build_object(
      'orderNumber', v_order.order_number,
      'from', jsonb_build_object(
        'name', v_order.customer_name, 'email', v_order.customer_email,
        'phone', v_order.customer_phone, 'isCompany', v_order.customer_is_company,
        'company', v_order.customer_company, 'vatNumber', v_order.customer_vat_number,
        'registrationNumber', v_order.customer_registration_number,
        'address', v_order.customer_address),
      'to', jsonb_build_object(
        'name', v_name, 'email', v_email, 'phone', v_phone, 'isCompany', v_company,
        'company', v_cname, 'vatNumber', v_vat, 'registrationNumber', v_reg,
        'address', v_address)
    ));
end;
$$;

revoke execute on function public.vd_update_order_customer(text, jsonb) from public, anon;
grant  execute on function public.vd_update_order_customer(text, jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. The customer's invoice view carries the billing details.
--    Identical to 20261011 apart from the added order keys.
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
      'customer_is_company', v_order.customer_is_company,
      'customer_company', v_order.customer_company,
      'customer_vat_number', v_order.customer_vat_number,
      'customer_registration_number', v_order.customer_registration_number,
      'customer_address', v_order.customer_address,
      'trip_name', v_order.trip_name,
      'travel_start', v_order.travel_start,
      'travel_end', v_order.travel_end,
      'currency', v_order.currency
    ) end,
    'receipts', v_receipts
  );
end;
$$;
