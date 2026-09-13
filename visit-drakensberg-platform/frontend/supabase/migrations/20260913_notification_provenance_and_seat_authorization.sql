-- ============================================================================
-- Visit Drakensberg — Notification provenance, and seat releases you may make
--
-- Run AFTER 20260913_payment_authorization_and_idempotency.sql.
--
-- Two more findings from the September 2026 security audit.
--
-- ────────────────────────────────────────────────────────────────────────────
-- H5 — anyone signed in could send an arbitrary email from us, to anyone
-- ────────────────────────────────────────────────────────────────────────────
-- vd_notifications has always accepted an insert from any signed-in user for
-- any recipient:
--
--   create policy "Authenticated create notifications" on vd_notifications
--     for insert with check (auth.uid() is not null);
--
-- That is deliberate and load-bearing — notify() in lib/notifications.ts is
-- how a customer's booking reaches their supplier, how a supplier's
-- cancellation reaches the customer, and how staff reach both. A strict
-- relationship graph would break every one of those flows.
--
-- The damage was not the row. It was /api/notifications/email, which took the
-- title, body and link straight from the request and mailed them from
-- noreply@visitdrakensberg.com — SPF and DKIM passing, sender trusted:
--
--   POST /api/notifications/email
--   {"userId":"<any user>","title":"Your payment failed — update your card",
--    "body":"…","link":"/account/billing"}
--
-- High-credibility phishing from us, to our own customers, at whatever volume
-- the attacker liked (finding H1: no rate limiting).
--
-- This migration takes away the two things that made that work:
--
--   1. PROVENANCE. Every notification now records who created it, stamped by a
--      trigger from auth.uid() rather than accepted from the caller. The email
--      route (changed in the same commit) no longer takes text from the
--      request at all — it takes a notification id, reads the stored row, and
--      will only mail a row the caller actually created. So the email can
--      never say something different from what is recorded and auditable.
--
--   2. VOLUME. A cap on how many notifications one account may create for
--      OTHER people per hour. Legitimate flows raise one to a handful — a
--      booking notifies its suppliers, a cancellation notifies both sides. The
--      cap sits far above that and far below "mail the customer base". Notices
--      to yourself are never counted, and staff and the service role are
--      exempt: a campaign send or a bulk approval is their job.
--
-- ────────────────────────────────────────────────────────────────────────────
-- H4 — seat inventory was writable against any departure, by anyone
-- ────────────────────────────────────────────────────────────────────────────
-- vd_release_seats (20260704_secure_data_layer.sql) checked only that the
-- caller was signed in, then decremented bookedSeats on whatever departure id
-- it was handed:
--
--   if auth.uid() is null then raise exception 'authentication required'; end if;
--   -- …no check that the caller owns the departure or holds a booking on it
--
-- So any signed-in user could walk an operator's departures decrementing seat
-- counts. The departure then shows capacity it does not have, the next
-- checkout's capacity test passes, and guests arrive for a tour with no room.
-- Releasing seats somebody else holds is never a legitimate action, so this is
-- now scoped: the departure's owner, a platform/finance/ops staff member, or a
-- caller who actually holds a non-cancelled booking on that departure.
--
-- vd_book_seats is a different shape and stays open to authenticated callers —
-- /checkout genuinely reserves seats before the booking row exists, so
-- requiring a booking would break the only legitimate path. What it gains is a
-- ceiling on a single call and an audit trail, so an attempt to exhaust a
-- departure in one shot fails and a slow one is visible. Tying a seat hold to
-- a booking row with a TTL is the real answer and is tracked as follow-up in
-- docs/security/SECURITY_AUDIT_2026-09.md — it is an architectural change, not
-- a patch, and does not belong in a security fix branch.
-- ============================================================================
-- @rollback: additive — new column, trigger and functions; old code ignores all three

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Notification provenance
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_notifications add column if not exists created_by uuid;

create index if not exists vd_notifications_created_by_idx
  on vd_notifications (created_by, created_at desc);

/**
 * How many notifications one account may raise for OTHER people per hour.
 * Well above what any real flow needs; well below a mailshot.
 */
create or replace function public.vd_notification_hourly_cap()
returns int language sql immutable as $$ select 60 $$;

create or replace function public.vd_stamp_notification_sender()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sender uuid := auth.uid();
  v_recent int;
begin
  -- Never taken from the caller: the whole point is that the row records who
  -- really raised it, not who says they did.
  new.created_by := v_sender;

  -- No user JWT (the service role, or an in-database caller) is exempt: those
  -- callers have already been authorised by the route that invoked them.
  if v_sender is null then
    return new;
  end if;

  -- Notifying yourself is free, and staff send in bulk as part of the job.
  if new.user_id = v_sender or is_ops() then
    return new;
  end if;

  select count(*) into v_recent
    from vd_notifications
   where created_by = v_sender
     and user_id <> v_sender
     and created_at > now() - interval '1 hour';

  if v_recent >= vd_notification_hourly_cap() then
    raise exception 'notification rate limit reached'
      using hint = 'One account may raise at most '
                   || vd_notification_hourly_cap()
                   || ' notifications for other people per hour.';
  end if;

  return new;
end;
$$;

drop trigger if exists vd_stamp_notification_sender on vd_notifications;
create trigger vd_stamp_notification_sender
  before insert on vd_notifications
  for each row execute function public.vd_stamp_notification_sender();

/**
 * What /api/notifications/email is allowed to send.
 *
 * Returns the stored row — never anything the caller supplied — and only when
 * the caller created it (or is staff, or is the service role). The recipient's
 * email address is NOT returned: the route looks that up with the service
 * client, so a caller still cannot use this to read anyone's address.
 */
create or replace function public.vd_notification_for_email(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_row vd_notifications%rowtype;
begin
  if p_id is null then return null; end if;

  select * into v_row from vd_notifications where id = p_id;
  if not found then return null; end if;

  if auth.uid() is not null
     and v_row.created_by is distinct from auth.uid()
     and not is_ops() then
    return null;
  end if;

  return jsonb_build_object(
    'id',      v_row.id,
    'user_id', v_row.user_id,
    'type',    v_row.type,
    'title',   v_row.title,
    'body',    v_row.body,
    'link',    v_row.link
  );
end;
$$;

grant execute on function public.vd_notification_hourly_cap()      to anon, authenticated;
grant execute on function public.vd_notification_for_email(uuid)   to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Releasing seats you actually hold
-- ────────────────────────────────────────────────────────────────────────────

/** May the current caller give seats back on this departure? */
create or replace function public.vd_may_release_seats(p_departure_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  -- No user JWT: the service role, or an in-database caller such as the
  -- pending-booking sweep. Already authorised by whatever invoked it.
  if auth.uid() is null then return true; end if;

  -- Staff run cancellations and corrections on anyone's departure.
  if is_ops() then return true; end if;

  select owner_id into v_owner from vd_entities
   where id = p_departure_id and kind = 'departure';
  if v_owner is null then return false; end if;

  -- The operator running the departure, or an ops employee managing them.
  if v_owner = auth.uid() then return true; end if;
  if has_supplier_permission(v_owner, 'manage_bookings') then return true; end if;

  -- A guest giving back seats they hold. vd_bookings.supplier_ids carries the
  -- departure's owner and the addon ids live in value->'addons'; matching on
  -- the departure id inside the booking's own value is what ties the caller to
  -- these particular seats.
  return exists (
    select 1 from vd_bookings b
     where b.user_id = auth.uid()
       and b.status <> 'cancelled'
       and b.value::text like '%' || p_departure_id || '%'
  );
end;
$$;

create or replace function public.vd_release_seats(p_departure_id text, p_seats int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booked int;
begin
  if auth.uid() is null and coalesce(auth.role(), '') = '' then
    -- Keep the original behaviour for a browser with no session at all.
    raise exception 'authentication required';
  end if;

  if not vd_may_release_seats(p_departure_id) then
    raise exception 'not allowed to release seats on this departure';
  end if;

  if p_seats is null or p_seats <= 0 then raise exception 'invalid seat count'; end if;

  select coalesce((value->>'bookedSeats')::int, 0) into v_booked
    from vd_entities where id = p_departure_id and kind = 'departure' for update;
  if not found then return; end if;

  update vd_entities
     set value = value
                 || jsonb_build_object('bookedSeats', greatest(0, v_booked - p_seats))
                 || case when status = 'full' then jsonb_build_object('status', 'open') else '{}'::jsonb end,
         status = case when status = 'full' then 'open' else status end,
         updated_at = now()
   where id = p_departure_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. A ceiling on one booking call, and a trail
--
--    Unchanged from 20260704 apart from the seat ceiling and the audit line:
--    /checkout reserves before the booking row exists, so a booking cannot be
--    required here without breaking the one legitimate caller.
-- ────────────────────────────────────────────────────────────────────────────

/** Most seats one vd_book_seats call may take. A party, not a coach company. */
create or replace function public.vd_max_seats_per_booking()
returns int language sql immutable as $$ select 20 $$;

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

  select (value->>'maxSeats')::int, coalesce((value->>'bookedSeats')::int, 0)
    into v_max, v_booked
    from vd_entities
   where id = p_departure_id and kind = 'departure'
     for update;

  if not found then raise exception 'departure not found'; end if;
  if v_booked + p_seats > v_max then raise exception 'not enough seats available'; end if;

  update vd_entities
     set value = value
                 || jsonb_build_object('bookedSeats', v_booked + p_seats)
                 || case when v_booked + p_seats >= v_max
                         then jsonb_build_object('status', 'full') else '{}'::jsonb end,
         status = case when v_booked + p_seats >= v_max then 'full' else status end,
         updated_at = now()
   where id = p_departure_id;

  -- So a slow attempt to exhaust a departure is visible in the audit log
  -- rather than only in the seat count.
  perform vd_audit('departure.seats_booked', 'departure', p_departure_id,
                   jsonb_build_object('seats', p_seats, 'bookedAfter', v_booked + p_seats));
end;
$$;

grant execute on function public.vd_max_seats_per_booking()        to anon, authenticated;
grant execute on function public.vd_may_release_seats(text)        to authenticated;
grant execute on function public.vd_book_seats(text, int)          to authenticated;
grant execute on function public.vd_release_seats(text, int)       to authenticated;
