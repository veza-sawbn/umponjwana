-- ============================================================================
-- Activity timeslot capacity: atomic, capacity-checked booking of a
-- (date, timeslot) pair on an activity, mirroring vd_book_seats()/
-- vd_release_seats() for tour departures (20260704_secure_data_layer.sql).
--
-- Activities are a single evergreen vd_entities row (unlike departures,
-- which get one row per date), so per-slot booked counts live nested inside
-- that same row's value, under value.slotBookings["<date>:<timeslotId>"].
-- Capacity itself is read server-side from value.timeslots — never trust a
-- client-supplied capacity — and the row is locked with `for update` so
-- concurrent bookings on the same slot can't both succeed past capacity.
-- ============================================================================

create or replace function public.vd_book_activity_slot(
  p_activity_id text, p_slot_date date, p_timeslot_id text, p_seats int
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_value jsonb;
  v_capacity int;
  v_key text := p_slot_date::text || ':' || p_timeslot_id;
  v_booked int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_seats <= 0 then raise exception 'invalid seat count'; end if;

  select value into v_value
    from vd_entities
   where id = p_activity_id and kind = 'activity'
     for update;
  if not found then raise exception 'activity not found'; end if;

  select (t->>'capacity')::int into v_capacity
    from jsonb_array_elements(coalesce(v_value->'timeslots', '[]'::jsonb)) t
   where t->>'id' = p_timeslot_id;
  if v_capacity is null then raise exception 'timeslot not found'; end if;

  v_booked := coalesce((v_value #>> array['slotBookings', v_key])::int, 0);
  if v_booked + p_seats > v_capacity then
    raise exception 'This timeslot is fully booked for the selected date.';
  end if;

  update vd_entities
     set value = jsonb_set(
                   coalesce(value, '{}'::jsonb),
                   array['slotBookings', v_key],
                   to_jsonb(v_booked + p_seats),
                   true
                 ),
         updated_at = now()
   where id = p_activity_id;
end;
$$;
grant execute on function public.vd_book_activity_slot(text, date, text, int) to authenticated;

-- Release seats on cancellation (called by the booking owner / supplier).
create or replace function public.vd_release_activity_slot(
  p_activity_id text, p_slot_date date, p_timeslot_id text, p_seats int
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_value jsonb;
  v_key text := p_slot_date::text || ':' || p_timeslot_id;
  v_booked int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select value into v_value
    from vd_entities
   where id = p_activity_id and kind = 'activity'
     for update;
  if not found then return; end if;

  v_booked := coalesce((v_value #>> array['slotBookings', v_key])::int, 0);

  update vd_entities
     set value = jsonb_set(
                   coalesce(value, '{}'::jsonb),
                   array['slotBookings', v_key],
                   to_jsonb(greatest(v_booked - p_seats, 0)),
                   true
                 ),
         updated_at = now()
   where id = p_activity_id;
end;
$$;
grant execute on function public.vd_release_activity_slot(text, date, text, int) to authenticated;
