-- ============================================================================
-- Visit Drakensberg — manually-added departure guests (Wix Events migration)
--
-- Suppliers moving off Wix Events arrive with departures that already have
-- guests booked outside this platform. The supplier dashboard needs a way to
-- record those guests against a departure — reserving the same seats a real
-- checkout would, without requiring a payment/checkout flow on our side.
--
-- Why a dedicated table rather than a vd_entities kind (mirrors the waivers
-- rationale in 20260816_waivers.sql): a guest row carries name/email/phone,
-- and vd_entities' generic "Public entities are readable" policy grants
-- anyone read access to any row whose status is active/open/confirmed/full —
-- there is no safe status value to store PII in that table under. This table
-- gets no public policy at all; only the owning supplier, ops staff acting on
-- their behalf, and admins can ever read it.
-- ============================================================================

create table if not exists vd_departure_guests (
  id            uuid primary key default gen_random_uuid(),
  departure_id  text not null references vd_entities(id) on delete cascade,
  supplier_id   uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  -- Seats this guest entry represents (e.g. "Jane Doe +1" = 2). Mirrored
  -- into the departure's bookedSeats via vd_book_seats/vd_release_seats so
  -- capacity stays accurate — see lib/departure-guests.ts.
  seats         int not null default 1 check (seats > 0),
  -- Freeform, e.g. a Wix booking reference or dietary note carried over.
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists vd_departure_guests_departure_idx on vd_departure_guests (departure_id);
create index if not exists vd_departure_guests_supplier_idx  on vd_departure_guests (supplier_id);

alter table vd_departure_guests enable row level security;

drop policy if exists "Suppliers manage own departure guests"      on vd_departure_guests;
drop policy if exists "Admins manage departure guests"              on vd_departure_guests;
drop policy if exists "Managed ops agents read departure guests"    on vd_departure_guests;
drop policy if exists "Managed ops agents manage departure guests"  on vd_departure_guests;

create policy "Suppliers manage own departure guests" on vd_departure_guests
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

create policy "Admins manage departure guests" on vd_departure_guests
  for all using (is_admin()) with check (is_admin());

-- Ops-delegation follows the same view/manage split already used for
-- booking data (vd_order_lines, vd_bookings in 20260811_delegated_management.sql):
-- viewing the roster needs view_bookings, adding/removing guests needs
-- manage_bookings.
create policy "Managed ops agents read departure guests" on vd_departure_guests
  for select using (
    supplier_id is not null
    and has_supplier_permission(supplier_id, 'view_bookings')
  );

create policy "Managed ops agents manage departure guests" on vd_departure_guests
  for all using (
    supplier_id is not null
    and has_supplier_permission(supplier_id, 'manage_bookings')
  ) with check (
    supplier_id is not null
    and has_supplier_permission(supplier_id, 'manage_bookings')
  );

-- NOTE: intentionally no anon/public policy — see comment above.
