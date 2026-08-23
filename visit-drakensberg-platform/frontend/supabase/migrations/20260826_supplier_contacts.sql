-- ============================================================================
-- Visit Drakensberg — Supplier Contacts
--
-- Every customer who has actually transacted with a supplier automatically
-- becomes one of that supplier's contacts — a reusable, per-supplier address
-- book (name/email/phone + booking history summary) derived from real order
-- lines, never hand-entered. Nothing here touches the admin "Guest / manual
-- details" one-off invoice flow (app/admin/invoices) — that stays exactly
-- as it is: platform-level, not tied to any supplier, and produces no
-- contact anywhere. There is no manual-entry path into this table at all,
-- by design, so a walk-in guest invoice can never accidentally create or
-- pollute a supplier's contact list.
--
-- Isolation: each supplier reads only their own contacts (their own
-- customer relationships) — never another supplier's. Admin reads across
-- all suppliers. Same shape as every other supplier-scoped table in this
-- schema (vd_order_lines, vd_booking_orders, vd_settlements, …).
-- ============================================================================

create table if not exists vd_supplier_contacts (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid not null references auth.users(id) on delete cascade,
  customer_user_id   uuid not null references auth.users(id) on delete cascade,
  -- Denormalised snapshot, not a live join — profiles/vd_orders aren't
  -- readable by the owning supplier under RLS, so these are populated by
  -- vd_recompute_supplier_contacts() (SECURITY DEFINER, reads across that
  -- boundary) and are what the supplier actually sees.
  name               text,
  email              text,
  phone              text,
  first_booking_at   timestamptz,
  last_booking_at    timestamptz,
  booking_count      integer not null default 0,
  -- This supplier's own gross billed amount across their lines only — never
  -- the customer's platform-wide lifetime value, which is none of any one
  -- supplier's business.
  lifetime_spend     numeric not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (supplier_id, customer_user_id)
);
create index if not exists vd_supplier_contacts_supplier_idx on vd_supplier_contacts (supplier_id);
create index if not exists vd_supplier_contacts_customer_idx on vd_supplier_contacts (customer_user_id);

alter table vd_supplier_contacts enable row level security;
drop policy if exists "Suppliers read own contacts" on vd_supplier_contacts;
drop policy if exists "Admins read all contacts"    on vd_supplier_contacts;
create policy "Suppliers read own contacts" on vd_supplier_contacts for select using (supplier_id = auth.uid());
create policy "Admins read all contacts"    on vd_supplier_contacts for select using (is_admin());
-- No insert/update/delete policy for anyone — this table is entirely
-- write-only-via-function (below), same convention as vd_sessions/
-- vd_analytics_events in the Phase 1 migration.

-- Recomputes every supplier's contact list from real order-line history.
-- Excludes cancelled lines. Name is only carried over from a line where
-- share_customer_name was true (see 20260716_order_management.sql) — the
-- same privacy gate the supplier's own earnings statement already respects
-- (lib/settlements.ts) — so a supplier never sees a name here they weren't
-- already allowed to see on that booking.
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
    first_booking_at, last_booking_at, booking_count, lifetime_spend, updated_at
  )
  select a.supplier_id, a.user_id, a.name, a.email, a.phone,
         a.first_booking_at, a.last_booking_at, a.booking_count, a.lifetime_spend, now()
  from _vd_contact_agg a
  on conflict (supplier_id, customer_user_id) do update set
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    first_booking_at = excluded.first_booking_at,
    last_booking_at = excluded.last_booking_at,
    booking_count = excluded.booking_count,
    lifetime_spend = excluded.lifetime_spend,
    updated_at = now();
  get diagnostics v_upserted = row_count;

  -- A pair with no row in the snapshot at all (every line for that
  -- supplier/customer got cancelled since the last recompute) needs a full
  -- removal, not just a skipped upsert — otherwise a cancelled customer's
  -- contact details and stale booking_count/spend keep showing up
  -- indefinitely.
  delete from vd_supplier_contacts c
  where not exists (
    select 1 from _vd_contact_agg a
    where a.supplier_id = c.supplier_id and a.user_id = c.customer_user_id
  );
  get diagnostics v_deleted = row_count;

  return v_upserted + v_deleted;
end;
$$;
grant execute on function public.vd_recompute_supplier_contacts() to authenticated;
