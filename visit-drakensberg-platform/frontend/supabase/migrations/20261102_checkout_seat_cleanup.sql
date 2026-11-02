-- ============================================================================
-- Visit Drakensberg — Unpaid checkouts give their seats back, and suppliers
-- see who booked online
-- Run AFTER 20261101_invoice_line_discounts.sql.
--
-- Traced on Umphafa Berg Tours' Thukela Falls departure of 2026-11-14, which
-- showed 7 of 10 seats booked for 4 real guests:
--
--   * A checkout booking claims its seats permanently (vd_claim_inventory_holds
--     sets expires_at = infinity) and only vd_expire_pending_bookings gives
--     them back — but that ran once a day (vercel.json, Hobby-tier cron), not
--     "after 30 minutes" as the checkout promises. Two guests whose first
--     attempt was declined or abandoned retried and paid; each kept two seats
--     until the next 03:00 UTC sweep.
--   * Nothing released a customer's earlier unpaid attempt when a retry paid.
--   * The supplier's Guests list read only vd_departure_guests (guests typed in
--     by hand), never checkout bookings, so paid guests were invisible — and
--     one was typed in again by hand, taking a second seat.
--
-- This migration:
--   1. vd_cancel_pending_booking()       — cancel one unpaid checkout and
--                                          release exactly what it held.
--   2. vd_expire_pending_bookings()      — one policy: a pending booking is
--                                          released 30 minutes after it was
--                                          made, or 2 hours if its payment
--                                          page is still open (the guest may
--                                          still be paying).
--   3. vd_sweep_abandoned_checkouts()    — that, plus expired unclaimed holds,
--                                          run every 5 minutes by pg_cron
--                                          inside the database (the daily
--                                          Vercel cron stays as a backstop).
--   4. vd_supersede_pending_bookings()   — when a booking is paid, the same
--                                          customer's other unpaid attempts on
--                                          the same departures/timeslots are
--                                          released at once.
--   5. vd_departure_bookings()           — the checkout bookings on one
--                                          departure, for its supplier / ops.
--   6. Security: vd_expire_pending_bookings was executable by anyone,
--      signed out included, with no check — a call with 0 minutes cancelled
--      every pending booking on the platform, including guests mid-payment.
--      It is now server-only.
-- ============================================================================
-- @rollback: additive — new functions and a pg_cron job (cron.unschedule('vd-sweep-abandoned-checkouts')); vd_expire_pending_bookings is restorable from 20260914_inventory_holds.sql

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Cancel one unpaid checkout. Internal: never granted to a client.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_cancel_pending_booking(p_booking_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_order record;
begin
  update vd_bookings set status = 'cancelled' where id = p_booking_id and status = 'pending';
  if not found then return false; end if;

  update vd_booking_orders set status = 'cancelled' where booking_id = p_booking_id;
  for v_order in select id from vd_orders where booking_id = p_booking_id loop
    perform vd_cancel_order(v_order.id);
  end loop;
  perform vd_release_booking_inventory(p_booking_id);
  return true;
end;
$$;
revoke all on function public.vd_cancel_pending_booking(text) from public, anon, authenticated;

/** Whether a booking still has a payment page open (the guest may be paying). */
create or replace function public.vd_booking_payment_open(p_booking_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vd_payment_links pl join vd_orders o on o.id = pl.order_id
     where o.booking_id = p_booking_id and pl.status = 'pending')
$$;
revoke all on function public.vd_booking_payment_open(text) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. The expiry policy, in one place.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_expire_pending_bookings(p_older_than_minutes int default 30)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_minutes int := greatest(coalesce(p_older_than_minutes, 30), 30);
  v_booking record;
  v_count   int := 0;
begin
  for v_booking in
    select id, created_at from vd_bookings
     where status = 'pending' and created_at < now() - (v_minutes || ' minutes')::interval
     order by created_at
  loop
    -- A payment page still open gets longer: cancelling under a guest who is
    -- typing their card details would take their seat while they pay.
    if vd_booking_payment_open(v_booking.id)
       and v_booking.created_at > now() - interval '2 hours' then
      continue;
    end if;
    if vd_cancel_pending_booking(v_booking.id) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;
-- Server only (the Vercel cron uses the service role; pg_cron runs as the
-- owner). It used to be callable by anyone, signed out included.
revoke all on function public.vd_expire_pending_bookings(int) from public, anon, authenticated;
grant execute on function public.vd_expire_pending_bookings(int) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. The sweep pg_cron runs. vd_expire_inventory_holds can't be reused as is:
--    it insists on an admin or service-role JWT, and a scheduled job has none.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_sweep_abandoned_checkouts()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_hold  vd_inventory_holds%rowtype;
  v_count int;
begin
  v_count := vd_expire_pending_bookings(30);
  for v_hold in
    select * from vd_inventory_holds
     where released_at is null and booking_id is null and expires_at <= now()
     for update skip locked
  loop
    update vd_inventory_holds set released_at = now() where id = v_hold.id;
    perform vd_inventory_adjust(v_hold.kind, v_hold.entity_id, v_hold.slot_key, -v_hold.seats);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.vd_sweep_abandoned_checkouts() from public, anon, authenticated;
grant execute on function public.vd_sweep_abandoned_checkouts() to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. A paid booking releases the same customer's other unpaid attempts at the
--    same departures / timeslots. Called by the payment webhook (service role).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_supersede_pending_bookings(p_booking_id text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid;
  v_other   record;
  v_count   int := 0;
begin
  if auth.uid() is not null and not coalesce(is_ops(), false) then
    raise exception 'not allowed';
  end if;
  select user_id into v_user from vd_bookings where id = p_booking_id;
  if v_user is null then return 0; end if;

  -- Only a true repeat of the paid booking: every seat it still holds is on a
  -- departure/timeslot the paid booking also holds, and it has no stay (rooms
  -- aren't holds, so a stay can't be matched). Anything more — a second hike,
  -- a room — means it isn't just an earlier try at the same thing, and
  -- cancelling it would take inventory the guest hasn't re-bought. Those wait
  -- for the 30-minute sweep instead.
  for v_other in
    select b.id
      from vd_bookings b
     where b.user_id = v_user
       and b.status = 'pending'
       and b.id <> p_booking_id
       and coalesce(b.value->'stay'->>'id', '') = ''
       and exists (select 1 from vd_inventory_holds h
                    where h.booking_id = b.id and h.released_at is null)
       and not exists (
         select 1 from vd_inventory_holds h
          where h.booking_id = b.id and h.released_at is null
            and not exists (
              select 1 from vd_inventory_holds mine
               where mine.booking_id = p_booking_id and mine.released_at is null
                 and mine.kind = h.kind and mine.entity_id = h.entity_id and mine.slot_key = h.slot_key))
  loop
    if vd_cancel_pending_booking(v_other.id) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.vd_supersede_pending_bookings(text) from public, anon, authenticated;
grant execute on function public.vd_supersede_pending_bookings(text) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Who booked a departure online — for its supplier, people managing that
--    supplier, and ops. Name and email only: the supplier's copy of a booking
--    has never carried the guest's phone number, and this doesn't either.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_departure_bookings(p_departure_id text)
returns table (
  booking_id     text,
  reference      text,
  status         text,
  customer_name  text,
  customer_email text,
  seats          int,
  package_id     text,
  rate_title     text,
  booked_at      timestamptz,
  payment_open   boolean,
  releases_at    timestamptz
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not vd_may_manage_inventory(p_departure_id) then raise exception 'not allowed'; end if;

  return query
  with held as (
    select h.booking_id as bid, sum(h.seats)::int as seats
      from vd_inventory_holds h
     where h.kind = 'departure' and h.entity_id = p_departure_id
       and h.booking_id is not null and h.released_at is null
     group by h.booking_id
  ),
  -- Bookings from before seat holds existed took their seats directly; they
  -- are found through the departure in their addons instead.
  legacy as (
    select b.id as bid, sum(coalesce((a->>'guests')::int, 1))::int as seats
      from vd_bookings b, jsonb_array_elements(coalesce(b.value->'addons', '[]'::jsonb)) a
     where a->>'id' = p_departure_id
       and b.status in ('confirmed', 'pending')
       and not exists (select 1 from vd_inventory_holds h where h.booking_id = b.id)
     group by b.id
  ),
  seated as (select * from held union all select * from legacy)
  select b.id, b.reference, b.status,
         btrim(coalesce(b.value->>'customerName', '')),
         nullif(btrim(coalesce(b.value->>'customerEmail', '')), ''),
         s.seats,
         (select a->>'packageId' from jsonb_array_elements(coalesce(b.value->'addons', '[]'::jsonb)) a
           where a->>'id' = p_departure_id limit 1),
         (select a->>'title' from jsonb_array_elements(coalesce(b.value->'addons', '[]'::jsonb)) a
           where a->>'id' = p_departure_id limit 1),
         b.created_at,
         vd_booking_payment_open(b.id),
         case when b.status = 'pending'
              then b.created_at + case when vd_booking_payment_open(b.id)
                                       then interval '2 hours' else interval '30 minutes' end
         end
    from seated s join vd_bookings b on b.id = s.bid
   where b.status in ('confirmed', 'pending')
   order by b.created_at;
end;
$$;
revoke all on function public.vd_departure_bookings(text) from public, anon;
grant execute on function public.vd_departure_bookings(text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Every 5 minutes, inside the database. Skipped where pg_cron isn't
--    available (the local test database); the daily Vercel cron still runs.
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'vd-sweep-abandoned-checkouts';
    perform cron.schedule('vd-sweep-abandoned-checkouts', '*/5 * * * *',
                          'select public.vd_sweep_abandoned_checkouts()');
  else
    raise notice 'pg_cron not available: abandoned checkouts are swept by the daily cron only';
  end if;
end $$;
