-- ============================================================================
-- Visit Drakensberg — Expire abandoned pending bookings
-- Run AFTER 20260802_checkout_pending_payment.sql.
--
-- Checkout now creates a booking as status='pending' and holds its room /
-- departure seats until iKhokha confirms payment (see that migration). If
-- the customer abandons payment, nothing previously freed that hold — the
-- room/seats stayed reserved forever. vd_expire_pending_bookings() cancels
-- any 'pending' booking older than a TTL (default 30 minutes) and releases
-- everything it was holding: the booking itself, its Master Order (via the
-- existing vd_cancel_order), its per-supplier orders, and any departure
-- seats its addons reserved.
--
-- This function only does the sweep — something has to call it on a
-- schedule. See app/api/cron/expire-pending-bookings/route.ts and the
-- `crons` entry in vercel.json. Vercel's free Hobby tier only runs cron
-- jobs once a day, not on the schedule configured there — on Hobby, expiry
-- latency is effectively "up to a day", not the TTL below. Pro (or an
-- external pinger hitting the route on a real schedule) is needed for the
-- TTL to actually mean what it says.
-- ============================================================================

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
    select id, value from vd_bookings where status = 'pending' and created_at < v_cutoff
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
