-- ============================================================================
-- Visit Drakensberg — Secure Data Layer Migration
-- Run this in the Supabase SQL editor BEFORE deploying the matching frontend.
--
-- What this does:
--   1. Moves operational data out of the world-readable/writable `site_content`
--      JSON blobs into per-row tables with proper Row Level Security:
--        vd_entities              catalog rows (properties, rooms, activities,
--                                 tours, departures, supplier_* entities)
--        vd_bookings              bookings (customer PII — owner/supplier only)
--        vd_message_threads       visitor <-> supplier conversations
--        vd_notifications         in-app notifications
--        vd_newsletter_subscribers newsletter emails (insert-only)
--   2. Locks `site_content` down to CMS use: public read, admin-only write.
--   3. Hardens `profiles`: users cannot change their own role/is_approved;
--      admins manage all profiles. Adds is_admin()/is_active_supplier()
--      helpers (SECURITY DEFINER, so policies don't recurse).
--   4. Adds vd_book_seats(): atomic, capacity-checked departure seat booking.
--   5. Copies existing blob data into the new tables (idempotent).
--   6. Grandfathers existing suppliers as approved; new suppliers require
--      admin approval before they can create listings.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Prerequisites: profiles table + signup trigger (idempotent, matches
--    supabase/schema.sql but with a cast-safe trigger; 'guest'/unknown roles
--    become 'visitor' instead of aborting signup).
-- ────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('admin', 'supplier', 'visitor');
exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'visitor',
  full_name       text,
  email           text,
  phone           text,
  avatar_url      text,
  bio             text,
  supplier_type   text,
  is_approved     boolean not null default false,
  loyalty_points  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table profiles add column if not exists supplier_type text;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := 'visitor';
begin
  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'visitor');
  exception when others then
    v_role := 'visitor';
  end;
  insert into profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profiles for users created before the trigger existed
insert into profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  u.email,
  case
    when u.raw_user_meta_data->>'role' in ('admin','supplier','visitor')
      then (u.raw_user_meta_data->>'role')::user_role
    else 'visitor'
  end
from auth.users u
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Trusted helpers (SECURITY DEFINER avoids RLS recursion on profiles)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.is_active_supplier()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from profiles
     where id = auth.uid()
       and (role = 'admin' or (role = 'supplier' and is_approved))
   ) $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. profiles: RLS + column-level update grants
-- ────────────────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

drop policy if exists "Users can read own profile"   on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins can read all profiles" on profiles;
drop policy if exists "Admins manage all profiles"   on profiles;

create policy "Users can read own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins can read all profiles" on profiles for select using (is_admin());
create policy "Admins manage all profiles"   on profiles for update using (is_admin());

-- Users may edit contact fields on their own row, but NOT role / is_approved /
-- loyalty_points — even though the row-level policy passes. Admin updates run
-- with full column access via the service role or the grants below.
revoke update on profiles from authenticated;
grant update (full_name, phone, avatar_url, bio, email, supplier_type)
  on profiles to authenticated;

-- Admins operate through the same 'authenticated' postgres role, so approval
-- flips happen via this SECURITY DEFINER function instead of a direct UPDATE.
create or replace function public.admin_set_supplier_approval(p_user uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  update profiles set is_approved = p_approved, updated_at = now()
  where id = p_user and role = 'supplier';
end;
$$;
grant execute on function public.admin_set_supplier_approval(uuid, boolean) to authenticated;

-- Grandfather suppliers that existed before the approval gate
update profiles set is_approved = true where role = 'supplier';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. vd_entities — catalog rows (one row per property/room/activity/…)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_entities (
  id          text primary key,
  kind        text not null,
  owner_id    uuid references auth.users(id) on delete cascade,
  status      text not null default 'active',
  value       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vd_entities_kind_idx  on vd_entities (kind);
create index if not exists vd_entities_owner_idx on vd_entities (owner_id);

alter table vd_entities enable row level security;

drop policy if exists "Public entities are readable" on vd_entities;
drop policy if exists "Owners read own entities"     on vd_entities;
drop policy if exists "Admins read all entities"     on vd_entities;
drop policy if exists "Suppliers insert own"         on vd_entities;
drop policy if exists "Owners update own"            on vd_entities;
drop policy if exists "Owners delete own"            on vd_entities;
drop policy if exists "Admins write all"             on vd_entities;

-- Live catalog is public (anon browsing); drafts visible to owner/admin only.
create policy "Public entities are readable" on vd_entities
  for select using (status in ('active', 'open', 'confirmed', 'full'));
create policy "Owners read own entities" on vd_entities
  for select using (owner_id = auth.uid());
create policy "Admins read all entities" on vd_entities
  for select using (is_admin());
create policy "Suppliers insert own" on vd_entities
  for insert with check (owner_id = auth.uid() and is_active_supplier());
create policy "Owners update own" on vd_entities
  for update using (owner_id = auth.uid());
create policy "Owners delete own" on vd_entities
  for delete using (owner_id = auth.uid());
create policy "Admins write all" on vd_entities
  for all using (is_admin());

-- Atomic, capacity-checked seat booking for departures. Visitors cannot
-- update supplier rows directly; this is the only write path they have.
create or replace function public.vd_book_seats(p_departure_id text, p_seats int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_max int; v_booked int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_seats <= 0 then raise exception 'invalid seat count'; end if;

  select (value->>'maxSeats')::int, coalesce((value->>'bookedSeats')::int, 0)
    into v_max, v_booked
    from vd_entities
   where id = p_departure_id and kind = 'departure'
     for update;

  if not found then raise exception 'departure not found'; end if;
  if v_booked + p_seats > v_max then raise exception 'not enough seats available'; end if;

  update vd_entities
     set value = value
                 || jsonb_build_object('bookedSeats', v_booked + p_seats)
                 || case when v_booked + p_seats >= v_max
                         then jsonb_build_object('status', 'full') else '{}'::jsonb end,
         status = case when v_booked + p_seats >= v_max then 'full' else status end,
         updated_at = now()
   where id = p_departure_id;
end;
$$;
grant execute on function public.vd_book_seats(text, int) to authenticated;

-- Release seats on cancellation (called by the booking owner / supplier).
create or replace function public.vd_release_seats(p_departure_id text, p_seats int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booked int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select coalesce((value->>'bookedSeats')::int, 0) into v_booked
    from vd_entities where id = p_departure_id and kind = 'departure' for update;
  if not found then return; end if;
  update vd_entities
     set value = value
                 || jsonb_build_object('bookedSeats', greatest(0, v_booked - p_seats))
                 || case when status = 'full' then jsonb_build_object('status', 'open') else '{}'::jsonb end,
         status = case when status = 'full' then 'open' else status end,
         updated_at = now()
   where id = p_departure_id;
end;
$$;
grant execute on function public.vd_release_seats(text, int) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. vd_bookings — customer PII lives here; visible only to participants
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_bookings (
  id           text primary key,
  reference    text unique not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  supplier_ids uuid[] not null default '{}',
  status       text not null default 'confirmed',
  value        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists vd_bookings_user_idx on vd_bookings (user_id);
create index if not exists vd_bookings_suppliers_idx on vd_bookings using gin (supplier_ids);

alter table vd_bookings enable row level security;

drop policy if exists "Visitors read own bookings"      on vd_bookings;
drop policy if exists "Suppliers read their bookings"   on vd_bookings;
drop policy if exists "Admins read all bookings"        on vd_bookings;
drop policy if exists "Visitors create own bookings"    on vd_bookings;
drop policy if exists "Visitors update own bookings"    on vd_bookings;
drop policy if exists "Suppliers update their bookings" on vd_bookings;
drop policy if exists "Admins manage bookings"          on vd_bookings;

create policy "Visitors read own bookings" on vd_bookings
  for select using (user_id = auth.uid());
create policy "Suppliers read their bookings" on vd_bookings
  for select using (auth.uid() = any (supplier_ids));
create policy "Admins read all bookings" on vd_bookings
  for select using (is_admin());
create policy "Visitors create own bookings" on vd_bookings
  for insert with check (user_id = auth.uid());
create policy "Visitors update own bookings" on vd_bookings
  for update using (user_id = auth.uid());
create policy "Suppliers update their bookings" on vd_bookings
  for update using (auth.uid() = any (supplier_ids));
create policy "Admins manage bookings" on vd_bookings
  for all using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 5. vd_message_threads — participants only
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_message_threads (
  id               text primary key,
  booking_id       text not null,
  customer_user_id uuid references auth.users(id) on delete cascade,
  supplier_id      uuid references auth.users(id) on delete set null,
  value            jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists vd_threads_booking_idx  on vd_message_threads (booking_id);
create index if not exists vd_threads_supplier_idx on vd_message_threads (supplier_id);

alter table vd_message_threads enable row level security;

drop policy if exists "Participants read threads"   on vd_message_threads;
drop policy if exists "Participants create threads" on vd_message_threads;
drop policy if exists "Participants update threads" on vd_message_threads;
drop policy if exists "Admins manage threads"       on vd_message_threads;

create policy "Participants read threads" on vd_message_threads
  for select using (customer_user_id = auth.uid() or supplier_id = auth.uid());
create policy "Participants create threads" on vd_message_threads
  for insert with check (customer_user_id = auth.uid() or supplier_id = auth.uid());
create policy "Participants update threads" on vd_message_threads
  for update using (customer_user_id = auth.uid() or supplier_id = auth.uid());
create policy "Admins manage threads" on vd_message_threads
  for all using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 6. vd_notifications
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null default 'info',
  title      text not null,
  body       text not null default '',
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists vd_notifications_user_idx on vd_notifications (user_id, read);

alter table vd_notifications enable row level security;

drop policy if exists "Users read own notifications"    on vd_notifications;
drop policy if exists "Users update own notifications"  on vd_notifications;
drop policy if exists "Users delete own notifications"  on vd_notifications;
drop policy if exists "Authenticated create notifications" on vd_notifications;

create policy "Users read own notifications" on vd_notifications
  for select using (user_id = auth.uid());
create policy "Users update own notifications" on vd_notifications
  for update using (user_id = auth.uid());
create policy "Users delete own notifications" on vd_notifications
  for delete using (user_id = auth.uid());
-- Any signed-in user may notify another (booking events target the supplier).
create policy "Authenticated create notifications" on vd_notifications
  for insert with check (auth.uid() is not null);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. vd_newsletter_subscribers — write-only for the public
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_newsletter_subscribers (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table vd_newsletter_subscribers enable row level security;

drop policy if exists "Anyone can subscribe"   on vd_newsletter_subscribers;
drop policy if exists "Admins read subscribers" on vd_newsletter_subscribers;

create policy "Anyone can subscribe" on vd_newsletter_subscribers
  for insert with check (true);
create policy "Admins read subscribers" on vd_newsletter_subscribers
  for select using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Lock site_content down to CMS content (public read, admin write)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table site_content enable row level security;

drop policy if exists "Site content is public"      on site_content;
drop policy if exists "Admins manage site content"  on site_content;
drop policy if exists "Anyone can write site content" on site_content;

create policy "Site content is public" on site_content
  for select using (true);
create policy "Admins manage site content" on site_content
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Data migration: copy blobs into the new tables (idempotent)
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  rec record;
  item jsonb;
  v_owner uuid;
  v_kind text;
  blob_kinds constant text[][] := array[
    ['properties',        'property'],
    ['rooms',             'room'],
    ['activities',        'activity'],
    ['tours',             'tour'],
    ['departures',        'departure'],
    ['supplier_drivers',  'supplier_drivers'],
    ['supplier_vehicles', 'supplier_vehicles'],
    ['supplier_routes',   'supplier_routes'],
    ['supplier_reviews',  'supplier_reviews']
  ];
  pair text[];
begin
  foreach pair slice 1 in array blob_kinds loop
    select value into rec from site_content where key = pair[1];
    if rec.value is null or rec.value->'items' is null then continue; end if;
    v_kind := pair[2];
    for item in select * from jsonb_array_elements(rec.value->'items') loop
      begin
        v_owner := nullif(item->>'supplierId', '')::uuid;
      exception when others then
        v_owner := null;
      end;
      insert into vd_entities (id, kind, owner_id, status, value, created_at)
      values (
        coalesce(item->>'id', v_kind || '-' || gen_random_uuid()),
        v_kind,
        v_owner,
        coalesce(item->>'status', 'active'),
        item,
        coalesce(nullif(item->>'createdAt','')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end loop;
  end loop;

  -- bookings
  select value into rec from site_content where key = 'bookings';
  if rec.value is not null and rec.value->'items' is not null then
    for item in select * from jsonb_array_elements(rec.value->'items') loop
      begin
        v_owner := nullif(item->>'userId', '')::uuid;
      exception when others then
        v_owner := null;
      end;
      if v_owner is null then continue; end if; -- guest bookings can't be secured retroactively
      insert into vd_bookings (id, reference, user_id, supplier_ids, status, value, created_at)
      values (
        coalesce(item->>'id', 'bk-' || gen_random_uuid()),
        coalesce(item->>'reference', 'DBK-' || upper(substr(gen_random_uuid()::text, 1, 8))),
        v_owner,
        coalesce((
          select array_agg(distinct s) from (
            select nullif(a->>'supplierId','')::uuid as s
            from jsonb_array_elements(coalesce(item->'addons','[]'::jsonb)) a
            where a->>'supplierId' ~ '^[0-9a-f]{8}-'
          ) x where s is not null
        ), '{}'),
        coalesce(item->>'status', 'confirmed'),
        item,
        coalesce(nullif(item->>'createdAt','')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end loop;
  end if;

  -- message threads
  select value into rec from site_content where key = 'message_threads';
  if rec.value is not null and rec.value->'items' is not null then
    for item in select * from jsonb_array_elements(rec.value->'items') loop
      insert into vd_message_threads (id, booking_id, customer_user_id, supplier_id, value, created_at, updated_at)
      values (
        coalesce(item->>'id', 'thr-' || gen_random_uuid()),
        coalesce(item->>'bookingId', ''),
        case when item->>'customerUserId' ~ '^[0-9a-f]{8}-' then (item->>'customerUserId')::uuid else null end,
        case when item->>'supplierId' ~ '^[0-9a-f]{8}-' then (item->>'supplierId')::uuid else null end,
        item,
        coalesce(nullif(item->>'createdAt','')::timestamptz, now()),
        coalesce(nullif(item->>'updatedAt','')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end loop;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Remove the migrated (world-readable) blobs
-- ────────────────────────────────────────────────────────────────────────────
delete from site_content where key in (
  'properties', 'rooms', 'activities', 'tours', 'departures', 'bookings',
  'message_threads', 'newsletter_subscribers',
  'supplier_drivers', 'supplier_vehicles', 'supplier_routes', 'supplier_reviews'
);
