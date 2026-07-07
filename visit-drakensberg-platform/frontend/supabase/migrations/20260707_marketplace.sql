-- ============================================================================
-- Visit Drakensberg — Marketplace Extensions
-- Run AFTER 20260704_secure_data_layer.sql / 20260705_booking_orders.sql.
--
-- What this adds:
--   1. vd_trip_requests — custom-date private trip requests. Visitors submit a
--      request against a hiking trail; the assigned tour operator approves the
--      guide and the operation, issues a quote, and the visitor accepts + pays.
--      Never an instant booking: the row moves through a status workflow
--      (draft → pending_guide → pending_operator → quote_ready →
--       awaiting_payment → confirmed | cancelled | rejected).
--   2. Widens the public-read status list on vd_entities so verified guide
--      profiles ('verified') and published marketplace packages ('published')
--      are browsable by anonymous visitors, like the rest of the live catalog.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. vd_trip_requests
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_trip_requests (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  operator_id uuid references auth.users(id) on delete set null,
  trail_id    text not null,
  status      text not null default 'draft',
  value       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vd_trip_requests_user_idx     on vd_trip_requests (user_id);
create index if not exists vd_trip_requests_operator_idx on vd_trip_requests (operator_id);
create index if not exists vd_trip_requests_trail_idx    on vd_trip_requests (trail_id);

alter table vd_trip_requests enable row level security;

drop policy if exists "Visitors read own requests"      on vd_trip_requests;
drop policy if exists "Visitors create own requests"    on vd_trip_requests;
drop policy if exists "Visitors update own requests"    on vd_trip_requests;
drop policy if exists "Operators read their requests"   on vd_trip_requests;
drop policy if exists "Operators update their requests" on vd_trip_requests;
drop policy if exists "Admins manage requests"          on vd_trip_requests;

create policy "Visitors read own requests" on vd_trip_requests
  for select using (user_id = auth.uid());
create policy "Visitors create own requests" on vd_trip_requests
  for insert with check (user_id = auth.uid());
create policy "Visitors update own requests" on vd_trip_requests
  for update using (user_id = auth.uid());
create policy "Operators read their requests" on vd_trip_requests
  for select using (operator_id = auth.uid());
create policy "Operators update their requests" on vd_trip_requests
  for update using (operator_id = auth.uid());
create policy "Admins manage requests" on vd_trip_requests
  for all using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_entities: verified guide profiles and published packages are public
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Public entities are readable" on vd_entities;
create policy "Public entities are readable" on vd_entities
  for select using (status in ('active', 'open', 'confirmed', 'full', 'verified', 'published'));
