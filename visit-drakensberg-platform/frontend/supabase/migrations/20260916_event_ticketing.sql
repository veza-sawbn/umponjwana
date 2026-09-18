-- ============================================================================
-- Real event ticketing: sessions, ticket tiers, atomic capacity-checked
-- issuance, and scan-to-check-in.
--
-- The `events` entity (vd_entities, kind='supplier_events') previously
-- carried a single starts_at/ticket_price/total_tickets — a "ticket" was
-- just a generic checkout addon, tickets_sold was set once at creation and
-- never enforced, and there was no individual ticket record to scan or
-- check in. This migration adds:
--   1. Nested `sessions`/`ticketTypes`/`capacity` inside the existing event
--      row's jsonb value (mirrors activity timeslots' nested-capacity
--      approach in 20260829_activity_timeslots.sql), with a one-time
--      backfill of existing rows into a single default session/tier so
--      nothing already published goes dark.
--   2. `vd_tickets` — a dedicated table (not vd_entities: PII/transactional,
--      same reasoning as vd_departure_guests in 20260821_departure_guests.sql)
--      holding one row per issued ticket, scan/check-in state included.
--   3. Atomic, row-locked RPCs to issue, release and redeem tickets, the
--      same `for update`-locked style as vd_book_activity_slot()/
--      vd_release_activity_slot().
--   4. vd_canonical_unit_price()'s 'event' branch extended to price a
--      specific ticket tier (productId "<eventId>:<ticketTypeId>"), while
--      staying backward compatible with a plain event id.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Backfill existing events into the sessions/ticketTypes/capacity shape
-- ────────────────────────────────────────────────────────────────────────────
update vd_entities
   set value = value || jsonb_build_object(
     'sessions', jsonb_build_array(jsonb_build_object(
       'id', 'sess-default',
       'starts_at', value->>'starts_at',
       'ends_at', coalesce(nullif(value->>'ends_at', ''), value->>'starts_at'),
       'status', 'active'
     )),
     'ticketTypes', jsonb_build_array(jsonb_build_object(
       'id', 'tier-general',
       'name', 'General',
       'price', coalesce((value->>'ticket_price')::numeric, 0)
     )),
     'capacity', jsonb_build_object(
       'sess-default', jsonb_build_object(
         'tier-general', jsonb_build_object(
           'total', coalesce((value->>'total_tickets')::numeric, 0)::int,
           'sold', coalesce((value->>'tickets_sold')::numeric, 0)::int
         )
       )
     )
   )
 where kind = 'supplier_events'
   and not (value ? 'sessions');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_tickets — one row per issued ticket
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_tickets (
  id              uuid primary key default gen_random_uuid(),
  event_id        text not null references vd_entities(id) on delete cascade,
  session_id      text not null,
  ticket_type_id  text not null,
  -- Denormalized from the event row at issuance time — RLS and the
  -- check-in scanner key off this, not a join, same as vd_bookings'
  -- supplier_ids[].
  supplier_id     uuid references auth.users(id) on delete cascade,
  booking_id      text references vd_bookings(id) on delete set null,
  order_id        text references vd_orders(id) on delete set null,
  order_line_id   text references vd_order_lines(id) on delete set null,
  -- Human-readable code for the manual check-in fallback; token is the
  -- secret embedded in the QR alongside id so a ticket can't be guessed
  -- from its (non-secret) id/code alone.
  code            text not null unique,
  token           text not null,
  status          text not null default 'issued' check (status in ('issued', 'redeemed', 'void')),
  redeemed_at     timestamptz,
  redeemed_by     uuid references auth.users(id),
  redeemed_via    text check (redeemed_via in ('scan', 'manual')),
  created_at      timestamptz not null default now()
);
create index if not exists vd_tickets_event_session_idx on vd_tickets (event_id, session_id);
create index if not exists vd_tickets_booking_idx        on vd_tickets (booking_id);
create index if not exists vd_tickets_supplier_status_idx on vd_tickets (supplier_id, status);

alter table vd_tickets enable row level security;

drop policy if exists "Buyers read own tickets"            on vd_tickets;
drop policy if exists "Suppliers read own event tickets"   on vd_tickets;
drop policy if exists "Managed ops agents read event tickets" on vd_tickets;
drop policy if exists "Admins manage event tickets"         on vd_tickets;

-- No public/anon policy at all — a ticket carries a redeemable secret and
-- links back to a booking, same posture as vd_departure_guests.
create policy "Buyers read own tickets" on vd_tickets
  for select using (
    booking_id is not null
    and booking_id in (select id from vd_bookings where user_id = auth.uid())
  );

create policy "Suppliers read own event tickets" on vd_tickets
  for select using (supplier_id = auth.uid());

create policy "Managed ops agents read event tickets" on vd_tickets
  for select using (
    supplier_id is not null
    and has_supplier_permission(supplier_id, 'view_bookings')
  );

-- Writes (issue/release/redeem) always go through the SECURITY DEFINER RPCs
-- below, which run as the function owner and so bypass RLS by design — the
-- only direct-table grant beyond that is admin, for support fixups.
create policy "Admins manage event tickets" on vd_tickets
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 3. vd_issue_tickets — atomic, capacity-checked ticket minting
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

  -- auth.uid() is null for the service-role payment webhook, which is
  -- always allowed; a signed-in caller must own the event, be delegated
  -- manage_bookings on it, or be an admin — mirrors the manual-guest
  -- authorization in addManualGuest()/vd_book_seats.
  if auth.uid() is not null
     and not (v_owner = auth.uid() or is_admin() or has_supplier_permission(v_owner, 'manage_bookings')) then
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
grant execute on function public.vd_issue_tickets(text, text, text, int, text, text, text) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. vd_release_tickets — void every issued (unredeemed) ticket for a
--    cancelled booking and free their capacity back on the event
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_release_tickets(p_booking_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ticket record;
begin
  for v_ticket in
    select * from vd_tickets where booking_id = p_booking_id and status = 'issued'
  loop
    update vd_tickets set status = 'void' where id = v_ticket.id;

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
  end loop;
end;
$$;
grant execute on function public.vd_release_tickets(text) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. vd_redeem_ticket — scan/manual check-in, idempotent
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_redeem_ticket(
  p_ticket_id uuid,
  p_token     text,
  p_via       text default 'scan'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ticket vd_tickets;
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
    return jsonb_build_object('ok', false, 'reason', 'void');
  end if;

  if v_ticket.status = 'redeemed' then
    return jsonb_build_object(
      'ok', false, 'reason', 'already_redeemed',
      'redeemed_at', v_ticket.redeemed_at,
      'redeemed_by', v_ticket.redeemed_by
    );
  end if;

  update vd_tickets
     set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid(),
         redeemed_via = coalesce(nullif(p_via, ''), 'scan')
   where id = p_ticket_id
   returning * into v_ticket;

  return jsonb_build_object('ok', true, 'ticket', to_jsonb(v_ticket));
end;
$$;
grant execute on function public.vd_redeem_ticket(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. vd_canonical_unit_price — price a specific ticket tier
--    (productId "<eventId>:<ticketTypeId>"), falling back to the legacy
--    flat ticket_price for a plain event id so old order lines keep pricing.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_canonical_unit_price(
  p_category text, p_product_id text, p_room_id text default null
) returns numeric language sql stable security definer set search_path = public as $$
  select case coalesce(p_category, '')
    when 'accommodation' then
      (select (value->>'basePrice')::numeric from vd_entities where id = p_room_id and kind = 'room')
    when 'activity' then
      (select (value->>'pricePerPerson')::numeric from vd_entities where id = p_product_id and kind = 'activity')
    when 'hike' then
      (select (value->>'pricePerPerson')::numeric from vd_entities where id = p_product_id and kind = 'departure')
    when 'tour' then
      (select (value->>'pricePerPerson')::numeric from vd_entities where id = p_product_id and kind = 'departure')
    when 'event' then
      coalesce(
        (
          select (tt->>'price')::numeric
            from vd_entities e,
                 jsonb_array_elements(coalesce(e.value->'ticketTypes', '[]'::jsonb)) tt
           where e.kind = 'supplier_events'
             and e.id = split_part(p_product_id, ':', 1)
             and tt->>'id' = split_part(p_product_id, ':', 2)
           limit 1
        ),
        (select (value->>'ticket_price')::numeric from vd_entities where id = p_product_id and kind = 'supplier_events')
      )
    else null
  end
$$;
grant execute on function public.vd_canonical_unit_price(text, text, text) to authenticated;
