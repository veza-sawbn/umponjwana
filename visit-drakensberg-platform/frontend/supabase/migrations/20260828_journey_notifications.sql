-- ============================================================================
-- Visit Drakensberg — Customer-journey notifications
--
-- Closes four visibility gaps reported by staff:
--
--   1. Orders created outside checkout (admin/guest invoices, accepted
--      quotes) never told the allocated supplier(s) anything existed —
--      vd_create_order has no notification step, and the admin invoice UI
--      only calls lib/orders.ts (never lib/booking-orders.ts /
--      lib/notifications.ts, which is how a normal checkout booking tells
--      its suppliers). Fixed with a trigger on vd_order_lines rather than
--      editing vd_create_order in place, so the existing (large, financial)
--      RPC body is untouched.
--   2. Nobody on staff heard about payment activity unless they happened to
--      open the order: a quote being accepted, an online payment landing,
--      or an online payment being declined all wrote no notification at
--      all — receipts/send (app/api/receipts/send) only ever notifies the
--      customer, never staff.
--   3. Suppliers running activities/tours were not told when a participant
--      signed their waiver — vd_waiver_submit has no notification step
--      either.
--
-- All additions are additive triggers/columns; no existing function body is
-- modified, so none of the financial RPCs this touches change behaviour for
-- anything other than the new notification.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. New order lines outside the checkout flow → notify the supplier.
--
-- Checkout-originated orders (booking_id set) already notify suppliers —
-- immediately for an already-confirmed booking (lib/bookings.ts), or on
-- payment confirmation for a pending one (app/api/payments/ikhokha/webhook).
-- Everything else — a staff-written manual/guest invoice, or a quote the
-- customer just accepted (vd_accept_quote calls vd_create_order under the
-- hood) — reached this point with no notification at all. One notification
-- per (order, supplier), not per line: the first line inserted for a given
-- supplier on an order fires it; later lines for the same pair see the
-- earlier row already committed in this transaction and skip.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_notify_supplier_new_order_line()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_booking_id text;
  v_order_number text;
  v_customer_name text;
begin
  if new.supplier_id is null then
    return new;
  end if;

  select booking_id, order_number, customer_name
    into v_booking_id, v_order_number, v_customer_name
    from vd_orders where id = new.order_id;

  if v_booking_id is not null then
    return new; -- checkout flow: already handled elsewhere
  end if;

  if exists (
    select 1 from vd_order_lines
    where order_id = new.order_id and supplier_id = new.supplier_id and id <> new.id
  ) then
    return new; -- already notified for this order+supplier
  end if;

  insert into vd_notifications (user_id, type, title, body, link) values (
    new.supplier_id, 'booking',
    'New order ' || coalesce(v_order_number, ''),
    coalesce(nullif(v_customer_name, ''), 'A customer') ||
      ' has an order with items allocated to you. Open your earnings to review and confirm.',
    '/supplier/earnings'
  );

  return new;
end;
$$;

drop trigger if exists vd_order_lines_notify_supplier_trg on vd_order_lines;
create trigger vd_order_lines_notify_supplier_trg
  after insert on vd_order_lines
  for each row execute function public.vd_notify_supplier_new_order_line();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Quote accepted / declined → notify the staff member who sent it.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_notify_quote_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status or new.created_by is null then
    return new;
  end if;

  if new.status = 'converted' then
    insert into vd_notifications (user_id, type, title, body, link) values (
      new.created_by, 'approval',
      'Quote accepted — ' || new.quote_number,
      coalesce(nullif(new.customer_name, ''), 'The customer') ||
        ' accepted quote ' || new.quote_number || ' (' || coalesce(nullif(new.trip_name, ''), 'trip') ||
        '). It is now an order awaiting payment.',
      '/admin/orders'
    );
  elsif new.status = 'declined' then
    insert into vd_notifications (user_id, type, title, body, link) values (
      new.created_by, 'info',
      'Quote declined — ' || new.quote_number,
      coalesce(nullif(new.customer_name, ''), 'The customer') || ' declined quote ' || new.quote_number || '.',
      '/admin/quotes'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists vd_quotes_notify_status_trg on vd_quotes;
create trigger vd_quotes_notify_status_trg
  after update of status on vd_quotes
  for each row execute function public.vd_notify_quote_status();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Online payment recorded → notify finance staff.
--
-- Manual payments (cash/EFT/offline) are recorded by a staff member acting
-- on the order, so they already know. An 'online' payment (iKhokha) happens
-- with nobody at the platform in the loop — that's exactly the case staff
-- said they never hear about.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_notify_finance_online_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order_number text;
  v_customer_name text;
begin
  if new.direction <> 'in' or new.method <> 'online' then
    return new;
  end if;

  select order_number, customer_name into v_order_number, v_customer_name
    from vd_orders where id = new.order_id;

  insert into vd_notifications (user_id, type, title, body, link)
  select id, 'payment',
    'Payment received — ' || coalesce(v_order_number, new.order_id),
    coalesce(nullif(v_customer_name, ''), 'A customer') || ' paid ' ||
      to_char(new.amount, 'FM999,999,990.00') || ' ' || new.currency || ' online.',
    '/admin/orders'
  from profiles
  where role = 'admin' or staff_role = 'finance';

  return new;
end;
$$;

drop trigger if exists vd_order_payments_notify_finance_trg on vd_order_payments;
create trigger vd_order_payments_notify_finance_trg
  after insert on vd_order_payments
  for each row execute function public.vd_notify_finance_online_payment();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Waiver signed → notify the supplier.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_notify_waiver_signed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_participant text;
  v_activity text;
begin
  select participant_name, activity_name into v_participant, v_activity
    from vd_waiver_requests where id = new.request_id;

  insert into vd_notifications (user_id, type, title, body, link) values (
    new.supplier_id, 'info',
    'Waiver signed — ' || coalesce(nullif(v_participant, ''), new.signed_name),
    coalesce(nullif(v_participant, ''), new.signed_name) || ' signed the waiver for ' ||
      coalesce(nullif(v_activity, ''), 'their activity') || '.',
    '/supplier/waivers'
  );

  return new;
end;
$$;

drop trigger if exists vd_waiver_submissions_notify_trg on vd_waiver_submissions;
create trigger vd_waiver_submissions_notify_trg
  after insert on vd_waiver_submissions
  for each row execute function public.vd_notify_waiver_signed();
