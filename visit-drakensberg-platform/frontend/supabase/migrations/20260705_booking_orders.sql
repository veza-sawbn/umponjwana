-- ============================================================================
-- Visit Drakensberg — Per-Supplier Booking Orders
-- Run AFTER 20260704_secure_data_layer.sql.
--
-- Problem this fixes: a visitor's multi-item trip was shared wholesale with
-- every involved supplier — the accommodation provider could read the whole
-- itinerary, every other supplier's items, and the platform total.
--
-- Model now: the visitor keeps ONE booking (their itinerary) in vd_bookings;
-- at checkout it is split into one ORDER per supplier in vd_booking_orders.
-- Each order carries only what that supplier needs to deliver their service:
-- their own items, the guest's name/contact, party size, dates and special
-- requests. Suppliers have NO access to vd_bookings at all.
-- ============================================================================

create table if not exists vd_booking_orders (
  id          text primary key,
  booking_id  text not null,
  reference   text not null,
  supplier_id uuid not null references auth.users(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'confirmed',
  value       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists vd_orders_supplier_idx on vd_booking_orders (supplier_id);
create index if not exists vd_orders_booking_idx  on vd_booking_orders (booking_id);
create index if not exists vd_orders_user_idx     on vd_booking_orders (user_id);

alter table vd_booking_orders enable row level security;

drop policy if exists "Suppliers read own orders"    on vd_booking_orders;
drop policy if exists "Suppliers update own orders"  on vd_booking_orders;
drop policy if exists "Visitors read own orders"     on vd_booking_orders;
drop policy if exists "Visitors create own orders"   on vd_booking_orders;
drop policy if exists "Visitors update own orders"   on vd_booking_orders;
drop policy if exists "Admins manage orders"         on vd_booking_orders;

create policy "Suppliers read own orders" on vd_booking_orders
  for select using (supplier_id = auth.uid());
create policy "Suppliers update own orders" on vd_booking_orders
  for update using (supplier_id = auth.uid());
create policy "Visitors read own orders" on vd_booking_orders
  for select using (user_id = auth.uid());
create policy "Visitors create own orders" on vd_booking_orders
  for insert with check (user_id = auth.uid());
create policy "Visitors update own orders" on vd_booking_orders
  for update using (user_id = auth.uid());
create policy "Admins manage orders" on vd_booking_orders
  for all using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- Suppliers lose direct access to the full booking/itinerary record.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Suppliers read their bookings"   on vd_bookings;
drop policy if exists "Suppliers update their bookings" on vd_bookings;

-- ────────────────────────────────────────────────────────────────────────────
-- Split existing bookings into per-supplier orders (idempotent).
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  bk record;
  addon jsonb;
  sup uuid;
  stay_owner uuid;
  sup_items jsonb;
  sup_total numeric;
  seen uuid[];
begin
  for bk in select * from vd_bookings loop
    seen := '{}';

    -- Addon items grouped per supplier
    for addon in select * from jsonb_array_elements(coalesce(bk.value->'addons', '[]'::jsonb)) loop
      if not (addon->>'supplierId' ~ '^[0-9a-f]{8}-') then continue; end if;
      sup := (addon->>'supplierId')::uuid;
      if sup = any(seen) then continue; end if;
      seen := seen || sup;

      select jsonb_agg(a), sum((a->>'price_per_person')::numeric * (a->>'guests')::numeric)
        into sup_items, sup_total
        from jsonb_array_elements(bk.value->'addons') a
       where a->>'supplierId' = sup::text;

      insert into vd_booking_orders (id, booking_id, reference, supplier_id, user_id, status, value, created_at)
      values (
        'ord-' || gen_random_uuid(),
        bk.id, bk.reference, sup, bk.user_id, bk.status,
        jsonb_build_object(
          'bookingId', bk.id,
          'reference', bk.reference,
          'customerName',   bk.value->>'customerName',
          'customerEmail',  bk.value->>'customerEmail',
          'customerPhone',  bk.value->>'customerPhone',
          'specialRequests', bk.value->>'specialRequests',
          'guests', coalesce((bk.value->>'guests')::int, 1),
          'items', (
            select jsonb_agg(jsonb_build_object(
              'id', a->>'id', 'type', coalesce(a->>'type','activity'),
              'title', a->>'title', 'date', a->>'date',
              'guests', coalesce((a->>'guests')::int, 1),
              'unitPrice', coalesce((a->>'price_per_person')::numeric, 0),
              'total', coalesce((a->>'price_per_person')::numeric, 0) * coalesce((a->>'guests')::int, 1)
            ))
            from jsonb_array_elements(bk.value->'addons') a
            where a->>'supplierId' = sup::text
          ),
          'orderTotal', coalesce(sup_total, 0)
        ),
        bk.created_at
      )
      on conflict (id) do nothing;
    end loop;

    -- Stay item → property owner
    if bk.value->'stay' is not null and bk.value->'stay'->>'id' like 'prop-%' then
      select owner_id into stay_owner from vd_entities
       where id = bk.value->'stay'->>'id' and kind = 'property';
      -- The stay becomes its own order even if this supplier also had addon
      -- items — two orders for one supplier is fine.
      if stay_owner is not null then
        insert into vd_booking_orders (id, booking_id, reference, supplier_id, user_id, status, value, created_at)
        values (
          'ord-' || gen_random_uuid(),
          bk.id, bk.reference, stay_owner, bk.user_id, bk.status,
          jsonb_build_object(
            'bookingId', bk.id,
            'reference', bk.reference,
            'customerName',   bk.value->>'customerName',
            'customerEmail',  bk.value->>'customerEmail',
            'customerPhone',  bk.value->>'customerPhone',
            'specialRequests', bk.value->>'specialRequests',
            'guests', coalesce((bk.value->>'guests')::int, 1),
            'checkIn',  bk.value->>'checkIn',
            'checkOut', bk.value->>'checkOut',
            'nights',   coalesce((bk.value->>'nights')::int, 0),
            'items', jsonb_build_array(jsonb_build_object(
              'id', bk.value->'stay'->>'id', 'type', 'stay',
              'title', bk.value->'stay'->>'title',
              'guests', coalesce((bk.value->>'guests')::int, 1),
              'unitPrice', coalesce((bk.value->'stay'->>'price_per_night')::numeric, 0),
              'total', coalesce((bk.value->'stay'->>'price_per_night')::numeric, 0) * coalesce((bk.value->>'nights')::int, 0)
            )),
            'orderTotal', coalesce((bk.value->'stay'->>'price_per_night')::numeric, 0) * coalesce((bk.value->>'nights')::int, 0)
          ),
          bk.created_at
        )
        on conflict (id) do nothing;
      end if;
    end if;
  end loop;
end $$;
