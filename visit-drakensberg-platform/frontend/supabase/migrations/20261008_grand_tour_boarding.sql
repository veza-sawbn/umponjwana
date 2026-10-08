-- ============================================================================
-- Visit Drakensberg — Grand Tour Drakensberg: day-tour seat tickets
--
-- Run AFTER 20261008_event_ticketing.sql.
--
-- The Grand Tour is a set of day tours that experience suppliers list as
-- activities with a scheduled departure (an ActivityTimeslot) and, usually,
-- hotel pickups — e.g. the Sani Pass tour that collects guests at Champagne
-- Sports Resort in Champagne Valley before driving south. A guest books seats
-- on one (date, departure) through the normal checkout, which already holds
-- the seats atomically (vd_hold_inventory, kind 'activity_slot').
--
-- What was missing is the thing the operator checks before the bus leaves:
-- an individual, scannable ticket per seat. This reuses vd_tickets from
-- 20261008_event_ticketing.sql rather than building a second system:
--
--   1. vd_tickets learns a second product shape — an activity departure
--      (activity_id + slot_date + timeslot_id) beside an event session —
--      plus the pickup point and departure time printed on the ticket.
--   2. vd_issue_activity_tickets() mints them on payment confirmation. It
--      takes NO capacity: the seats were already held at checkout and claimed
--      by the booking, so counting them again would double-book the bus.
--   3. vd_redeem_ticket() refuses a day-tour ticket on the wrong day, so a
--      ticket for tomorrow's bus cannot board today's.
--
-- And it closes three gaps in the event-ticketing RPCs as written:
--
--   * vd_issue_tickets() let ANY caller with no user through, intending that
--     to mean "the service-role payment webhook". The anon key also has no
--     user, and Supabase grants EXECUTE on new public functions to anon by
--     default — so anyone could mint free tickets for any event. It now
--     requires the service role explicitly, and anon's EXECUTE is revoked.
--   * vd_release_tickets() had no authorization check at all: any caller
--     could void every ticket on any booking id. It now admits the same
--     callers vd_release_booking_inventory() does, minus anonymous ones.
--   * vd_release_tickets() decremented event capacity for every ticket; a
--     day-tour ticket has no event capacity to give back (its seats come back
--     through the inventory holds), so that only happens for event tickets.
-- ============================================================================
-- @rollback: additive — new columns (nullable), one relaxed NOT NULL trio, a check constraint and functions; restore the previous function bodies from 20261008_event_ticketing.sql to revert behaviour

-- ────────────────────────────────────────────────────────────────────────────
-- 1. vd_tickets — a ticket is for an event session OR an activity departure
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_tickets alter column event_id       drop not null;
alter table vd_tickets alter column session_id     drop not null;
alter table vd_tickets alter column ticket_type_id drop not null;

alter table vd_tickets add column if not exists activity_id     text references vd_entities(id) on delete cascade;
alter table vd_tickets add column if not exists slot_date       date;
alter table vd_tickets add column if not exists timeslot_id     text;
-- Printed on the ticket as issued, so a supplier editing the activity later
-- does not silently change what a guest was told.
alter table vd_tickets add column if not exists departure_time  text;
alter table vd_tickets add column if not exists pickup_point_id text;
alter table vd_tickets add column if not exists pickup_label    text;
alter table vd_tickets add column if not exists pickup_time     text;
alter table vd_tickets add column if not exists holder_name     text;

alter table vd_tickets drop constraint if exists vd_tickets_product_chk;
alter table vd_tickets add constraint vd_tickets_product_chk check (
  (event_id is not null and session_id is not null and ticket_type_id is not null)
  or (activity_id is not null and slot_date is not null and timeslot_id is not null)
);

create index if not exists vd_tickets_activity_departure_idx on vd_tickets (activity_id, slot_date, timeslot_id);
create index if not exists vd_tickets_order_line_idx         on vd_tickets (order_line_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_issue_tickets — the service role means the service role
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_issue_tickets(
  p_event_id       text,
  p_session_id     text,
  p_ticket_type_id text,
  p_qty            int,
  p_booking_id     text default null,
  p_order_id       text default null,
  p_order_line_id  text default null
) returns setof vd_tickets
language plpgsql security definer set search_path = public as $$
declare
  v_owner   uuid;
  v_value   jsonb;
  v_total   int;
  v_sold    int;
  v_row     vd_tickets;
  i         int;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'invalid ticket quantity'; end if;

  select owner_id, value into v_owner, v_value
    from vd_entities
   where id = p_event_id and kind = 'supplier_events'
     for update;
  if not found then raise exception 'event not found'; end if;

  -- The payment webhook (service role), or a signed-in caller who owns the
  -- event, manages bookings for its owner, or is staff. Never anonymous.
  if not (
    coalesce(auth.role() = 'service_role', false)
    or (auth.uid() is not null
        and (v_owner = auth.uid() or is_admin() or has_supplier_permission(v_owner, 'manage_bookings')))
  ) then
    raise exception 'not authorized to issue tickets for this event';
  end if;

  v_total := (v_value #>> array['capacity', p_session_id, p_ticket_type_id, 'total'])::int;
  if v_total is null then raise exception 'session or ticket type not found'; end if;
  v_sold := coalesce((v_value #>> array['capacity', p_session_id, p_ticket_type_id, 'sold'])::int, 0);

  if v_sold + p_qty > v_total then
    raise exception 'Not enough tickets remaining for this session.';
  end if;

  update vd_entities
     set value = jsonb_set(
                   value,
                   array['capacity', p_session_id, p_ticket_type_id, 'sold'],
                   to_jsonb(v_sold + p_qty),
                   true
                 ),
         updated_at = now()
   where id = p_event_id;

  for i in 1..p_qty loop
    insert into vd_tickets (
      event_id, session_id, ticket_type_id, supplier_id,
      booking_id, order_id, order_line_id, code, token, status
    ) values (
      p_event_id, p_session_id, p_ticket_type_id, v_owner,
      p_booking_id, p_order_id, p_order_line_id,
      'TIX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      replace(gen_random_uuid()::text, '-', ''),
      'issued'
    ) returning * into v_row;
    return next v_row;
  end loop;
  return;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. vd_issue_activity_tickets — one boarding ticket per paid seat
-- ────────────────────────────────────────────────────────────────────────────
-- Payment webhook (service role) only. Idempotent per order line:
-- a retried webhook gets the tickets it already minted back instead of a
-- second set, which matters here because, unlike vd_issue_tickets, there is
-- no capacity counter to refuse the duplicate.
create or replace function public.vd_issue_activity_tickets(
  p_activity_id     text,
  p_slot_date       date,
  p_timeslot_id     text,
  p_qty             int,
  p_booking_id      text default null,
  p_order_id        text default null,
  p_order_line_id   text default null,
  p_pickup_point_id text default null
) returns setof vd_tickets
language plpgsql security definer set search_path = public as $$
declare
  v_owner    uuid;
  v_value    jsonb;
  v_slot     jsonb;
  v_pickup   jsonb;
  v_time     text;
  v_pk_label text;
  v_pk_time  text;
  v_offset   int;
  v_holder   text;
  v_row      vd_tickets;
  i          int;
begin
  if not coalesce(auth.role() = 'service_role', false) then
    raise exception 'not authorized to issue day-tour tickets';
  end if;
  if p_qty is null or p_qty <= 0 or p_qty > 60 then raise exception 'invalid ticket quantity'; end if;

  if p_order_line_id is not null
     and exists (select 1 from vd_tickets where order_line_id = p_order_line_id) then
    return query select * from vd_tickets where order_line_id = p_order_line_id order by created_at;
    return;
  end if;

  select owner_id, value into v_owner, v_value
    from vd_entities where id = p_activity_id and kind = 'activity';
  if not found then raise exception 'activity not found'; end if;

  select s into v_slot
    from jsonb_array_elements(coalesce(v_value->'timeslots', '[]'::jsonb)) s
   where s->>'id' = p_timeslot_id
   limit 1;
  if v_slot is null then raise exception 'departure not found on this activity'; end if;
  v_time := v_slot->>'time';

  -- The pickup point is resolved from the listing, never trusted from the
  -- cart: its label and time are what the operator's manifest groups by.
  if coalesce(p_pickup_point_id, '') <> '' then
    select p into v_pickup
      from jsonb_array_elements(coalesce(v_value#>'{grandTour,pickupPoints}', '[]'::jsonb)) p
     where p->>'id' = p_pickup_point_id
     limit 1;
    if v_pickup is not null then
      v_pk_label := v_pickup->>'name';
      v_offset := coalesce(nullif(v_pickup->>'minutesBefore', '')::int, 0);
      if v_time ~ '^\d{1,2}:\d{2}$' then
        v_pk_time := to_char(v_time::time - make_interval(mins => v_offset), 'HH24:MI');
      end if;
    end if;
  end if;

  if p_booking_id is not null then
    select value->>'customerName' into v_holder from vd_bookings where id = p_booking_id;
  end if;

  for i in 1..p_qty loop
    insert into vd_tickets (
      activity_id, slot_date, timeslot_id, departure_time,
      pickup_point_id, pickup_label, pickup_time, holder_name,
      supplier_id, booking_id, order_id, order_line_id, code, token, status
    ) values (
      p_activity_id, p_slot_date, p_timeslot_id, v_time,
      case when v_pickup is null then null else p_pickup_point_id end, v_pk_label, v_pk_time, v_holder,
      v_owner, p_booking_id, p_order_id, p_order_line_id,
      'TIX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      replace(gen_random_uuid()::text, '-', ''),
      'issued'
    ) returning * into v_row;
    return next v_row;
  end loop;
  return;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. vd_release_tickets — authorized, and capacity only for event tickets
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_release_tickets(p_booking_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking vd_bookings%rowtype;
  v_ticket  record;
begin
  select * into v_booking from vd_bookings where id = p_booking_id;
  if not found then return; end if;

  -- The guest, staff, a supplier on the booking, or the service role.
  if not (
    coalesce(auth.role() = 'service_role', false)
    or (auth.uid() is not null and (
          v_booking.user_id = auth.uid()
          or is_ops()
          or auth.uid() = any (coalesce(v_booking.supplier_ids, array[]::uuid[]))))
  ) then
    raise exception 'not allowed to release this booking''s tickets';
  end if;

  for v_ticket in
    select * from vd_tickets where booking_id = p_booking_id and status = 'issued' for update
  loop
    update vd_tickets set status = 'void' where id = v_ticket.id;

    -- Day-tour seats come back through the booking's inventory holds
    -- (vd_release_booking_inventory); only an event ticket owns capacity.
    if v_ticket.event_id is not null then
      update vd_entities
         set value = jsonb_set(
                       value,
                       array['capacity', v_ticket.session_id, v_ticket.ticket_type_id, 'sold'],
                       to_jsonb(greatest(
                         coalesce((value #>> array['capacity', v_ticket.session_id, v_ticket.ticket_type_id, 'sold'])::int, 0) - 1,
                         0
                       )),
                       true
                     ),
             updated_at = now()
       where id = v_ticket.event_id;
    end if;
  end loop;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. vd_redeem_ticket — day-tour tickets board on their own day only
-- ────────────────────────────────────────────────────────────────────────────
-- Every outcome past the token check returns the ticket, so the scanner can
-- show who and which pickup it is even when it refuses to board them.
create or replace function public.vd_redeem_ticket(
  p_ticket_id uuid,
  p_token     text,
  p_via       text default 'scan'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ticket vd_tickets;
  v_today  date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into v_ticket from vd_tickets where id = p_ticket_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if not (v_ticket.supplier_id = auth.uid() or is_admin()
          or has_supplier_permission(v_ticket.supplier_id, 'manage_bookings')) then
    raise exception 'not authorized to redeem this ticket';
  end if;

  if v_ticket.token <> p_token then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  if v_ticket.status = 'void' then
    return jsonb_build_object('ok', false, 'reason', 'void', 'ticket', to_jsonb(v_ticket));
  end if;

  if v_ticket.status = 'redeemed' then
    return jsonb_build_object(
      'ok', false, 'reason', 'already_redeemed',
      'redeemed_at', v_ticket.redeemed_at,
      'redeemed_by', v_ticket.redeemed_by,
      'ticket', to_jsonb(v_ticket)
    );
  end if;

  if v_ticket.activity_id is not null and v_ticket.slot_date <> v_today then
    return jsonb_build_object(
      'ok', false, 'reason', 'wrong_date',
      'slot_date', v_ticket.slot_date,
      'ticket', to_jsonb(v_ticket)
    );
  end if;

  update vd_tickets
     set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid(),
         redeemed_via = case when p_via = 'manual' then 'manual' else 'scan' end
   where id = p_ticket_id
   returning * into v_ticket;

  return jsonb_build_object('ok', true, 'ticket', to_jsonb(v_ticket));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Grants — nothing here is for anonymous callers
-- ────────────────────────────────────────────────────────────────────────────
revoke execute on function public.vd_issue_tickets(text, text, text, int, text, text, text)                     from public, anon;
revoke execute on function public.vd_issue_activity_tickets(text, date, text, int, text, text, text, text)       from public, anon, authenticated;
revoke execute on function public.vd_release_tickets(text)                                                     from public, anon;
revoke execute on function public.vd_redeem_ticket(uuid, text, text)                                           from public, anon;

grant execute on function public.vd_issue_tickets(text, text, text, int, text, text, text)               to authenticated, service_role;
grant execute on function public.vd_issue_activity_tickets(text, date, text, int, text, text, text, text) to service_role;
grant execute on function public.vd_release_tickets(text)                                               to authenticated, service_role;
grant execute on function public.vd_redeem_ticket(uuid, text, text)                                     to authenticated;
