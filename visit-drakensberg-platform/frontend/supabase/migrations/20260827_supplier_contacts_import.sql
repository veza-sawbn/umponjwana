-- ============================================================================
-- Visit Drakensberg — Supplier Contacts: bulk CSV import (admin only)
--
-- Admin can now bulk-import a contact list (name/email/phone) into a chosen
-- supplier's address book, e.g. from a spreadsheet the supplier already had
-- before joining the platform. These imported rows are kept clearly apart
-- from the auto-derived, booking-based ones added in 20260826:
--   * source = 'imported' vs 'booking' distinguishes the two.
--   * an imported row has no customer_user_id (there's no real platform
--     account or order behind it), no booking stats, and is never touched
--     or deleted by vd_recompute_supplier_contacts() — that function only
--     ever manages source = 'booking' rows, so CSV data can't be silently
--     overwritten or wiped by real booking activity, and vice versa.
-- Still no manual-entry path for the booking-derived contacts themselves,
-- and still nothing to do with the admin "Guest / manual details" invoice
-- flow — this is a separate, explicitly-labelled bucket within the same
-- table, not a change to how booking-derived contacts are produced.
-- ============================================================================

alter table vd_supplier_contacts
  add column if not exists source text not null default 'booking'
    check (source in ('booking', 'imported'));

-- An imported contact has no real auth.users row to point at.
alter table vd_supplier_contacts alter column customer_user_id drop not null;

-- The old unconditional unique constraint can't survive customer_user_id
-- going nullable (multiple NULLs would already be allowed by unique
-- semantics, but that's an accident, not a guarantee) — replaced with two
-- explicit partial indexes, one per source.
alter table vd_supplier_contacts
  drop constraint if exists vd_supplier_contacts_supplier_id_customer_user_id_key;
create unique index if not exists vd_supplier_contacts_booking_uidx
  on vd_supplier_contacts (supplier_id, customer_user_id)
  where customer_user_id is not null;
-- Re-importing the same list (or importing an updated one) updates existing
-- rows by email rather than duplicating them.
create unique index if not exists vd_supplier_contacts_imported_email_uidx
  on vd_supplier_contacts (supplier_id, lower(email))
  where source = 'imported' and email is not null;

create or replace function public.vd_recompute_supplier_contacts()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_upserted integer;
  v_deleted  integer;
begin
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'admin only';
  end if;

  -- Materialised once so both the upsert and the stale-row cleanup below
  -- see exactly the same snapshot of "who currently has an active line".
  create temporary table _vd_contact_agg on commit drop as
  with lines as (
    -- bk.value->>'customerPhone' is the number actually supplied for
    -- fulfilment at checkout (see lib/bookings.ts/lib/orders.ts) —
    -- profiles.phone is never populated by the normal signup or account-
    -- settings flow (that writes to auth user_metadata instead), so it
    -- would leave this address book's phone blank for real customers.
    select l.supplier_id, l.user_id, l.order_id, l.created_at, l.gross_amount, l.discount_amount,
           l.share_customer_name, l.customer_name, o.customer_email, bk.value->>'customerPhone' as customer_phone
    from vd_order_lines l
    join vd_orders o on o.id = l.order_id
    left join vd_bookings bk on bk.id = o.booking_id
    where l.user_id is not null and l.supplier_id is not null and l.fulfilment_status <> 'cancelled'
  )
  select
    supplier_id, user_id,
    count(distinct order_id) as booking_count,
    sum(gross_amount - discount_amount) as lifetime_spend,
    min(created_at) as first_booking_at,
    max(created_at) as last_booking_at,
    (array_agg(customer_name order by created_at desc)
      filter (where share_customer_name and customer_name is not null and customer_name <> ''))[1] as name,
    (array_agg(customer_email order by created_at desc)
      filter (where customer_email is not null and customer_email <> ''))[1] as email,
    (array_agg(customer_phone order by created_at desc)
      filter (where customer_phone is not null and customer_phone <> ''))[1] as phone
  from lines
  group by supplier_id, user_id;

  insert into vd_supplier_contacts (
    supplier_id, customer_user_id, name, email, phone,
    first_booking_at, last_booking_at, booking_count, lifetime_spend, source, updated_at
  )
  select a.supplier_id, a.user_id, a.name, a.email, a.phone,
         a.first_booking_at, a.last_booking_at, a.booking_count, a.lifetime_spend, 'booking', now()
  from _vd_contact_agg a
  on conflict (supplier_id, customer_user_id) where customer_user_id is not null do update set
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    first_booking_at = excluded.first_booking_at,
    last_booking_at = excluded.last_booking_at,
    booking_count = excluded.booking_count,
    lifetime_spend = excluded.lifetime_spend,
    updated_at = now();
  get diagnostics v_upserted = row_count;

  -- Only ever retires source = 'booking' rows — an imported row has no
  -- corresponding entry in the snapshot by definition and must never be
  -- removed by this function.
  delete from vd_supplier_contacts c
  where c.source = 'booking' and not exists (
    select 1 from _vd_contact_agg a
    where a.supplier_id = c.supplier_id and a.user_id = c.customer_user_id
  );
  get diagnostics v_deleted = row_count;

  return v_upserted + v_deleted;
end;
$$;

-- Bulk CSV import — admin only. p_rows is a jsonb array of
-- {"name": text, "email": text, "phone": text}; email (case-insensitive) is
-- the de-dupe key within a supplier's imported set when present, so
-- re-uploading an updated list updates in place rather than duplicating.
-- Rows with neither a name nor an email are skipped as unusable.
create or replace function public.vd_import_supplier_contacts(p_supplier_id uuid, p_rows jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from auth.users where id = p_supplier_id) then
    raise exception 'unknown supplier';
  end if;

  with rows as (
    select
      nullif(trim(r->>'name'), '')  as name,
      nullif(trim(r->>'email'), '') as email,
      nullif(trim(r->>'phone'), '') as phone
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    where nullif(trim(r->>'name'), '') is not null or nullif(trim(r->>'email'), '') is not null
  )
  insert into vd_supplier_contacts (supplier_id, customer_user_id, name, email, phone, source, updated_at)
  select p_supplier_id, null, name, email, phone, 'imported', now()
  from rows
  on conflict (supplier_id, lower(email)) where source = 'imported' and email is not null do update set
    name = excluded.name,
    phone = excluded.phone,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.vd_import_supplier_contacts(uuid, jsonb) to authenticated;
