-- ============================================================================
-- Visit Drakensberg — Request-to-Book stays
-- Run AFTER 20260901_trip_requests_managed_supplier_access.sql.
--
-- Some properties cannot take instant bookings: the operator holds the real
-- availability (own channels, phone bookings, seasonal staffing) and must
-- confirm the dates before a guest is charged. Those properties are switched
-- to bookingMode='request' (ops/admin only, on /admin/listings), and their
-- bookings follow the tour trip-request shape instead of the instant one:
--
--   requested → (operator approves) → pending → (guest pays) → confirmed
--            └→ (operator declines) → declined
--            └→ (nobody answers)    → expired
--
-- A 'requested' booking is not a sale: it holds no inventory, has no Master
-- Order, no invoice and no ledger entries, and dispatches no transport. All
-- of that comes into existence only once the operator has confirmed the
-- dates, exactly like an accepted custom-trip quote.
--
-- Three things this also settles:
--
--  1. Inventory holds. vd_room_booked_count only ever counted 'confirmed'
--     bookings, so a 'pending' (unpaid) booking held nothing and the last
--     unit could be sold twice — even though 20260706's header, and
--     20260803's, both describe pending bookings as holding their room.
--     Counting 'pending' is safe precisely because 20260803 sweeps abandoned
--     ones; this migration makes the code match the documented intent.
--
--  2. Per-booking payment deadlines. An approved request holds the room for
--     a window sized to how close the stay is: 24h when check-in is 7+ days
--     out, 12h when it is 6 days or less (a room three days out cannot sit
--     reserved overnight for someone who may never pay). The flat 30-minute
--     abandoned-checkout TTL still applies to instant bookings, which carry
--     no deadline of their own.
--
--  3. vd_booking_orders never got the "Managed ops agents" policies that
--     20260811_delegated_management.sql gave every other supplier-facing
--     table. A VD Operations employee acting for a managed supplier could
--     not see that supplier's orders at all — and since approving a stay
--     request happens on the supplier's own order row, the feature would
--     have been dead on arrival for exactly the managed properties it is
--     aimed at. Same gap class as 20260901's, different table.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Per-booking inventory hold
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_bookings add column if not exists hold_expires_at timestamptz;

comment on column vd_bookings.hold_expires_at is
  'When this booking''s inventory hold lapses. Set when an operator approves a '
  'request-to-book stay (see vd_decide_stay_request); null on an instant '
  'booking, which the flat abandoned-checkout TTL covers instead.';

-- How long an approved request has to be paid, from now.
--   check-in 7+ days away → 24 hours
--   check-in 6 days or less → 12 hours
-- Never runs past check-in itself, and never lands less than an hour out.
create or replace function public.vd_stay_payment_deadline(p_check_in text)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_check_in date := vd_safe_date(p_check_in);
  v_deadline timestamptz;
begin
  if v_check_in is null or (v_check_in - current_date) >= 7 then
    v_deadline := now() + interval '24 hours';
  else
    v_deadline := now() + interval '12 hours';
  end if;

  -- A window that outlives the stay itself would hold a room the guest can
  -- no longer arrive for.
  if v_check_in is not null and v_deadline > v_check_in::timestamptz then
    v_deadline := greatest(now() + interval '1 hour', v_check_in::timestamptz);
  end if;

  return v_deadline;
end;
$$;
grant execute on function public.vd_stay_payment_deadline(text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Inventory: a pending booking holds its room; a requested one does not
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_room_booked_count(
  p_room_id text, p_check_in text, p_check_out text
) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from vd_bookings b
  -- 'pending' means paid-for-or-being-paid-for: checkout holds the room
  -- until iKhokha confirms (20260802), and an approved stay request holds it
  -- until its deadline. Both are released by vd_expire_pending_bookings().
  -- 'requested' deliberately holds nothing: the operator has not agreed to
  -- the dates yet, so a request must never make a room look sold out.
  where b.status in ('confirmed', 'pending')
    and b.value->'stay'->>'roomId' = p_room_id
    and coalesce(b.value->>'checkIn', '')  < p_check_out
    and coalesce(b.value->>'checkOut', '') > p_check_in
    -- A stay order cancelled by the supplier frees the room even though the
    -- rest of the visitor's booking stays confirmed.
    and not exists (
      select 1 from vd_booking_orders o
      where o.booking_id = b.id
        and o.status = 'cancelled'
        and exists (
          select 1 from jsonb_array_elements(coalesce(o.value->'items', '[]'::jsonb)) i
          where i->>'type' = 'stay'
        )
    )
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Booking creation: allow 'requested', and don't capacity-check it
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_create_booking(
  p_id text,
  p_reference text,
  p_supplier_ids uuid[],
  p_status text,
  p_value jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_room_id text;
  v_property_id text;
  v_check_in text;
  v_check_out text;
  v_units int;
  v_status text := coalesce(p_status, 'confirmed');
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  v_room_id     := p_value->'stay'->>'roomId';
  v_property_id := p_value->'stay'->>'id';
  v_check_in    := p_value->>'checkIn';
  v_check_out   := p_value->>'checkOut';

  if v_property_id like 'prop-%' and v_check_in is not null and v_check_out is not null then
    -- Supplier-blocked dates on the property apply regardless of room, and
    -- apply to a request too: there is no point asking an operator about
    -- dates they have already declared themselves unavailable for.
    if exists (
      select 1 from vd_entities e
      where e.kind = 'supplier_availability_blocks'
        and e.value->>'listingId' = v_property_id
        and e.value->>'from' <  v_check_out
        and e.value->>'to'   >= v_check_in
    ) then
      raise exception 'property unavailable for these dates';
    end if;

    -- Capacity is only enforced for a booking that actually takes the room.
    -- A 'requested' booking is a question, not a claim: several guests may
    -- ask about the last unit, and the operator decides who gets it.
    if v_room_id is not null and v_status <> 'requested' then
      -- Serialise bookings of the same room so the capacity check + insert
      -- are race-free; the lock releases at transaction end.
      perform pg_advisory_xact_lock(hashtext(v_room_id));

      select coalesce((value->>'units')::int, 1) into v_units
        from vd_entities where id = v_room_id and kind = 'room';
      if not found then raise exception 'room not found'; end if;

      if vd_room_booked_count(v_room_id, v_check_in, v_check_out) >= v_units then
        raise exception 'room sold out for these dates';
      end if;
    end if;
  end if;

  insert into vd_bookings (id, reference, user_id, supplier_ids, status, value)
  values (p_id, p_reference, auth.uid(), coalesce(p_supplier_ids, '{}'), v_status, p_value);
end;
$$;
grant execute on function public.vd_create_booking(text, text, uuid[], text, jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. The operator's decision
--
-- Runs as the property's operator (or a VD Operations employee managing them,
-- or an admin). SECURITY DEFINER because the decision has to touch the parent
-- vd_bookings row, which suppliers deliberately cannot read or write since
-- 20260705 — they see only their own vd_booking_orders slice. Authorisation
-- is therefore checked against the stay order they own, not the booking.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_decide_stay_request(
  p_booking_id text,
  p_approve    boolean,
  p_reason     text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_supplier uuid;
  v_booking record;
  v_room_id text;
  v_check_in text;
  v_check_out text;
  v_units int;
  v_deadline timestamptz;
  v_value jsonb;
  v_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  -- The stay order on this booking identifies the property's operator.
  select o.supplier_id into v_supplier
    from vd_booking_orders o
   where o.booking_id = p_booking_id
     and exists (
       select 1 from jsonb_array_elements(coalesce(o.value->'items', '[]'::jsonb)) i
       where i->>'type' = 'stay'
     )
   limit 1;

  if v_supplier is null then
    raise exception 'no stay on this booking to decide on';
  end if;

  if not (
    v_supplier = auth.uid()
    or has_supplier_permission(v_supplier, 'manage_bookings')
    or is_admin()
  ) then
    raise exception 'not authorised to decide this request';
  end if;

  select * into v_booking from vd_bookings where id = p_booking_id;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'requested' then
    raise exception 'this request has already been % ', v_booking.status;
  end if;

  v_value     := coalesce(v_booking.value, '{}'::jsonb);
  v_room_id   := v_value->'stay'->>'roomId';
  v_check_in  := v_value->>'checkIn';
  v_check_out := v_value->>'checkOut';

  if not p_approve then
    v_status := 'declined';
    v_value := v_value || jsonb_build_object(
      'status', v_status,
      'declineReason', coalesce(nullif(p_reason, ''), 'The property cannot accommodate these dates.')
    );
    update vd_bookings set status = v_status, value = v_value, hold_expires_at = null
      where id = p_booking_id and status = 'requested';
    update vd_booking_orders set status = v_status where booking_id = p_booking_id;

    insert into vd_notifications (user_id, type, title, body, link) values (
      v_booking.user_id, 'info',
      'Stay request declined — ' || v_booking.reference,
      coalesce(nullif(p_reason, ''), 'The property cannot accommodate your dates.') ||
        ' You have not been charged.',
      '/checkout/success?id=' || p_booking_id
    );

    return jsonb_build_object('status', v_status, 'holdExpiresAt', null);
  end if;

  -- Approving takes the room for real, so it goes through the same capacity
  -- gate an instant booking does — the operator may have taken the last unit
  -- elsewhere since the guest asked.
  if v_room_id is not null then
    perform pg_advisory_xact_lock(hashtext(v_room_id));
    select coalesce((value->>'units')::int, 1) into v_units
      from vd_entities where id = v_room_id and kind = 'room';
    if not found then raise exception 'room not found'; end if;
    if vd_room_booked_count(v_room_id, v_check_in, v_check_out) >= v_units then
      raise exception 'room sold out for these dates';
    end if;
  end if;

  v_deadline := vd_stay_payment_deadline(v_check_in);
  v_status   := 'pending';
  v_value    := v_value || jsonb_build_object(
    'status', v_status,
    'holdExpiresAt', to_char(v_deadline at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update vd_bookings
     set status = v_status, value = v_value, hold_expires_at = v_deadline
   where id = p_booking_id and status = 'requested';
  update vd_booking_orders set status = v_status where booking_id = p_booking_id;

  insert into vd_notifications (user_id, type, title, body, link) values (
    v_booking.user_id, 'approval',
    'Dates confirmed — ' || v_booking.reference,
    'The property confirmed your dates and is holding your room. Pay by ' ||
      to_char(v_deadline at time zone 'UTC', 'DD Mon HH24:MI') || ' UTC to confirm your booking.',
    '/checkout/success?id=' || p_booking_id
  );

  return jsonb_build_object(
    'status', v_status,
    'holdExpiresAt', to_char(v_deadline at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$$;
grant execute on function public.vd_decide_stay_request(text, boolean, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Expiry
--
-- 5a. The existing abandoned-checkout sweep now honours a per-booking
--     deadline where one exists, so an approved request keeps its room for
--     its full 24h/12h window instead of being swept at the flat 30-minute
--     TTL meant for abandoned carts.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_expire_pending_bookings(p_older_than_minutes int default 30)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := now() - (p_older_than_minutes || ' minutes')::interval;
  v_booking record;
  v_order record;
  v_addon jsonb;
  v_count int := 0;
begin
  for v_booking in
    select id, value from vd_bookings
     where status = 'pending'
       and case
             -- An approved stay request holds its room until its own
             -- deadline, however long ago the guest first asked.
             when hold_expires_at is not null then hold_expires_at < now()
             else created_at < v_cutoff
           end
  loop
    -- Guarded update: if the webhook confirmed this booking in the moment
    -- between the select above and here, this matches zero rows and we skip
    -- it entirely rather than cancelling a booking that just got paid.
    update vd_bookings set status = 'cancelled' where id = v_booking.id and status = 'pending';
    if not found then continue; end if;

    update vd_booking_orders set status = 'cancelled' where booking_id = v_booking.id;

    for v_order in select id from vd_orders where booking_id = v_booking.id loop
      perform vd_cancel_order(v_order.id);
    end loop;

    for v_addon in select * from jsonb_array_elements(coalesce(v_booking.value->'addons', '[]'::jsonb)) loop
      if exists (select 1 from vd_entities where id = v_addon->>'id' and kind = 'departure') then
        perform vd_release_seats(v_addon->>'id', coalesce((v_addon->>'guests')::int, 1));
      end if;
    end loop;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 5b. Requests nobody answered. A request holds no inventory, so this is
--     about not leaving a guest waiting indefinitely on an operator who is
--     never going to reply.
create or replace function public.vd_expire_stay_requests(p_older_than_hours int default 72)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := now() - (p_older_than_hours || ' hours')::interval;
  v_booking record;
  v_count int := 0;
begin
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'admin or service role only';
  end if;

  for v_booking in
    select id, reference, user_id, supplier_ids, value
      from vd_bookings
     where status = 'requested' and created_at < v_cutoff
  loop
    update vd_bookings
       set status = 'expired',
           value  = coalesce(value, '{}'::jsonb) || jsonb_build_object('status', 'expired')
     where id = v_booking.id and status = 'requested';
    if not found then continue; end if;

    update vd_booking_orders set status = 'expired' where booking_id = v_booking.id;

    insert into vd_notifications (user_id, type, title, body, link) values (
      v_booking.user_id, 'info',
      'Stay request expired — ' || v_booking.reference,
      'The property did not confirm your dates in time, so your request has expired. '
        || 'You were not charged — you are welcome to try different dates or another stay.',
      '/account'
    );

    insert into vd_notifications (user_id, type, title, body, link)
    select sid, 'info',
      'Request expired — ' || v_booking.reference,
      'A stay request you did not answer has expired and the guest has been told.',
      '/supplier/bookings'
    from unnest(coalesce(v_booking.supplier_ids, '{}'::uuid[])) as sid;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. vd_booking_orders: the missing managed-supplier policies
--    Mirrors what 20260811 gave vd_order_lines. Without these, a VD
--    Operations employee sees none of their managed supplier's orders — so
--    they could neither read nor decide that supplier's stay requests.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Managed ops agents read booking orders"   on vd_booking_orders;
drop policy if exists "Managed ops agents update booking orders" on vd_booking_orders;

create policy "Managed ops agents read booking orders" on vd_booking_orders
  for select using (
    is_managed_supplier(supplier_id)
    and has_supplier_permission(supplier_id, 'view_bookings')
  );

create policy "Managed ops agents update booking orders" on vd_booking_orders
  for update using (
    has_supplier_permission(supplier_id, 'manage_bookings')
  );
