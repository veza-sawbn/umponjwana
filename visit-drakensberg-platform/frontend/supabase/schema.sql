-- Visit Drakensberg Platform — Supabase Schema
-- Run this in the Supabase SQL editor

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────
create type user_role as enum ('admin', 'supplier', 'visitor');
create type listing_type as enum ('accommodation', 'activity', 'hike', 'experience', 'event');
create type listing_status as enum ('draft', 'pending', 'published', 'archived');
create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type payment_status as enum ('pending', 'paid', 'refunded', 'failed');
create type guide_verification as enum ('pending', 'verified', 'rejected');
create type loyalty_reason as enum ('booking', 'review', 'referral', 'event');
create type notification_type as enum ('booking', 'cancellation', 'payment', 'message', 'approval');
create type content_section as enum ('hero', 'featured_stays', 'events', 'packages', 'specials', 'featured_guides');

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'visitor',
  full_name       text,
  email           text,
  phone           text,
  avatar_url      text,
  bio             text,
  is_approved     boolean not null default false,   -- suppliers require admin approval
  loyalty_points  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'visitor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────
-- LISTINGS
-- ─────────────────────────────────────────────
create table listings (
  id              uuid primary key default uuid_generate_v4(),
  supplier_id     uuid not null references profiles(id) on delete cascade,
  type            listing_type not null,
  title           text not null,
  slug            text unique,
  description     text,
  region          text,
  location_name   text,
  location_lat    numeric(10, 7),
  location_lng    numeric(10, 7),
  price_from      numeric(10, 2),
  images          text[] default '{}',
  amenities       text[] default '{}',
  tags            text[] default '{}',
  status          listing_status not null default 'draft',
  featured        boolean not null default false,
  meta_title      text,
  meta_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on listings (supplier_id);
create index on listings (status);
create index on listings (type);
create index on listings (region);
create index on listings using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ─────────────────────────────────────────────
-- ROOMS (under accommodation listings)
-- ─────────────────────────────────────────────
create table rooms (
  id              uuid primary key default uuid_generate_v4(),
  listing_id      uuid not null references listings(id) on delete cascade,
  name            text not null,
  description     text,
  max_guests      integer not null default 2,
  price_per_night numeric(10, 2) not null,
  amenities       text[] default '{}',
  images          text[] default '{}',
  is_available    boolean not null default true,
  created_at      timestamptz not null default now()
);

create index on rooms (listing_id);

-- ─────────────────────────────────────────────
-- GUIDES
-- ─────────────────────────────────────────────
create table guides (
  id                  uuid primary key default uuid_generate_v4(),
  supplier_id         uuid not null references profiles(id) on delete cascade,
  full_name           text not null,
  bio                 text,
  languages           text[] default '{}',
  specialties         text[] default '{}',
  fgasa_cert_number   text,
  guide_number        text,
  verification_status guide_verification not null default 'pending',
  profile_image       text,
  created_at          timestamptz not null default now()
);

-- Guide ↔ Listing link
create table listing_guides (
  listing_id  uuid references listings(id) on delete cascade,
  guide_id    uuid references guides(id) on delete cascade,
  primary key (listing_id, guide_id)
);

-- ─────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────
create table bookings (
  id              uuid primary key default uuid_generate_v4(),
  visitor_id      uuid not null references profiles(id),
  listing_id      uuid not null references listings(id),
  room_id         uuid references rooms(id),
  guide_id        uuid references guides(id),
  check_in        date,
  check_out       date,
  guests          integer not null default 1,
  total_amount    numeric(10, 2) not null,
  status          booking_status not null default 'pending',
  payment_status  payment_status not null default 'pending',
  payment_ref     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on bookings (visitor_id);
create index on bookings (listing_id);
create index on bookings (status);

-- ─────────────────────────────────────────────
-- ITINERARIES
-- ─────────────────────────────────────────────
create table itineraries (
  id              uuid primary key default uuid_generate_v4(),
  booking_id      uuid not null references bookings(id) on delete cascade,
  visitor_id      uuid not null references profiles(id),
  supplier_id     uuid not null references profiles(id),
  -- content: [{ day: 1, date: '...', items: [{ time, title, description, location }] }]
  content         jsonb not null default '[]',
  generated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────
create table reviews (
  id          uuid primary key default uuid_generate_v4(),
  booking_id  uuid not null references bookings(id),
  visitor_id  uuid not null references profiles(id),
  listing_id  uuid not null references listings(id),
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on reviews (listing_id);

-- ─────────────────────────────────────────────
-- SAVED LISTINGS (wishlists)
-- ─────────────────────────────────────────────
create table saved_listings (
  id          uuid primary key default uuid_generate_v4(),
  visitor_id  uuid not null references profiles(id) on delete cascade,
  listing_id  uuid not null references listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (visitor_id, listing_id)
);

-- ─────────────────────────────────────────────
-- RECENT SEARCHES (Redis preferred; DB fallback)
-- ─────────────────────────────────────────────
create table recent_searches (
  id          uuid primary key default uuid_generate_v4(),
  visitor_id  uuid references profiles(id) on delete cascade,
  session_id  text,
  query       text,
  filters     jsonb default '{}',
  searched_at timestamptz not null default now()
);

create index on recent_searches (visitor_id);

-- ─────────────────────────────────────────────
-- LOYALTY POINTS LOG
-- ─────────────────────────────────────────────
create table loyalty_log (
  id           uuid primary key default uuid_generate_v4(),
  visitor_id   uuid not null references profiles(id) on delete cascade,
  points       integer not null,
  reason       loyalty_reason not null,
  reference_id uuid,
  created_at   timestamptz not null default now()
);

create index on loyalty_log (visitor_id);

-- ─────────────────────────────────────────────
-- EVENTS / SPECIALS
-- ─────────────────────────────────────────────
create table events (
  id              uuid primary key default uuid_generate_v4(),
  supplier_id     uuid not null references profiles(id),
  listing_id      uuid references listings(id),
  title           text not null,
  description     text,
  event_type      text not null default 'event', -- 'event' | 'special'
  region          text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  ticket_price    numeric(10, 2),
  total_tickets   integer,
  tickets_sold    integer not null default 0,
  image           text,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- PACKAGES
-- ─────────────────────────────────────────────
create table packages (
  id              uuid primary key default uuid_generate_v4(),
  created_by      uuid not null references profiles(id),
  title           text not null,
  description     text,
  price           numeric(10, 2),
  duration_days   integer,
  region          text,
  includes        text[] default '{}',
  images          text[] default '{}',
  collaborators   uuid[] default '{}',
  tour_start      date,
  tour_end        date,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- BLOG POSTS (MyDrakensberg)
-- ─────────────────────────────────────────────
create table blog_posts (
  id                  uuid primary key default uuid_generate_v4(),
  author_id           uuid references profiles(id),
  title               text not null,
  slug                text unique not null,
  excerpt             text,
  body                text,
  category            text,
  tags                text[] default '{}',
  featured_image      text,
  status              text not null default 'draft', -- 'draft' | 'published'
  related_listing_ids uuid[] default '{}',
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on blog_posts (status);
create index on blog_posts (category);

-- ─────────────────────────────────────────────
-- HOMEPAGE CONTENT (admin-managed)
-- ─────────────────────────────────────────────
create table homepage_content (
  id          uuid primary key default uuid_generate_v4(),
  section     content_section not null unique,
  content     jsonb not null default '{}',
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id)
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on notifications (user_id, is_read);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table profiles enable row level security;
alter table listings enable row level security;
alter table rooms enable row level security;
alter table guides enable row level security;
alter table bookings enable row level security;
alter table reviews enable row level security;
alter table saved_listings enable row level security;
alter table loyalty_log enable row level security;
alter table notifications enable row level security;
alter table blog_posts enable row level security;

-- Profiles
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins can read all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Listings: published = public; suppliers own their listings; admins manage all
create policy "Published listings are public" on listings for select using (status = 'published');
create policy "Suppliers manage own listings" on listings for all using (supplier_id = auth.uid());
create policy "Admins manage all listings" on listings for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Rooms: readable via parent listing
create policy "Rooms readable if listing is published" on rooms for select using (
  exists (select 1 from listings where id = listing_id and status = 'published')
);
create policy "Suppliers manage own rooms" on rooms for all using (
  exists (select 1 from listings where id = listing_id and supplier_id = auth.uid())
);

-- Bookings
create policy "Visitors see own bookings" on bookings for select using (visitor_id = auth.uid());
create policy "Visitors create bookings" on bookings for insert with check (visitor_id = auth.uid());
create policy "Suppliers see bookings on their listings" on bookings for select using (
  exists (select 1 from listings where id = listing_id and supplier_id = auth.uid())
);
create policy "Admins see all bookings" on bookings for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Reviews: public read; only booking owner can insert
create policy "Reviews are public" on reviews for select using (true);
create policy "Only booking owner can review" on reviews for insert with check (visitor_id = auth.uid());

-- Saved listings
create policy "Users manage own saved listings" on saved_listings for all using (visitor_id = auth.uid());

-- Loyalty log
create policy "Users see own loyalty" on loyalty_log for select using (visitor_id = auth.uid());

-- Notifications
create policy "Users see own notifications" on notifications for all using (user_id = auth.uid());

-- Blog posts: published readable by all
create policy "Published posts are public" on blog_posts for select using (status = 'published');
create policy "Admins manage all posts" on blog_posts for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
