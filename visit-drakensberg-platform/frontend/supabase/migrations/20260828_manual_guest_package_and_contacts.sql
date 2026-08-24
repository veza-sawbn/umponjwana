-- ============================================================================
-- Visit Drakensberg — manual departure guests: rate package + auto-contact
--
-- Two additions to the manually-added-guest flow (lib/departure-guests.ts):
--
-- 1. A manual guest can now record which rate package (DeparturePackage,
--    embedded in the departure's vd_entities.value.packages — never a
--    normalised row, so this is a plain text id, not a foreign key) they
--    actually paid for. Needed so their confirmation email and any itinerary
--    shown to them reflects the package-scoped day-by-day plan (see
--    resolveItinerary() in lib/tours.ts) rather than the departure's generic
--    default.
--
-- 2. Adding a manual guest now also adds them to the supplier's contacts
--    (vd_supplier_contacts, 20260826/20260827) via a new self-service RPC.
--    Kept as its own `source = 'manual'` bucket, isolated from 'booking'
--    (auto-derived from real order lines, never touched by hand) and
--    'imported' (admin CSV bulk import) — same reasoning as the 20260827
--    separation: each source is only ever written by its own path, so none
--    of the three can silently overwrite or be wiped by another.
-- ============================================================================

alter table vd_departure_guests add column if not exists package_id text;

alter table vd_supplier_contacts drop constraint if exists vd_supplier_contacts_source_check;
alter table vd_supplier_contacts add constraint vd_supplier_contacts_source_check
  check (source in ('booking', 'imported', 'manual'));

-- Re-adding a guest whose email already exists as a manual contact updates
-- it in place rather than duplicating — same pattern as the imported-email
-- index in 20260827, scoped to this source only.
create unique index if not exists vd_supplier_contacts_manual_email_uidx
  on vd_supplier_contacts (supplier_id, lower(email))
  where source = 'manual' and email is not null;

-- Self-service single-contact upsert — unlike vd_import_supplier_contacts
-- (admin-only, bulk), this is called by the supplier's own session (or an
-- ops agent managing them) when they add a guest by hand, so the
-- authorization check mirrors "Suppliers manage own departure guests" in
-- 20260821_departure_guests.sql rather than requiring is_admin().
create or replace function public.vd_add_supplier_contact(
  p_supplier_id uuid, p_name text, p_email text, p_phone text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name  text := nullif(trim(p_name), '');
  v_email text := nullif(trim(p_email), '');
  v_phone text := nullif(trim(p_phone), '');
  v_id    uuid;
begin
  if not (p_supplier_id = auth.uid() or is_managed_supplier(p_supplier_id) or is_admin()) then
    raise exception 'not authorized for this supplier';
  end if;
  if v_name is null and v_email is null then
    raise exception 'name or email required';
  end if;

  if v_email is not null then
    insert into vd_supplier_contacts (supplier_id, customer_user_id, name, email, phone, source, updated_at)
    values (p_supplier_id, null, v_name, v_email, v_phone, 'manual', now())
    on conflict (supplier_id, lower(email)) where source = 'manual' and email is not null do update set
      name = coalesce(excluded.name, vd_supplier_contacts.name),
      phone = coalesce(excluded.phone, vd_supplier_contacts.phone),
      updated_at = now()
    returning id into v_id;
  else
    -- No email to de-dupe on — each no-email guest becomes its own row,
    -- same as a no-email CSV row in vd_import_supplier_contacts.
    insert into vd_supplier_contacts (supplier_id, customer_user_id, name, email, phone, source, updated_at)
    values (p_supplier_id, null, v_name, null, v_phone, 'manual', now())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
grant execute on function public.vd_add_supplier_contact(uuid, text, text, text) to authenticated;
