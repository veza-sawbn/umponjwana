-- ============================================================================
-- Visit Drakensberg — Transport Supplier Marketplace
-- Run AFTER 20260718_guest_orders.sql.
--
-- What this adds:
--   vd_transport_requests — every shuttle/transfer generated from a customer
--   itinerary becomes a transport request that must ultimately belong to a
--   real transport supplier. The dispatch engine scores approved transport
--   companies (region coverage, capacity, proximity, availability,
--   reliability, response time, rating, price) and offers the job to the
--   highest-ranked suppliers. Status workflow:
--     pending → offered → accepted → driver_assigned → in_progress
--             → completed | cancelled | unassigned
--
--   Transport companies, vehicles and drivers live in vd_entities
--   (kinds: transport_company, supplier_vehicles, supplier_drivers) using the
--   existing owner-write / public-read-of-active-rows policies. Operational
--   vehicle state (available / reserved / on_trip / maintenance / blocked)
--   is tracked in the entity value as `fleetStatus`, so the row itself stays
--   `active` and readable by the dispatch scorer.
-- ============================================================================

create table if not exists vd_transport_requests (
  id                    text primary key,
  booking_id            text,
  user_id               uuid references auth.users(id) on delete cascade,
  status                text not null default 'pending',
  offered_supplier_ids  uuid[] not null default '{}',
  assigned_supplier_id  uuid references auth.users(id) on delete set null,
  value                 jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists vd_transport_requests_user_idx     on vd_transport_requests (user_id);
create index if not exists vd_transport_requests_assigned_idx on vd_transport_requests (assigned_supplier_id);
create index if not exists vd_transport_requests_booking_idx  on vd_transport_requests (booking_id);
create index if not exists vd_transport_requests_status_idx   on vd_transport_requests (status);

alter table vd_transport_requests enable row level security;

drop policy if exists "Customers read own transport requests"    on vd_transport_requests;
drop policy if exists "Customers create own transport requests"  on vd_transport_requests;
drop policy if exists "Customers update own transport requests"  on vd_transport_requests;
drop policy if exists "Offered suppliers read transport requests"   on vd_transport_requests;
drop policy if exists "Offered suppliers update transport requests" on vd_transport_requests;
drop policy if exists "Admins manage transport requests"         on vd_transport_requests;

create policy "Customers read own transport requests" on vd_transport_requests
  for select using (user_id = auth.uid());
create policy "Customers create own transport requests" on vd_transport_requests
  for insert with check (user_id = auth.uid());
create policy "Customers update own transport requests" on vd_transport_requests
  for update using (user_id = auth.uid());

-- Suppliers on the offer shortlist can read the job and respond to it
-- (accept / decline / progress the trip once assigned to them).
create policy "Offered suppliers read transport requests" on vd_transport_requests
  for select using (auth.uid() = any(offered_supplier_ids) or assigned_supplier_id = auth.uid());
create policy "Offered suppliers update transport requests" on vd_transport_requests
  for update using (auth.uid() = any(offered_supplier_ids) or assigned_supplier_id = auth.uid());

create policy "Admins manage transport requests" on vd_transport_requests
  for all using (is_admin());
