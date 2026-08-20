-- ============================================================================
-- Visit Drakensberg — Customer Intelligence Foundation (Phase 1)
--
-- First migration of the Customer Intelligence & Engagement System described
-- in HANDOFF.md / the Drakensberg CRM handoff. This is Phase 1 only —
-- "Data Foundation" — and is purely additive: no existing table is altered
-- in a breaking way, no existing column is dropped or renamed, and every
-- new write path is a new SECURITY DEFINER function or a brand-new table.
-- Safe to run against a live database.
--
-- What this adds:
--   1. vd_sessions              first-party session tracking (anonymous +
--                                identified), captures acquisition (referrer,
--                                UTM) at first touch.
--   2. vd_analytics_events      the single behavioural event stream — the
--                                "trackEvent()" system described in the
--                                handoff (§21). Analytics, CRM, automation and
--                                attribution all read this one table instead
--                                of each collecting their own copy.
--   3. vd_customer_profiles     1:1 CRM extension of `profiles` (country,
--                                consent, tags, interests, favourites,
--                                acquisition source, lifecycle stage). Kept
--                                separate from `profiles` rather than adding
--                                a dozen nullable columns to an existing,
--                                tightly-column-granted table.
--   4. vd_customer_consents     append-only consent/audit log (§22) +
--                                vd_set_consent()/vd_is_subscribed() helpers.
--                                Source of truth for marketing_consent.
--   5. vd_customer_segments +
--      vd_customer_segment_members   dynamic segment definitions and
--                                computed membership (§9), recomputed by
--                                vd_recompute_segments() from existing
--                                vd_orders data — no new data collection
--                                required for the first eight segments.
--   6. vd_touch_session() / vd_track_event()   the public write API. Every
--      other write in this migration happens only through these or through
--      vd_set_consent()/vd_recompute_segments() — client code never inserts
--      into the new tables directly, so validation lives in one place and
--      abusive/spoofed rows are structurally harder to write.
--
-- Explicitly NOT in this migration (later phases, see the architecture doc):
--   - Wix migration tooling (Phase 2)
--   - Analytics dashboards / funnel reporting (Phase 3)
--   - CRM UI, customer timeline, segmentation UI (Phase 4)
--   - Email campaign tables (Phase 5)
--   - Automation workflow engine tables (Phase 6)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. vd_sessions — one row per browsing session, anonymous or identified.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_sessions (
  id            uuid primary key default gen_random_uuid(),
  anon_id       text not null,
  user_id       uuid references auth.users(id) on delete set null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  landing_page  text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  device_type   text,
  browser       text,
  country       text
);
create index if not exists vd_sessions_user_idx    on vd_sessions (user_id);
create index if not exists vd_sessions_anon_idx    on vd_sessions (anon_id);
create index if not exists vd_sessions_started_idx on vd_sessions (started_at);

alter table vd_sessions enable row level security;
drop policy if exists "Admins read sessions" on vd_sessions;
create policy "Admins read sessions" on vd_sessions for select using (is_admin());
-- No insert/update policy for anon/authenticated on purpose: every write goes
-- through vd_touch_session()/vd_track_event() (SECURITY DEFINER, owned by the
-- migration role, which — per Postgres RLS semantics — is exempt from RLS on
-- tables it owns). Same pattern as vd_book_seats() elsewhere in this schema.

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_analytics_events — the single behavioural event stream (§3, §21).
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_analytics_events (
  id           bigint generated always as identity primary key,
  session_id   uuid references vd_sessions(id) on delete set null,
  anon_id      text not null,
  user_id      uuid references auth.users(id) on delete set null,
  event_name   text not null,
  properties   jsonb not null default '{}'::jsonb,
  page_url     text,
  occurred_at  timestamptz not null default now()
);
create index if not exists vd_analytics_events_name_idx     on vd_analytics_events (event_name, occurred_at);
create index if not exists vd_analytics_events_user_idx     on vd_analytics_events (user_id);
create index if not exists vd_analytics_events_session_idx  on vd_analytics_events (session_id);
create index if not exists vd_analytics_events_occurred_idx on vd_analytics_events (occurred_at);
-- properties is intentionally schemaless jsonb — new event types (§3's
-- extensibility requirement) need zero migrations, just a new event_name.

alter table vd_analytics_events enable row level security;
drop policy if exists "Admins read analytics events" on vd_analytics_events;
create policy "Admins read analytics events" on vd_analytics_events for select using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 3. vd_customer_profiles — 1:1 CRM extension of `profiles`.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_customer_profiles (
  user_id                    uuid primary key references auth.users(id) on delete cascade,
  country                    text,
  province_or_city           text,
  marketing_consent          boolean not null default false, -- cached from vd_customer_consents; do not write directly, use vd_set_consent()
  communication_preferences  jsonb not null default '{}'::jsonb, -- e.g. {"email":true,"sms":false,"whatsapp":false}
  tags                       text[] not null default '{}',
  interests                  text[] not null default '{}',
  favourite_destinations     text[] not null default '{}',
  favourite_activities       text[] not null default '{}',
  acquisition_source         text,
  first_seen_at              timestamptz,
  last_seen_at               timestamptz,
  -- visitor -> prospect -> customer -> upcoming_traveller -> traveller ->
  -- returning_customer -> advocate (§1). Recomputed by vd_recompute_segments()
  -- except 'advocate', which nothing derives yet (no review/referral capture
  -- exists — see the architecture doc's §7 "Intelligence" phase) and is only
  -- ever set by an admin, so recompute deliberately never overwrites it.
  lifecycle_stage            text not null default 'visitor',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists vd_customer_profiles_stage_idx on vd_customer_profiles (lifecycle_stage);

alter table vd_customer_profiles enable row level security;
drop policy if exists "Users read own customer profile"   on vd_customer_profiles;
drop policy if exists "Admins read all customer profiles" on vd_customer_profiles;
drop policy if exists "Admins manage customer profiles"   on vd_customer_profiles;
create policy "Users read own customer profile"   on vd_customer_profiles for select using (user_id = auth.uid());
create policy "Admins read all customer profiles" on vd_customer_profiles for select using (is_admin());
create policy "Admins manage customer profiles"   on vd_customer_profiles for all    using (is_admin());

-- Visitors may edit their own preferences, but not the system-computed
-- fields (marketing_consent goes through vd_set_consent(); acquisition_source
-- and lifecycle_stage are computed). Mirrors the column-grant pattern already
-- used on `profiles`.
revoke update, insert on vd_customer_profiles from authenticated;
grant update (country, province_or_city, communication_preferences, interests, favourite_destinations, favourite_activities)
  on vd_customer_profiles to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. vd_customer_consents — append-only consent log (§22) + current-state
--    helpers. Never updated or deleted; "current" state is whichever row for
--    a given (email, consent_type) has the latest created_at.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_customer_consents (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,
  email         text not null,
  consent_type  text not null, -- 'marketing_email' | 'sms' | 'whatsapp' | 'profiling' | ...
  granted       boolean not null,
  source        text not null default 'unknown', -- 'newsletter_footer' | 'registration' | 'unsubscribe_link' | 'admin' | ...
  created_at    timestamptz not null default now()
);
create index if not exists vd_customer_consents_email_idx on vd_customer_consents (lower(email), consent_type, created_at desc);
create index if not exists vd_customer_consents_user_idx  on vd_customer_consents (user_id, consent_type, created_at desc);

alter table vd_customer_consents enable row level security;
drop policy if exists "Admins read consents" on vd_customer_consents;
create policy "Admins read consents" on vd_customer_consents for select using (is_admin());
-- Writes only through vd_set_consent() below — never a raw insert from the
-- client — so every consent row is guaranteed to carry a real source and a
-- server-set created_at, keeping this usable as an audit trail.

create or replace function public.vd_set_consent(
  p_email text,
  p_consent_type text,
  p_granted boolean,
  p_source text default 'unknown'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'a valid email is required';
  end if;
  if p_consent_type is null or p_consent_type = '' then
    raise exception 'consent_type is required';
  end if;

  insert into vd_customer_consents (user_id, email, consent_type, granted, source)
  values (v_user, v_email, p_consent_type, p_granted, coalesce(p_source, 'unknown'));

  if p_consent_type = 'marketing_email' and v_user is not null then
    update vd_customer_profiles
    set marketing_consent = p_granted, updated_at = now()
    where user_id = v_user;
  end if;
end;
$$;
grant execute on function public.vd_set_consent(text, text, boolean, text) to anon, authenticated;

-- Public, read-only, boolean-only (no row data leaks) — lets an unsubscribe
-- page or a future preference centre confirm current state without needing
-- SELECT access to the log itself.
create or replace function public.vd_is_subscribed(p_email text, p_consent_type text default 'marketing_email')
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select granted from vd_customer_consents
     where lower(email) = lower(trim(p_email)) and consent_type = p_consent_type
     order by created_at desc limit 1),
    false
  )
$$;
grant execute on function public.vd_is_subscribed(text, text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. vd_customer_segments / vd_customer_segment_members (§9) — dynamic,
--    recomputed from data the platform already has (vd_orders + profiles),
--    so segmentation has real membership from the moment this migration
--    runs, before a single new event has been tracked.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_customer_segments (
  id          text primary key,
  name        text not null,
  description text not null default '',
  is_dynamic  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists vd_customer_segment_members (
  segment_id   text not null references vd_customer_segments(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  computed_at  timestamptz not null default now(),
  primary key (segment_id, user_id)
);
create index if not exists vd_segment_members_user_idx on vd_customer_segment_members (user_id);

alter table vd_customer_segments enable row level security;
alter table vd_customer_segment_members enable row level security;
drop policy if exists "Admins read segments" on vd_customer_segments;
drop policy if exists "Admins manage segments" on vd_customer_segments;
drop policy if exists "Admins read segment members" on vd_customer_segment_members;
drop policy if exists "Users read own segment membership" on vd_customer_segment_members;
create policy "Admins read segments"   on vd_customer_segments for select using (is_admin());
create policy "Admins manage segments" on vd_customer_segments for all    using (is_admin());
create policy "Admins read segment members" on vd_customer_segment_members for select using (is_admin());
create policy "Users read own segment membership" on vd_customer_segment_members for select using (user_id = auth.uid());

insert into vd_customer_segments (id, name, description) values
  ('prospects',              'Prospects',              'Registered but never completed a booking'),
  ('first_time_customers',   'First-time Customers',   'Exactly one active (non-cancelled) booking'),
  ('returning_customers',    'Returning Customers',    'Two or more active bookings'),
  ('upcoming_travellers',    'Upcoming Travellers',    'Has a future, non-cancelled booking'),
  ('recent_travellers',      'Recent Travellers',      'Completed a trip in the last 30 days'),
  ('high_value_customers',   'High-value Customers',   'Lifetime spend at or above the configured threshold'),
  ('international_visitors', 'International Visitors', 'Country set and outside South Africa'),
  ('dormant_customers',      'Dormant Customers',      'No order activity in the configured window and no upcoming trip')
on conflict (id) do nothing;

create or replace function public.vd_recompute_segments(
  p_high_value_threshold numeric default 50000,
  p_dormant_days integer default 180,
  p_recent_days integer default 30
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Callable by an admin from the (future) admin UI, or by the service role
  -- from a scheduled job (auth.role() = 'service_role' — see the
  -- /api/cron/recompute-segments route, which mirrors the existing
  -- expire-pending-bookings cron and carries no user JWT at all).
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'admin only';
  end if;

  create temporary table _vd_segment_membership (segment_id text not null, user_id uuid not null) on commit drop;

  -- Prospects: registered, zero non-cancelled orders.
  insert into _vd_segment_membership
  select 'prospects', p.id
  from profiles p
  where not exists (
    select 1 from vd_orders o where o.user_id = p.id and o.booking_status <> 'cancelled'
  );

  -- First-time / returning: order count per customer.
  insert into _vd_segment_membership
  select case when x.n = 1 then 'first_time_customers' else 'returning_customers' end, x.user_id
  from (
    select user_id, count(*) as n
    from vd_orders
    where user_id is not null and booking_status <> 'cancelled'
    group by user_id
  ) x
  where x.n >= 1;

  -- Upcoming travellers: a future travel_start on a non-cancelled order.
  insert into _vd_segment_membership
  select distinct 'upcoming_travellers', user_id
  from vd_orders
  where user_id is not null and booking_status <> 'cancelled'
    and travel_start is not null and travel_start >= current_date;

  -- Recent travellers: a trip marked completed within the recent window.
  insert into _vd_segment_membership
  select distinct 'recent_travellers', user_id
  from vd_orders
  where user_id is not null and trip_status = 'completed'
    and travel_end is not null and travel_end >= (current_date - p_recent_days);

  -- High-value: lifetime spend across non-cancelled orders.
  insert into _vd_segment_membership
  select 'high_value_customers', x.user_id
  from (
    select user_id, sum(total_value) as spend
    from vd_orders
    where user_id is not null and booking_status <> 'cancelled'
    group by user_id
  ) x
  where x.spend >= p_high_value_threshold;

  -- International: explicit country set on the CRM profile, not South Africa.
  insert into _vd_segment_membership
  select 'international_visitors', user_id
  from vd_customer_profiles
  where country is not null and trim(country) <> ''
    and lower(country) not in ('south africa', 'za', 'rsa');

  -- Dormant: last order activity older than the window, and nothing upcoming.
  insert into _vd_segment_membership
  select 'dormant_customers', x.user_id
  from (
    select user_id,
           max(created_at) as last_activity,
           bool_or(booking_status <> 'cancelled' and travel_start is not null and travel_start >= current_date) as has_upcoming
    from vd_orders
    where user_id is not null
    group by user_id
  ) x
  where x.last_activity < (now() - (p_dormant_days || ' days')::interval)
    and not x.has_upcoming;

  -- Full replace: these eight ids are entirely owned by this function.
  delete from vd_customer_segment_members
  where segment_id in (
    'prospects', 'first_time_customers', 'returning_customers', 'upcoming_travellers',
    'recent_travellers', 'high_value_customers', 'international_visitors', 'dormant_customers'
  );
  insert into vd_customer_segment_members (segment_id, user_id, computed_at)
  select distinct segment_id, user_id, now() from _vd_segment_membership
  on conflict (segment_id, user_id) do update set computed_at = excluded.computed_at;

  -- Derive lifecycle_stage (§1) from the same membership, most-advanced wins.
  -- Never touches a profile an admin has already flagged 'advocate'.
  update vd_customer_profiles cp
  set lifecycle_stage = sub.stage, updated_at = now()
  from (
    select p.id as user_id,
      case
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'returning_customers' and s.user_id = p.id) then 'returning_customer'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'upcoming_travellers'  and s.user_id = p.id) then 'upcoming_traveller'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'recent_travellers'    and s.user_id = p.id) then 'traveller'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'first_time_customers' and s.user_id = p.id) then 'customer'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'prospects'            and s.user_id = p.id) then 'prospect'
        else 'visitor'
      end as stage
    from profiles p
  ) sub
  where cp.user_id = sub.user_id
    and cp.lifecycle_stage <> 'advocate';
end;
$$;
grant execute on function public.vd_recompute_segments(numeric, integer, integer) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. vd_touch_session() / vd_track_event() — the public write API (§21).
--    Client code never inserts into vd_sessions/vd_analytics_events
--    directly; everything goes through these two SECURITY DEFINER functions,
--    which set user_id from auth.uid() server-side (never trusted from the
--    client) and cap payload size against abuse.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_touch_session(
  p_session_id uuid,
  p_anon_id text,
  p_landing_page text default null,
  p_referrer text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_device_type text default null,
  p_browser text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_anon_id is null or p_anon_id = '' then
    raise exception 'anon_id is required';
  end if;

  if p_session_id is not null then
    select id into v_id from vd_sessions where id = p_session_id;
  end if;

  if v_id is null then
    insert into vd_sessions (
      id, anon_id, user_id, landing_page, referrer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, device_type, browser
    ) values (
      coalesce(p_session_id, gen_random_uuid()), p_anon_id, auth.uid(), p_landing_page, p_referrer,
      p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_device_type, p_browser
    )
    returning id into v_id;
  else
    -- First-touch acquisition data is never overwritten by a later call —
    -- only recency and identity (once known) are updated here.
    update vd_sessions
    set last_seen_at = now(),
        user_id = coalesce(user_id, auth.uid())
    where id = v_id;
  end if;

  return v_id;
end;
$$;
grant execute on function public.vd_touch_session(uuid, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.vd_track_event(
  p_session_id uuid,
  p_anon_id text,
  p_event_name text,
  p_properties jsonb default '{}'::jsonb,
  p_page_url text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if p_event_name is null or p_event_name = '' then
    raise exception 'event_name is required';
  end if;
  if p_anon_id is null or p_anon_id = '' then
    raise exception 'anon_id is required';
  end if;
  if p_properties is not null and pg_column_size(p_properties) > 8192 then
    raise exception 'properties payload too large';
  end if;

  if p_session_id is not null then
    update vd_sessions set last_seen_at = now(), user_id = coalesce(user_id, auth.uid())
    where id = p_session_id;
  end if;

  insert into vd_analytics_events (session_id, anon_id, user_id, event_name, properties, page_url)
  values (p_session_id, p_anon_id, auth.uid(), p_event_name, coalesce(p_properties, '{}'::jsonb), p_page_url)
  returning id into v_id;

  if auth.uid() is not null then
    update vd_customer_profiles
    set last_seen_at = now(),
        first_seen_at = coalesce(first_seen_at, now()),
        updated_at = now()
    where user_id = auth.uid();
  end if;

  return v_id;
end;
$$;
grant execute on function public.vd_track_event(uuid, text, text, jsonb, text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Seed vd_customer_profiles for every existing account, and extend the
--    signup trigger so every new one gets a row from day one.
-- ────────────────────────────────────────────────────────────────────────────
insert into vd_customer_profiles (user_id, first_seen_at, lifecycle_stage)
select id, created_at, 'prospect' from profiles
on conflict (user_id) do nothing;

-- Re-declares the same handle_new_user() function from 20260704 (same name,
-- trigger stays attached) with one addition: seed the CRM profile too.
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

  insert into vd_customer_profiles (user_id, acquisition_source, first_seen_at, lifecycle_stage)
  values (new.id, coalesce(new.raw_user_meta_data->>'acquisition_source', 'direct'), now(), 'prospect')
  on conflict (user_id) do nothing;

  return new;
end;
$$;
