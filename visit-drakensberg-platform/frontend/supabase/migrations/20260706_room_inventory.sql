-- ============================================================================
-- Visit Drakensberg — Room Inventory Enforcement
-- Run AFTER 20260705_booking_orders.sql.
--
-- Rooms have a `units` count (how many identical units of that room type a
-- property has), but nothing enforced it — the same room could be booked
-- without limit for overlapping dates. This migration adds:
--
--   vd_room_units_left(room_id, check_in, check_out) → int
--     How many units of a room remain free for a date range. Used by the
--     stay page to show "2 left" / "Sold out" per room. Callable by anon
--     (browsing happens logged out); exposes only a count.
--
--   vd_create_booking(id, reference, supplier_ids, status, value) → void
--     Atomic booking creation: takes an advisory lock on the room, checks
--     remaining units and supplier availability blocks, then inserts the
--     booking — all in one transaction, so two simultaneous checkouts can
--     never oversell the last unit. The frontend now books through this
--     instead of inserting into vd_bookings directly.
--
-- Cancellations free inventory automatically:
--   - visitor cancels  → vd_bookings.status = 'cancelled' (excluded from count)
--   - supplier cancels their stay order → the cancelled order excludes the
--     parent booking from the count (see NOT EXISTS below)
-- ============================================================================

-- How many overlapping, still-active bookings hold this room for the range.
create or replace function public.vd_room_booked_count(
  p_room_id text, p_check_in text, p_check_out text
) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from vd_bookings b
  where b.status = 'confirmed'
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

create or replace function public.vd_room_units_left(
  p_room_id text, p_check_in text, p_check_out text
) returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_units int;
begin
  select coalesce((value->>'units')::int, 1) into v_units
    from vd_entities where id = p_room_id and kind = 'room';
  if not found then return 0; end if;
  return greatest(0, v_units - vd_room_booked_count(p_room_id, p_check_in, p_check_out));
end;
$$;
grant execute on function public.vd_room_units_left(text, text, text) to anon, authenticated;
grant execute on function public.vd_room_booked_count(text, text, text) to anon, authenticated;

-- Atomic, capacity-checked booking creation.
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
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  v_room_id     := p_value->'stay'->>'roomId';
  v_property_id := p_value->'stay'->>'id';
  v_check_in    := p_value->>'checkIn';
  v_check_out   := p_value->>'checkOut';

  if v_property_id like 'prop-%' and v_check_in is not null and v_check_out is not null then
    -- Supplier-blocked dates on the property apply regardless of room.
    if exists (
      select 1 from vd_entities e
      where e.kind = 'supplier_availability_blocks'
        and e.value->>'listingId' = v_property_id
        and e.value->>'from' <  v_check_out
        and e.value->>'to'   >= v_check_in
    ) then
      raise exception 'property unavailable for these dates';
    end if;

    if v_room_id is not null then
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
  values (p_id, p_reference, auth.uid(), coalesce(p_supplier_ids, '{}'), coalesce(p_status, 'confirmed'), p_value);
end;
$$;
grant execute on function public.vd_create_booking(text, text, uuid[], text, jsonb) to authenticated;
