-- ============================================================================
-- Visit Drakensberg — Operator-edited itineraries on a booked tour
--
-- WHY:
--   The day-by-day itinerary a guest sees on /account/itinerary is computed
--   on the fly from the catalog (departure → tour → trail → pricing tier). For
--   a private trip request (vd_trip_requests → acceptQuote()) there is no
--   departure to compute it from, and when that lookup misses the page used to
--   fall back to "any tour by this operator", so the guest could be shown a
--   different tour's plan. The tour operator could not see what the guest was
--   shown, and had no way to correct it: suppliers lost access to vd_bookings
--   in 20260705_booking_orders.sql and see only their own order slice.
--
-- WHAT THIS ADDS:
--   vd_booking_itineraries  one row per (booking, booked item): the itinerary
--                           the operator has set for that guest. When a row
--                           exists, the guest's itinerary shows it instead of
--                           the computed catalog plan. The parent booking
--                           itself is never written by a supplier.
--   vd_supplier_booking_item(booking_id, item_id)
--                           returns the few routing fields of one booked item
--                           (date, package) to the supplier who delivers it,
--                           so the supplier portal can show the guest's
--                           computed itinerary exactly as the guest sees it.
--
-- WHO MAY DO WHAT:
--   * The supplier delivering the item (or a VD Operations employee managing
--     that supplier with 'manage_bookings') writes it — and only for an item
--     that is actually in that supplier's vd_booking_orders row.
--   * The same, plus managed employees with 'view_bookings', read it.
--   * The guest who owns the booking reads it. Never writes it.
--   * Admins manage everything.
-- ============================================================================
-- @rollback: reversible — drop function vd_supplier_booking_item(text, text); drop function vd_can_write_booking_itinerary(text, text, uuid); drop table vd_booking_itineraries;

create table if not exists vd_booking_itineraries (
  booking_id  text not null,
  item_id     text not null,
  supplier_id uuid not null references auth.users(id) on delete cascade,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (booking_id, item_id)
);
create index if not exists vd_booking_itineraries_supplier_idx on vd_booking_itineraries (supplier_id);

alter table vd_booking_itineraries enable row level security;

-- The item must be one this supplier actually delivers on this booking.
-- security definer so the check reads vd_booking_orders directly rather than
-- through the caller's own RLS on it.
create or replace function public.vd_can_write_booking_itinerary(
  p_booking_id text, p_item_id text, p_supplier_id uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and (p_supplier_id = auth.uid() or has_supplier_permission(p_supplier_id, 'manage_bookings'))
    and exists (
      select 1 from vd_booking_orders o
      where o.booking_id = p_booking_id
        and o.supplier_id = p_supplier_id
        and o.status <> 'cancelled'
        and o.value->'items' @> jsonb_build_array(jsonb_build_object('id', p_item_id))
    )
$$;
grant execute on function public.vd_can_write_booking_itinerary(text, text, uuid) to authenticated;

drop policy if exists "Suppliers read their booking itineraries"   on vd_booking_itineraries;
drop policy if exists "Suppliers insert their booking itineraries" on vd_booking_itineraries;
drop policy if exists "Suppliers update their booking itineraries" on vd_booking_itineraries;
drop policy if exists "Suppliers delete their booking itineraries" on vd_booking_itineraries;
drop policy if exists "Visitors read own booking itineraries"      on vd_booking_itineraries;
drop policy if exists "Admins manage booking itineraries"          on vd_booking_itineraries;

create policy "Suppliers read their booking itineraries" on vd_booking_itineraries
  for select using (
    supplier_id = auth.uid()
    or (is_managed_supplier(supplier_id) and has_supplier_permission(supplier_id, 'view_bookings'))
  );
create policy "Suppliers insert their booking itineraries" on vd_booking_itineraries
  for insert with check (vd_can_write_booking_itinerary(booking_id, item_id, supplier_id));
create policy "Suppliers update their booking itineraries" on vd_booking_itineraries
  for update using (vd_can_write_booking_itinerary(booking_id, item_id, supplier_id))
  with check (vd_can_write_booking_itinerary(booking_id, item_id, supplier_id));
-- "Reset to the standard itinerary" removes the operator's version.
create policy "Suppliers delete their booking itineraries" on vd_booking_itineraries
  for delete using (vd_can_write_booking_itinerary(booking_id, item_id, supplier_id));
create policy "Visitors read own booking itineraries" on vd_booking_itineraries
  for select using (
    exists (select 1 from vd_bookings b where b.id = booking_id and b.user_id = auth.uid())
  );
create policy "Admins manage booking itineraries" on vd_booking_itineraries
  for all using (is_admin()) with check (is_admin());

-- Routing fields of one booked item, for the supplier delivering it. Returns
-- null for anyone else. Deliberately a fixed handful of fields — never the
-- booking's other items, totals or payment state.
create or replace function public.vd_supplier_booking_item(p_booking_id text, p_item_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',        a->'id',
    'title',     a->'title',
    'date',      a->'date',
    'packageId', a->'packageId'
  )
  from vd_bookings b
  cross join lateral jsonb_array_elements(coalesce(b.value->'addons', '[]'::jsonb)) a
  -- Cast only a well-formed id: a legacy addon can carry a non-uuid string.
  cross join lateral (
    select case when a->>'supplierId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then (a->>'supplierId')::uuid end as supplier_id
  ) s
  where b.id = p_booking_id
    and a->>'id' = p_item_id
    and auth.uid() is not null
    and s.supplier_id is not null
    and (s.supplier_id = auth.uid() or has_supplier_permission(s.supplier_id, 'view_bookings'))
  limit 1
$$;
grant execute on function public.vd_supplier_booking_item(text, text) to authenticated;
