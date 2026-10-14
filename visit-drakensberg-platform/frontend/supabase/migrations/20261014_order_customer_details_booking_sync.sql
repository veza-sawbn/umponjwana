-- ============================================================================
-- Visit Drakensberg — Customer corrections reach the supplier's booking copy
-- Run AFTER 20261014_order_customer_details.sql.
--
-- vd_update_order_customer corrected the Master Order, but a checkout order's
-- booking keeps its own snapshot of the customer's contact details, and that
-- snapshot is what suppliers actually read:
--   * their booking screens hydrate from vd_booking_orders.value;
--   * their address book (vd_recompute_supplier_contacts) takes the phone
--     from vd_bookings.value.
-- So a supplier went on seeing — and calling — the old, wrong details after
-- staff had been told the correction was saved.
--
-- This replaces the function so it also rewrites those snapshots, touching
-- only the keys each one already carries. Otherwise identical.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

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

  -- A checkout order's booking keeps its own copy of the contact details:
  -- suppliers' booking screens read vd_booking_orders.value, and the
  -- supplier address book (vd_recompute_supplier_contacts, run by cron)
  -- takes the phone from vd_bookings.value. Correct those copies too, but
  -- only the keys they already carry — this never shares more with a
  -- supplier than the booking did.
  if v_order.booking_id is not null then
    update vd_bookings set value = value || jsonb_strip_nulls(jsonb_build_object(
        'customerName',  case when value ? 'customerName'  then v_name  end,
        'customerEmail', case when value ? 'customerEmail' then v_email end,
        'customerPhone', case when value ? 'customerPhone' then v_phone end))
     where id = v_order.booking_id;
    update vd_booking_orders set value = value || jsonb_strip_nulls(jsonb_build_object(
        'customerName',  case when value ? 'customerName'  then v_name  end,
        'customerEmail', case when value ? 'customerEmail' then v_email end,
        'customerPhone', case when value ? 'customerPhone' then v_phone end))
     where booking_id = v_order.booking_id;
  end if;

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

