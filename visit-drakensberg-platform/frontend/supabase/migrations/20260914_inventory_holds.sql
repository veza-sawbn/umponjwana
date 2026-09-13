-- ============================================================================
-- Visit Drakensberg — Inventory holds belong to a booking, and expire
--
-- Run AFTER 20260913_least_privilege_profiles_and_entities.sql.
--
-- Closes the H4 follow-up recorded in docs/security/SECURITY_AUDIT_2026-09.md,
-- and corrects that finding's scope.
--
-- ────────────────────────────────────────────────────────────────────────────
-- WHAT THE AUDIT GOT WRONG
-- ────────────────────────────────────────────────────────────────────────────
-- H4 named vd_book_seats and vd_release_seats. It should have named four
-- functions: 20260829_activity_timeslots.sql built the identical pair for
-- activity timeslots, with the identical defect —
--
--   create or replace function public.vd_release_activity_slot(…) as $$
--   begin
--     if auth.uid() is null then raise exception 'authentication required'; end if;
--     -- …then decrements slotBookings on whatever activity id it was handed
--
-- so any signed-in user could walk an operator's activities zeroing their
-- per-date slot counts, exactly as they could walk their departures. That
-- pair is worse in one respect: vd_release_activity_slot never validated
-- p_seats at all, so a NEGATIVE release ran `greatest(v_booked - (-n), 0)` and
-- INFLATED the booked count — letting anyone mark any activity's timeslot
-- fully booked on any date, permanently, with one call.
--
-- The 20260913 migration fixed the departure pair. This one fixes the activity
-- pair the same way and replaces the underlying model for both.
--
-- ────────────────────────────────────────────────────────────────────────────
-- THE MODEL, AND WHY IT HAD TO CHANGE
-- ────────────────────────────────────────────────────────────────────────────
-- 20260913 could bound vd_book_seats but not close it: /checkout reserves
-- seats BEFORE the booking row exists, so requiring a booking would have
-- broken the only legitimate caller. A 20-seat ceiling per call stops one
-- request exhausting a departure; it does not stop a loop.
--
-- The reason a loop worked is that a taken seat had no owner. bookedSeats went
-- up and nothing recorded who took it, so nothing could tell an abandoned
-- checkout from a real booking, and nothing could give the seat back except a
-- caller volunteering to.
--
-- A hold fixes that. vd_hold_inventory takes the seats AND writes a row saying
-- who holds them and until when. That single change does three things at once:
--
--   * an attacker's own outstanding holds count against their quota, so the
--     loop stops after 30 seats instead of running until the departure is
--     full;
--   * holds expire, so an abandoned checkout returns its seats on the next
--     sweep instead of holding them until someone notices (which for
--     activity timeslots was never — vd_expire_pending_bookings released
--     departure seats and silently left timeslots held forever);
--   * a booking claims its holds, so cancelling a booking releases exactly
--     what that booking took, rather than re-deriving it from the addons
--     blob and hoping the two agree.
--
-- vd_book_seats and vd_book_activity_slot become what their remaining callers
-- actually are: a supplier recording a guest who booked off-platform
-- (lib/departure-guests.ts addManualGuest). Those are permanent takes with no
-- TTL, and they are now owner/staff/ops-only.
--
-- ────────────────────────────────────────────────────────────────────────────
-- LIMITS, STATED
-- ────────────────────────────────────────────────────────────────────────────
-- A quota of 30 outstanding seats per account is generous for a real trip and
-- cheap for an attacker with 30 accounts. This bounds abuse and makes it
-- visible and self-healing; it does not make it impossible. Registration is
-- open, so the real ceiling on a distributed version of this attack is the
-- rate limiting in lib/rate-limit.ts and the audit trail below — not this
-- table.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. The holds table
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_inventory_holds (
  id          uuid primary key default gen_random_uuid(),
  -- 'departure'     → entity_id is the departure's vd_entities id, slot_key ''
  -- 'activity_slot' → entity_id is the activity's id, slot_key '<date>:<timeslotId>'
  kind        text not null check (kind in ('departure', 'activity_slot')),
  entity_id   text not null,
  slot_key    text not null default '',
  user_id     uuid not null references auth.users(id) on delete cascade,
  seats       int  not null check (seats > 0),
  -- Null until the booking exists and claims it. A claimed hold is what that
  -- booking is holding; releasing the booking releases exactly these.
  booking_id  text,
  expires_at  timestamptz not null,
  released_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists vd_inventory_holds_open_idx
  on vd_inventory_holds (user_id, released_at)
  where released_at is null;
create index if not exists vd_inventory_holds_booking_idx
  on vd_inventory_holds (booking_id)
  where booking_id is not null;
create index if not exists vd_inventory_holds_sweep_idx
  on vd_inventory_holds (expires_at)
  where released_at is null and booking_id is null;

alter table vd_inventory_holds enable row level security;

drop policy if exists "Users read own holds"    on vd_inventory_holds;
drop policy if exists "Staff read all holds"    on vd_inventory_holds;

-- Read-only to the holder and to staff. Every write goes through the
-- SECURITY DEFINER functions below, which is the whole point: a hold must
-- never be creatable or editable without the seat count moving with it.
create policy "Users read own holds" on vd_inventory_holds
  for select using (user_id = auth.uid());
create policy "Staff read all holds" on vd_inventory_holds
  for select using (is_ops());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Tunables
-- ────────────────────────────────────────────────────────────────────────────

/** Minutes a hold survives unclaimed. Matches the pending-booking TTL. */
create or replace function public.vd_hold_ttl_minutes()
returns int language sql immutable as $$ select 30 $$;

/** Most seats one account may hold at once, across everything. */
create or replace function public.vd_max_held_seats_per_user()
returns int language sql immutable as $$ select 30 $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Reading and writing a booked count, for either kind
--
--    Departures keep it at value.bookedSeats; activities keep it nested at
--    value.slotBookings['<date>:<timeslotId>'] (20260829). One pair of
--    helpers so the hold functions below do not branch on kind three times
--    each. Both assume the caller already holds the row lock.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.vd_inventory_booked(
  p_kind text, p_value jsonb, p_slot_key text
) returns int language sql immutable as $$
  select case p_kind
    when 'departure' then coalesce((p_value->>'bookedSeats')::int, 0)
    else coalesce((p_value #>> array['slotBookings', p_slot_key])::int, 0)
  end
$$;

create or replace function public.vd_inventory_capacity(
  p_kind text, p_value jsonb, p_slot_key text
) returns int language plpgsql immutable as $$
declare v_capacity int;
begin
  if p_kind = 'departure' then
    return (p_value->>'maxSeats')::int;
  end if;
  select (t->>'capacity')::int into v_capacity
    from jsonb_array_elements(coalesce(p_value->'timeslots', '[]'::jsonb)) t
   where t->>'id' = split_part(p_slot_key, ':', 2);
  return v_capacity;
end;
$$;

/**
 * Move a booked count by p_delta, clamped at zero, and keep the departure's
 * open/full status in step. Assumes the row is already locked.
 */
create or replace function public.vd_inventory_adjust(
  p_kind text, p_entity_id text, p_slot_key text, p_delta int
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_value jsonb;
  v_after int;
  v_max   int;
begin
  select value into v_value from vd_entities where id = p_entity_id;
  if not found then return; end if;

  v_after := greatest(vd_inventory_booked(p_kind, v_value, p_slot_key) + p_delta, 0);

  if p_kind = 'departure' then
    v_max := coalesce((v_value->>'maxSeats')::int, 0);
    update vd_entities
       set value = value
                   || jsonb_build_object('bookedSeats', v_after)
                   || case when v_max > 0 and v_after >= v_max
                           then jsonb_build_object('status', 'full')
                           else jsonb_build_object('status',
                                  case when status = 'full' then 'open' else status end)
                      end,
           status = case
                      when v_max > 0 and v_after >= v_max then 'full'
                      when status = 'full' then 'open'
                      else status end,
           updated_at = now()
     where id = p_entity_id;
  else
    -- The `|| jsonb_build_object('slotBookings', …)` is not decoration, it
    -- fixes a live bug in 20260829_activity_timeslots.sql.
    --
    -- jsonb_set(value, array['slotBookings', key], …, true) creates only the
    -- LAST level of the path. When value has no 'slotBookings' object at all —
    -- which is every activity until its first booking — the intermediate level
    -- is missing and jsonb_set returns the input UNCHANGED:
    --
    --   select jsonb_set('{}'::jsonb, array['slotBookings','k'], '3', true);
    --   → {}
    --
    -- So vd_book_activity_slot moved no counter on the first booking, the
    -- 'slotBookings' object was therefore never created, and every subsequent
    -- booking hit the same missing parent. The count stayed absent forever,
    -- vd_book_activity_slot's capacity test always read 0, and an activity
    -- timeslot could be sold without limit. Seeding the parent first makes the
    -- write land.
    update vd_entities
       set value = jsonb_set(
                     coalesce(value, '{}'::jsonb)
                       || jsonb_build_object('slotBookings',
                            coalesce(value->'slotBookings', '{}'::jsonb)),
                     array['slotBookings', p_slot_key],
                     to_jsonb(v_after), true),
           updated_at = now()
     where id = p_entity_id;
  end if;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Taking a hold
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_hold_inventory(
  p_kind text, p_entity_id text, p_slot_key text, p_seats int
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_value    jsonb;
  v_capacity int;
  v_booked   int;
  v_held     int;
  v_hold_id  uuid;
  v_entity_kind text := case when p_kind = 'departure' then 'departure' else 'activity' end;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_kind not in ('departure', 'activity_slot') then
    raise exception 'unknown inventory kind: %', p_kind;
  end if;
  if p_seats is null or p_seats <= 0 then raise exception 'invalid seat count'; end if;
  if p_seats > vd_max_seats_per_booking() then
    raise exception 'a single booking cannot reserve more than % seats', vd_max_seats_per_booking();
  end if;
  if p_kind = 'activity_slot' and coalesce(p_slot_key, '') !~ '^\d{4}-\d{2}-\d{2}:.+$' then
    raise exception 'invalid timeslot reference';
  end if;

  -- The quota is what actually stops a loop: the attacker's own outstanding
  -- holds are counted, so taking seats costs them their own budget rather
  -- than being free. Expired holds do not count even before the sweep clears
  -- them, so an abandoned checkout never locks a genuine customer out.
  select coalesce(sum(seats), 0) into v_held
    from vd_inventory_holds
   where user_id = auth.uid()
     and released_at is null
     and booking_id is null
     and expires_at > now();

  if v_held + p_seats > vd_max_held_seats_per_user() then
    raise exception 'you already hold % seats — complete or cancel that checkout first', v_held
      using hint = 'One account may hold at most '
                   || vd_max_held_seats_per_user() || ' unbooked seats at a time.';
  end if;

  select value into v_value
    from vd_entities
   where id = p_entity_id and kind = v_entity_kind
     for update;
  if not found then raise exception 'not found'; end if;

  v_capacity := vd_inventory_capacity(p_kind, v_value, p_slot_key);
  if v_capacity is null then raise exception 'timeslot not found'; end if;
  v_booked := vd_inventory_booked(p_kind, v_value, p_slot_key);

  if v_booked + p_seats > v_capacity then
    if p_kind = 'departure' then
      raise exception 'not enough seats available';
    else
      raise exception 'This timeslot is fully booked for the selected date.';
    end if;
  end if;

  perform vd_inventory_adjust(p_kind, p_entity_id, p_slot_key, p_seats);

  insert into vd_inventory_holds (kind, entity_id, slot_key, user_id, seats, expires_at)
  values (p_kind, p_entity_id, coalesce(p_slot_key, ''), auth.uid(), p_seats,
          now() + (vd_hold_ttl_minutes() || ' minutes')::interval)
  returning id into v_hold_id;

  return v_hold_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Releasing one hold (the checkout rollback path)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_release_inventory_hold(p_hold_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_hold vd_inventory_holds%rowtype;
begin
  select * into v_hold from vd_inventory_holds where id = p_hold_id for update;
  if not found then return; end if;
  if v_hold.released_at is not null then return; end if;   -- idempotent

  -- The holder, staff, or a caller with no user JWT (the sweep).
  if auth.uid() is not null and v_hold.user_id <> auth.uid() and not is_ops() then
    raise exception 'not allowed to release this hold';
  end if;

  update vd_inventory_holds set released_at = now() where id = p_hold_id;
  perform vd_inventory_adjust(v_hold.kind, v_hold.entity_id, v_hold.slot_key, -v_hold.seats);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Claiming holds for a booking
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_claim_inventory_holds(
  p_booking_id text, p_hold_ids uuid[]
) returns int language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_count int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_hold_ids is null or array_length(p_hold_ids, 1) is null then return 0; end if;

  select user_id into v_owner from vd_bookings where id = p_booking_id;
  if v_owner is null then raise exception 'booking not found'; end if;
  if v_owner <> auth.uid() and not is_ops() then
    raise exception 'not allowed';
  end if;

  -- Only the caller's own unclaimed, unreleased holds. A hold id belonging to
  -- someone else is silently skipped rather than moved onto this booking.
  update vd_inventory_holds
     set booking_id = p_booking_id,
         -- A claimed hold no longer expires on its own: the booking's own
         -- lifecycle (vd_expire_pending_bookings, or a cancellation) owns it
         -- from here.
         expires_at = 'infinity'::timestamptz
   where id = any (p_hold_ids)
     and user_id = auth.uid()
     and booking_id is null
     and released_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Releasing everything a booking holds (cancellation)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_release_booking_inventory(p_booking_id text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_booking vd_bookings%rowtype;
  v_hold    vd_inventory_holds%rowtype;
  v_addon   jsonb;
  v_count   int := 0;
  v_allowed boolean;
begin
  select * into v_booking from vd_bookings where id = p_booking_id;
  if not found then return 0; end if;

  -- The guest, staff, a supplier on the booking, or the sweep (no user JWT).
  v_allowed := auth.uid() is null
               or v_booking.user_id = auth.uid()
               or is_ops()
               or auth.uid() = any (coalesce(v_booking.supplier_ids, array[]::uuid[]));
  if not v_allowed then
    raise exception 'not allowed to release this booking''s inventory';
  end if;

  for v_hold in
    select * from vd_inventory_holds
     where booking_id = p_booking_id and released_at is null
     for update
  loop
    update vd_inventory_holds set released_at = now() where id = v_hold.id;
    perform vd_inventory_adjust(v_hold.kind, v_hold.entity_id, v_hold.slot_key, -v_hold.seats);
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then return v_count; end if;

  -- No holds: a booking made before this migration, whose seats were taken by
  -- the old vd_book_seats path. Fall back to the addons blob, which is what
  -- the cancellation call sites used to walk client-side. Only reached for
  -- legacy rows, and it double-releases nothing because the branch above
  -- returned when holds existed.
  for v_addon in
    select * from jsonb_array_elements(coalesce(v_booking.value->'addons', '[]'::jsonb))
  loop
    if exists (select 1 from vd_entities where id = v_addon->>'id' and kind = 'departure') then
      perform vd_inventory_adjust('departure', v_addon->>'id', '',
                                  -coalesce((v_addon->>'guests')::int, 1));
      v_count := v_count + 1;
    elsif coalesce(v_addon->>'activityId', '') <> ''
      and coalesce(v_addon->>'timeslotId', '') <> ''
      and coalesce(v_addon->>'date', '') <> '' then
      perform vd_inventory_adjust('activity_slot', v_addon->>'activityId',
                                  (v_addon->>'date') || ':' || (v_addon->>'timeslotId'),
                                  -coalesce((v_addon->>'guests')::int, 1));
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. The sweep
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_expire_inventory_holds()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_hold  vd_inventory_holds%rowtype;
  v_count int := 0;
begin
  if not coalesce(is_admin() or auth.role() = 'service_role', false) then
    raise exception 'admin only';
  end if;

  for v_hold in
    select * from vd_inventory_holds
     where released_at is null
       and booking_id is null
       and expires_at <= now()
     for update skip locked
  loop
    update vd_inventory_holds set released_at = now() where id = v_hold.id;
    perform vd_inventory_adjust(v_hold.kind, v_hold.entity_id, v_hold.slot_key, -v_hold.seats);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. vd_expire_pending_bookings now releases through the holds
--
--    Copied from 20260803_expire_pending_bookings.sql with only the addon
--    loop replaced. That loop released departure seats and silently ignored
--    activity timeslots, so an abandoned checkout held a timeslot forever;
--    vd_release_booking_inventory covers both, and falls back to the same
--    addon walk for bookings that predate the holds table.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_expire_pending_bookings(p_older_than_minutes int default 30)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := now() - (p_older_than_minutes || ' minutes')::interval;
  v_booking record;
  v_order record;
  v_count int := 0;
begin
  for v_booking in
    select id from vd_bookings where status = 'pending' and created_at < v_cutoff
  loop
    update vd_bookings set status = 'cancelled' where id = v_booking.id and status = 'pending';
    if not found then continue; end if;

    update vd_booking_orders set status = 'cancelled' where booking_id = v_booking.id;

    for v_order in select id from vd_orders where booking_id = v_booking.id loop
      perform vd_cancel_order(v_order.id);
    end loop;

    perform vd_release_booking_inventory(v_booking.id);

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. The direct-take functions become what their callers actually are
--
--     Both are now the supplier recording a guest who booked off-platform
--     (lib/departure-guests.ts addManualGuest): a permanent take with no TTL,
--     made by the operator, on their own inventory. /checkout no longer calls
--     either — it holds.
-- ────────────────────────────────────────────────────────────────────────────

/** May the caller take or return inventory on this entity directly? */
create or replace function public.vd_may_manage_inventory(p_entity_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null then return true; end if;   -- service role / in-database
  if is_ops() then return true; end if;

  select owner_id into v_owner from vd_entities where id = p_entity_id;
  if v_owner is null then return false; end if;
  if v_owner = auth.uid() then return true; end if;
  return has_supplier_permission(v_owner, 'manage_bookings')
      or has_supplier_permission(v_owner, 'manage_inventory');
end;
$$;

create or replace function public.vd_book_seats(p_departure_id text, p_seats int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_max int; v_booked int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_seats is null or p_seats <= 0 then raise exception 'invalid seat count'; end if;
  if p_seats > vd_max_seats_per_booking() then
    raise exception 'a single booking cannot reserve more than % seats', vd_max_seats_per_booking();
  end if;
  -- A customer reserving at checkout uses vd_hold_inventory. This path is the
  -- operator recording a guest on their own departure.
  if not vd_may_manage_inventory(p_departure_id) then
    raise exception 'not allowed to book seats on this departure';
  end if;

  select (value->>'maxSeats')::int, coalesce((value->>'bookedSeats')::int, 0)
    into v_max, v_booked
    from vd_entities
   where id = p_departure_id and kind = 'departure'
     for update;

  if not found then raise exception 'departure not found'; end if;
  if v_booked + p_seats > v_max then raise exception 'not enough seats available'; end if;

  perform vd_inventory_adjust('departure', p_departure_id, '', p_seats);

  perform vd_audit('departure.seats_booked', 'departure', p_departure_id,
                   jsonb_build_object('seats', p_seats, 'bookedAfter', v_booked + p_seats));
end;
$$;

create or replace function public.vd_book_activity_slot(
  p_activity_id text, p_slot_date date, p_timeslot_id text, p_seats int
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_value jsonb;
  v_capacity int;
  v_key text := p_slot_date::text || ':' || p_timeslot_id;
  v_booked int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_seats is null or p_seats <= 0 then raise exception 'invalid seat count'; end if;
  if p_seats > vd_max_seats_per_booking() then
    raise exception 'a single booking cannot reserve more than % seats', vd_max_seats_per_booking();
  end if;
  if not vd_may_manage_inventory(p_activity_id) then
    raise exception 'not allowed to book seats on this activity';
  end if;

  select value into v_value
    from vd_entities
   where id = p_activity_id and kind = 'activity'
     for update;
  if not found then raise exception 'activity not found'; end if;

  v_capacity := vd_inventory_capacity('activity_slot', v_value, v_key);
  if v_capacity is null then raise exception 'timeslot not found'; end if;

  v_booked := vd_inventory_booked('activity_slot', v_value, v_key);
  if v_booked + p_seats > v_capacity then
    raise exception 'This timeslot is fully booked for the selected date.';
  end if;

  perform vd_inventory_adjust('activity_slot', p_activity_id, v_key, p_seats);

  perform vd_audit('activity.slot_booked', 'activity', p_activity_id,
                   jsonb_build_object('slot', v_key, 'seats', p_seats,
                                      'bookedAfter', v_booked + p_seats));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. vd_release_activity_slot — the half of H4 the audit missed
--
--     Authorized like vd_release_seats (20260913), and p_seats is validated,
--     which it never was: a negative release ran greatest(booked - (-n), 0)
--     and inflated the count, letting anyone mark any timeslot permanently
--     full on any date.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_release_activity_slot(
  p_activity_id text, p_slot_date date, p_timeslot_id text, p_seats int
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_key text := p_slot_date::text || ':' || p_timeslot_id;
begin
  if auth.uid() is null and coalesce(auth.role(), '') = '' then
    raise exception 'authentication required';
  end if;
  if p_seats is null or p_seats <= 0 then raise exception 'invalid seat count'; end if;

  if not vd_may_release_activity_slot(p_activity_id, v_key) then
    raise exception 'not allowed to release seats on this activity';
  end if;

  if not exists (select 1 from vd_entities where id = p_activity_id and kind = 'activity') then
    return;
  end if;

  perform vd_inventory_adjust('activity_slot', p_activity_id, v_key, -p_seats);
end;
$$;

/** Mirror of vd_may_release_seats, for an activity's timeslot. */
create or replace function public.vd_may_release_activity_slot(
  p_activity_id text, p_slot_key text
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null then return true; end if;
  if is_ops() then return true; end if;

  select owner_id into v_owner from vd_entities
   where id = p_activity_id and kind = 'activity';
  if v_owner is null then return false; end if;
  if v_owner = auth.uid() then return true; end if;
  if has_supplier_permission(v_owner, 'manage_bookings') then return true; end if;

  -- A guest releasing a slot they hold, either through a live hold or through
  -- a booking of theirs that references this activity.
  if exists (
    select 1 from vd_inventory_holds
     where user_id = auth.uid() and released_at is null
       and kind = 'activity_slot' and entity_id = p_activity_id and slot_key = p_slot_key
  ) then return true; end if;

  return exists (
    select 1 from vd_bookings b
     where b.user_id = auth.uid()
       and b.status <> 'cancelled'
       and b.value::text like '%' || p_activity_id || '%'
  );
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 12. Grants
-- ────────────────────────────────────────────────────────────────────────────
grant execute on function public.vd_hold_ttl_minutes()                          to anon, authenticated;
grant execute on function public.vd_max_held_seats_per_user()                   to anon, authenticated;
grant execute on function public.vd_hold_inventory(text, text, text, int)       to authenticated;
grant execute on function public.vd_release_inventory_hold(uuid)                to authenticated;
grant execute on function public.vd_claim_inventory_holds(text, uuid[])         to authenticated;
grant execute on function public.vd_release_booking_inventory(text)             to authenticated;
grant execute on function public.vd_may_manage_inventory(text)                  to authenticated;
grant execute on function public.vd_may_release_activity_slot(text, text)       to authenticated;
grant execute on function public.vd_book_seats(text, int)                       to authenticated;
grant execute on function public.vd_book_activity_slot(text, date, text, int)   to authenticated;
grant execute on function public.vd_release_activity_slot(text, date, text, int) to authenticated;

-- Service role / admin only: the sweep.
revoke execute on function public.vd_expire_inventory_holds() from public;

-- Internal helpers — not part of the client surface.
revoke execute on function public.vd_inventory_adjust(text, text, text, int) from public;
