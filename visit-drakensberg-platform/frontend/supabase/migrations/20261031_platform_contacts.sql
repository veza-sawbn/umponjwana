-- ============================================================================
-- Visit Drakensberg — The platform contact book (vd_contacts)
-- Run AFTER 20261015_invoice_draft_billing.sql.
--
-- Until now the "New Invoice" form could only pick from registered accounts
-- (profiles). The ~570 contacts imported from Wix sit in a supplier address
-- book (vd_supplier_contacts, source = 'imported'), and every walk-in
-- customer invoiced through "Guest / manual details" was typed in once and
-- then forgotten, so the next invoice for the same person meant typing them
-- in again.
--
-- This adds one address book for the platform itself, the way Wix keeps one
-- contact list for the whole site:
--
--   vd_contacts            name, email, phone, billing details, which sources
--                          the contact came from, and invoicing stats.
--                          One row per email (case-insensitive); a contact
--                          with no email is keyed on the digits of its phone.
--
-- Where contacts come from:
--   * 'imported'  the Wix import already in vd_supplier_contacts (backfilled
--                 once below), and any later CSV import through
--                 vd_import_contacts().
--   * 'account'   registered visitor accounts — backfilled below, and kept in
--                 step by a trigger on profiles.
--   * 'invoice'   ANY customer an invoice is generated for, checkout or
--                 manual — backfilled below, and added automatically by a
--                 trigger on vd_invoices from now on. A later change to the
--                 order's customer details (vd_update_order_customer) flows
--                 through too.
--   * 'manual'    added by hand from the admin Contacts page.
--
-- Merging: invoice details are the most recent thing the customer told us, so
-- they overwrite; an import or an account only fills in what is still blank,
-- so re-importing an old Wix export can never undo a correction.
--
-- Access: staff (is_ops — admin, finance, operations) read it. Nobody writes
-- to it directly; every write goes through the functions below.
-- Supplier address books are untouched.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

create table if not exists vd_contacts (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null default '',
  email                text,                       -- lower-cased; null when unknown
  phone                text not null default '',
  phone_digits         text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  user_id              uuid references auth.users(id) on delete set null,
  is_company           boolean not null default false,
  company              text not null default '',
  vat_number           text not null default '',
  registration_number  text not null default '',
  address              text not null default '',
  sources              text[] not null default '{}',
  invoice_count        integer not null default 0,
  last_invoiced_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists vd_contacts_email_uidx on vd_contacts (email) where email is not null;
create unique index if not exists vd_contacts_phone_uidx on vd_contacts (phone_digits)
  where email is null and phone_digits <> '';
create index if not exists vd_contacts_user_idx on vd_contacts (user_id);
create index if not exists vd_contacts_name_idx on vd_contacts (lower(name));

alter table vd_contacts enable row level security;
drop policy if exists "Staff read contacts" on vd_contacts;
create policy "Staff read contacts" on vd_contacts for select using (coalesce(is_ops(), false));
-- No insert/update/delete policy: writes only through the functions below.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Merge one person into the book. Internal — not granted to anyone; the
--    triggers and the staff-facing functions below call it.
--    p jsonb: name, email, phone, userId, isCompany, company, vatNumber,
--             registrationNumber, address
--    p_prefer_new: true overwrites existing values with non-empty new ones;
--                  false only fills in what is blank.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_contact_merge(p jsonb, p_source text, p_prefer_new boolean)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_name    text := left(btrim(coalesce(p->>'name', '')), 200);
  v_email   text := lower(btrim(coalesce(p->>'email', '')));
  v_phone   text := left(btrim(coalesce(p->>'phone', '')), 40);
  v_digits  text;
  v_user    uuid;
  v_company boolean := coalesce((p->>'isCompany')::boolean, false);
  v_cname   text := left(btrim(coalesce(p->>'company', '')), 200);
  v_vat     text := left(btrim(coalesce(p->>'vatNumber', '')), 30);
  v_reg     text := left(btrim(coalesce(p->>'registrationNumber', '')), 40);
  v_address text := left(btrim(coalesce(p->>'address', '')), 500);
  v_id      uuid;
begin
  begin v_user := nullif(p->>'userId', '')::uuid; exception when others then v_user := null; end;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 320 then v_email := null; end if;
  v_digits := regexp_replace(v_phone, '\D', '', 'g');
  if length(v_digits) < 7 then v_digits := null; end if;

  -- Nothing to file someone under.
  if v_email is null and v_digits is null and v_user is null then return null; end if;
  -- A bare phone number with no name and no email is still a Wix contact
  -- worth keeping (Wix lists them under the number), so it is not rejected.

  if v_email is not null then
    select id into v_id from vd_contacts where email = v_email;
  end if;
  if v_id is null and v_user is not null then
    select id into v_id from vd_contacts where user_id = v_user
     order by (email is null) desc, created_at limit 1;
    -- That account's contact already carries a different email: keep both.
    if v_id is not null and v_email is not null
       and exists (select 1 from vd_contacts where id = v_id and email is not null and email <> v_email) then
      v_id := null;
    end if;
  end if;
  if v_id is null and v_digits is not null then
    select id into v_id from vd_contacts where email is null and phone_digits = v_digits;
  end if;

  if v_id is null then
    insert into vd_contacts (name, email, phone, user_id, is_company, company, vat_number,
                             registration_number, address, sources)
    values (v_name, v_email, v_phone, v_user, v_company, v_cname, v_vat, v_reg, v_address,
            array[p_source])
    returning id into v_id;
    return v_id;
  end if;

  update vd_contacts c set
    name    = case when v_name <> '' and (p_prefer_new or c.name = '') then v_name else c.name end,
    email   = coalesce(c.email, v_email),
    phone   = case when v_phone <> '' and (p_prefer_new or c.phone = '') then v_phone else c.phone end,
    user_id = coalesce(c.user_id, v_user),
    -- Company billing travels as one block: only replaced by a new block
    -- that actually says something.
    is_company = case when (v_company or v_cname <> '') and (p_prefer_new or c.company = '') then v_company else c.is_company end,
    company    = case when (v_company or v_cname <> '') and (p_prefer_new or c.company = '') then v_cname else c.company end,
    vat_number = case when v_vat <> '' and (p_prefer_new or c.vat_number = '') then v_vat else c.vat_number end,
    registration_number = case when v_reg <> '' and (p_prefer_new or c.registration_number = '') then v_reg else c.registration_number end,
    address = case when v_address <> '' and (p_prefer_new or c.address = '') then v_address else c.address end,
    sources = case when p_source = any(c.sources) then c.sources else c.sources || p_source end,
    updated_at = now()
  where c.id = v_id;
  return v_id;
end;
$$;
revoke all on function public.vd_contact_merge(jsonb, text, boolean) from public, anon, authenticated;

-- Invoicing stats for one contact: orders with at least one invoice, matched
-- on the contact's email or its account.
create or replace function public.vd_contact_refresh_stats(p_id uuid)
returns void language sql volatile security definer set search_path = public as $$
  update vd_contacts c set
    invoice_count    = s.n,
    last_invoiced_at = s.last_at
  from (
    select count(distinct o.id)::int as n, max(i.issued_at) as last_at
      from vd_contacts c2
      join vd_orders o on (c2.email is not null and lower(o.customer_email) = c2.email)
                       or (c2.user_id is not null and o.user_id = c2.user_id)
      join vd_invoices i on i.order_id = o.id
     where c2.id = p_id
  ) s
  where c.id = p_id;
$$;
revoke all on function public.vd_contact_refresh_stats(uuid) from public, anon, authenticated;

/** The order's customer as a merge payload. */
create or replace function public.vd_contact_from_order(o vd_orders)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'name', o.customer_name,
    'email', o.customer_email,
    'phone', coalesce(nullif(o.customer_phone, ''), o.value->>'customerPhone', ''),
    'userId', o.user_id,
    'isCompany', o.customer_is_company,
    'company', o.customer_company,
    'vatNumber', o.customer_vat_number,
    'registrationNumber', o.customer_registration_number,
    'address', o.customer_address)
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Automatic adds. A contact-book problem must never stop an invoice being
--    issued or a customer signing up, so each trigger swallows its own errors
--    (with a warning in the logs) rather than aborting the transaction.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_contacts_on_invoice()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order vd_orders%rowtype;
  v_id    uuid;
begin
  begin
    select * into v_order from vd_orders where id = new.order_id;
    if found then
      v_id := vd_contact_merge(vd_contact_from_order(v_order), 'invoice', true);
      if v_id is not null then perform vd_contact_refresh_stats(v_id); end if;
    end if;
  exception when others then
    raise warning 'vd_contacts_on_invoice(%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists vd_contacts_on_invoice on vd_invoices;
create trigger vd_contacts_on_invoice after insert on vd_invoices
  for each row execute function vd_contacts_on_invoice();

-- Corrections to an invoiced order's customer (vd_update_order_customer, and
-- the company details the New Invoice form saves straight after creating).
create or replace function public.vd_contacts_on_order_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  begin
    if exists (select 1 from vd_invoices where order_id = new.id) then
      v_id := vd_contact_merge(vd_contact_from_order(new), 'invoice', true);
      if v_id is not null then perform vd_contact_refresh_stats(v_id); end if;
    end if;
  exception when others then
    raise warning 'vd_contacts_on_order_customer(%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists vd_contacts_on_order_customer on vd_orders;
create trigger vd_contacts_on_order_customer
  after update of customer_name, customer_email, customer_phone, customer_is_company,
                  customer_company, customer_vat_number, customer_registration_number, customer_address
  on vd_orders
  for each row
  when (row(old.customer_name, old.customer_email, old.customer_phone, old.customer_is_company,
            old.customer_company, old.customer_vat_number, old.customer_registration_number, old.customer_address)
        is distinct from
        row(new.customer_name, new.customer_email, new.customer_phone, new.customer_is_company,
            new.customer_company, new.customer_vat_number, new.customer_registration_number, new.customer_address))
  execute function vd_contacts_on_order_customer();

-- Registered visitors. Suppliers and staff are not customers.
create or replace function public.vd_contacts_on_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.role::text = 'visitor' and coalesce(new.email, '') <> '' then
      perform vd_contact_merge(jsonb_build_object(
        'name', coalesce(new.full_name, ''), 'email', new.email,
        'phone', coalesce(new.phone, ''), 'userId', new.id), 'account', false);
    elsif new.role::text <> 'visitor' then
      -- Promoted to supplier or staff (signup creates every account as a
      -- visitor first): drop the contact if being an account was the only
      -- reason it was in the book.
      delete from vd_contacts where user_id = new.id and sources = array['account'];
    end if;
  exception when others then
    raise warning 'vd_contacts_on_profile(%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists vd_contacts_on_profile on profiles;
create trigger vd_contacts_on_profile after insert or update of email, full_name, role on profiles
  for each row execute function vd_contacts_on_profile();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Staff-facing writes.
-- ────────────────────────────────────────────────────────────────────────────

/** Add (or update, by email/phone) one contact by hand. Returns its id. */
create or replace function public.vd_save_contact(p_contact jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_contact->>'email', '')));
  v_id    uuid;
begin
  if not coalesce(is_ops(), false) then raise exception 'staff only'; end if;
  if p_contact is null or jsonb_typeof(p_contact) <> 'object' then raise exception 'contact required'; end if;
  if btrim(coalesce(p_contact->>'name', '')) = '' then raise exception 'a name is required'; end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'that email address is not valid'; end if;
  if v_email = '' and length(regexp_replace(coalesce(p_contact->>'phone', ''), '\D', '', 'g')) < 7 then
    raise exception 'an email or a phone number is required';
  end if;
  v_id := vd_contact_merge(p_contact - 'userId', 'manual', true);
  perform vd_contact_refresh_stats(v_id);
  return v_id;
end;
$$;
grant execute on function public.vd_save_contact(jsonb) to authenticated;

/**
 * Bulk import (e.g. a Wix contacts export). p_rows: [{name, email, phone}].
 * Only fills in blanks on contacts we already have, so re-importing an old
 * export never undoes a correction. Returns how many rows were filed.
 */
create or replace function public.vd_import_contacts(p_rows jsonb)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  r       jsonb;
  v_id    uuid;
  v_count integer := 0;
begin
  if not coalesce(is_ops(), false) then raise exception 'staff only'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 20000 then raise exception 'too many rows in one import'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_id := vd_contact_merge(r - 'userId', 'imported', false);
    if v_id is not null then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;
grant execute on function public.vd_import_contacts(jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Backfill — oldest first, so the most recent invoice's details win.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  o vd_orders%rowtype;
begin
  -- The Wix import, from the supplier address book it was loaded into.
  for r in select name, email, phone from vd_supplier_contacts
            where source = 'imported' order by created_at loop
    perform vd_contact_merge(jsonb_build_object('name', coalesce(r.name, ''), 'email', r.email,
                                                'phone', coalesce(r.phone, '')), 'imported', false);
  end loop;

  -- Registered visitors.
  for r in select id, full_name, email, phone from profiles
            where role::text = 'visitor' and coalesce(email, '') <> '' order by created_at loop
    perform vd_contact_merge(jsonb_build_object('name', coalesce(r.full_name, ''), 'email', r.email,
                                                'phone', coalesce(r.phone, ''), 'userId', r.id), 'account', false);
  end loop;

  -- Everyone who has been invoiced.
  for o in select * from vd_orders x
            where exists (select 1 from vd_invoices i where i.order_id = x.id)
            order by x.created_at loop
    perform vd_contact_merge(vd_contact_from_order(o), 'invoice', true);
  end loop;

  for r in select id from vd_contacts loop
    perform vd_contact_refresh_stats(r.id);
  end loop;
end $$;
