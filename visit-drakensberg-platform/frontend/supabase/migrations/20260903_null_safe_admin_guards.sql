-- ============================================================================
-- Visit Drakensberg — NULL-safe admin/service-role guards
--
-- Four pre-existing functions share the guard shape found broken in
-- 20260902's vd_expire_stay_requests:
--
--   if not (is_admin() or auth.role() = 'service_role') then
--
-- auth.role() is NULL when there is no JWT (a direct database connection,
-- rather than a request PostgREST has stamped with an anon/authenticated/
-- service_role claim). `not (false or NULL)` evaluates to NULL, and IF
-- treats NULL as false — so on a connection with no JWT, the guard silently
-- admits the very caller it reads as excluding, instead of raising.
--
-- Not exploitable through the API today: PostgREST always sets a role claim
-- on every request that can reach these functions, so auth.role() is never
-- actually NULL there and the guard raises correctly in practice. This is
-- defence in depth, caught by actually calling the 20260902 function with
-- no JWT rather than reading the code — the same test against these four
-- would have caught it here too.
--
-- Each function below is copied verbatim from its source migration with
-- only the guard line changed (coalesce(..., false), same fix as 20260902):
--   1. vd_recompute_segments          — 20260824_customer_intelligence_foundation.sql
--   2. vd_recompute_supplier_contacts — latest body per 20260827_supplier_contacts_import.sql
--   3. vd_add_supplier_contact        — 20260828_manual_guest_package_and_contacts.sql
-- ============================================================================

create or replace function public.vd_recompute_segments(
  p_high_value_threshold numeric default 50000,
  p_dormant_days integer default 180,
  p_recent_days integer default 30
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Callable by an admin from the (future) admin UI, or by the service role
  -- from a scheduled job (auth.role() = 'service_role' — see the
  -- /api/cron/recompute-segments route, which mirrors the existing
  -- expire-pending-bookings cron and carries no user JWT at all).
  if not coalesce(is_admin() or auth.role() = 'service_role', false) then
    raise exception 'admin only';
  end if;

  create temporary table _vd_segment_membership (segment_id text not null, user_id uuid not null) on commit drop;

  -- Prospects: registered, zero non-cancelled orders.
  insert into _vd_segment_membership
  select 'prospects', p.id
  from profiles p
  where not exists (
    select 1 from vd_orders o where o.user_id = p.id and o.booking_status <> 'cancelled'
  );

  -- First-time / returning: order count per customer.
  insert into _vd_segment_membership
  select case when x.n = 1 then 'first_time_customers' else 'returning_customers' end, x.user_id
  from (
    select user_id, count(*) as n
    from vd_orders
    where user_id is not null and booking_status <> 'cancelled'
    group by user_id
  ) x
  where x.n >= 1;

  -- Upcoming travellers: a future travel_start on a non-cancelled order.
  insert into _vd_segment_membership
  select distinct 'upcoming_travellers', user_id
  from vd_orders
  where user_id is not null and booking_status <> 'cancelled'
    and travel_start is not null and travel_start >= current_date;

  -- Recent travellers: a trip marked completed within the recent window.
  insert into _vd_segment_membership
  select distinct 'recent_travellers', user_id
  from vd_orders
  where user_id is not null and trip_status = 'completed'
    and travel_end is not null and travel_end >= (current_date - p_recent_days);

  -- High-value: lifetime spend across non-cancelled orders.
  insert into _vd_segment_membership
  select 'high_value_customers', x.user_id
  from (
    select user_id, sum(total_value) as spend
    from vd_orders
    where user_id is not null and booking_status <> 'cancelled'
    group by user_id
  ) x
  where x.spend >= p_high_value_threshold;

  -- International: explicit country set on the CRM profile, not South Africa.
  insert into _vd_segment_membership
  select 'international_visitors', user_id
  from vd_customer_profiles
  where country is not null and trim(country) <> ''
    and lower(country) not in ('south africa', 'za', 'rsa');

  -- Dormant: last order activity older than the window, and nothing upcoming.
  insert into _vd_segment_membership
  select 'dormant_customers', x.user_id
  from (
    select user_id,
           max(created_at) as last_activity,
           bool_or(booking_status <> 'cancelled' and travel_start is not null and travel_start >= current_date) as has_upcoming
    from vd_orders
    where user_id is not null
    group by user_id
  ) x
  where x.last_activity < (now() - (p_dormant_days || ' days')::interval)
    and not x.has_upcoming;

  -- Full replace: these eight ids are entirely owned by this function.
  delete from vd_customer_segment_members
  where segment_id in (
    'prospects', 'first_time_customers', 'returning_customers', 'upcoming_travellers',
    'recent_travellers', 'high_value_customers', 'international_visitors', 'dormant_customers'
  );
  insert into vd_customer_segment_members (segment_id, user_id, computed_at)
  select distinct segment_id, user_id, now() from _vd_segment_membership
  on conflict (segment_id, user_id) do update set computed_at = excluded.computed_at;

  -- Derive lifecycle_stage (§1) from the same membership, most-advanced wins.
  -- Never touches a profile an admin has already flagged 'advocate'.
  update vd_customer_profiles cp
  set lifecycle_stage = sub.stage, updated_at = now()
  from (
    select p.id as user_id,
      case
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'returning_customers' and s.user_id = p.id) then 'returning_customer'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'upcoming_travellers'  and s.user_id = p.id) then 'upcoming_traveller'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'recent_travellers'    and s.user_id = p.id) then 'traveller'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'first_time_customers' and s.user_id = p.id) then 'customer'
        when exists (select 1 from _vd_segment_membership s where s.segment_id = 'prospects'            and s.user_id = p.id) then 'prospect'
        else 'visitor'
      end as stage
    from profiles p
  ) sub
  where cp.user_id = sub.user_id
    and cp.lifecycle_stage <> 'advocate';
end;
$$;

create or replace function public.vd_recompute_supplier_contacts()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_upserted integer;
  v_deleted  integer;
begin
  if not coalesce(is_admin() or auth.role() = 'service_role', false) then
    raise exception 'admin only';
  end if;

  -- Materialised once so both the upsert and the stale-row cleanup below
  -- see exactly the same snapshot of "who currently has an active line".
  create temporary table _vd_contact_agg on commit drop as
  with lines as (
    -- bk.value->>'customerPhone' is the number actually supplied for
    -- fulfilment at checkout (see lib/bookings.ts/lib/orders.ts) —
    -- profiles.phone is never populated by the normal signup or account-
    -- settings flow (that writes to auth user_metadata instead), so it
    -- would leave this address book's phone blank for real customers.
    select l.supplier_id, l.user_id, l.order_id, l.created_at, l.gross_amount, l.discount_amount,
           l.share_customer_name, l.customer_name, o.customer_email, bk.value->>'customerPhone' as customer_phone
    from vd_order_lines l
    join vd_orders o on o.id = l.order_id
    left join vd_bookings bk on bk.id = o.booking_id
    where l.user_id is not null and l.supplier_id is not null and l.fulfilment_status <> 'cancelled'
  )
  select
    supplier_id, user_id,
    count(distinct order_id) as booking_count,
    sum(gross_amount - discount_amount) as lifetime_spend,
    min(created_at) as first_booking_at,
    max(created_at) as last_booking_at,
    (array_agg(customer_name order by created_at desc)
      filter (where share_customer_name and customer_name is not null and customer_name <> ''))[1] as name,
    (array_agg(customer_email order by created_at desc)
      filter (where customer_email is not null and customer_email <> ''))[1] as email,
    (array_agg(customer_phone order by created_at desc)
      filter (where customer_phone is not null and customer_phone <> ''))[1] as phone
  from lines
  group by supplier_id, user_id;

  insert into vd_supplier_contacts (
    supplier_id, customer_user_id, name, email, phone,
    first_booking_at, last_booking_at, booking_count, lifetime_spend, source, updated_at
  )
  select a.supplier_id, a.user_id, a.name, a.email, a.phone,
         a.first_booking_at, a.last_booking_at, a.booking_count, a.lifetime_spend, 'booking', now()
  from _vd_contact_agg a
  on conflict (supplier_id, customer_user_id) where customer_user_id is not null do update set
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    first_booking_at = excluded.first_booking_at,
    last_booking_at = excluded.last_booking_at,
    booking_count = excluded.booking_count,
    lifetime_spend = excluded.lifetime_spend,
    updated_at = now();
  get diagnostics v_upserted = row_count;

  -- Only ever retires source = 'booking' rows — an imported row has no
  -- corresponding entry in the snapshot by definition and must never be
  -- removed by this function.
  delete from vd_supplier_contacts c
  where c.source = 'booking' and not exists (
    select 1 from _vd_contact_agg a
    where a.supplier_id = c.supplier_id and a.user_id = c.customer_user_id
  );
  get diagnostics v_deleted = row_count;

  return v_upserted + v_deleted;
end;
$$;

create or replace function public.vd_add_supplier_contact(
  p_supplier_id uuid, p_name text, p_email text, p_phone text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name  text := nullif(trim(p_name), '');
  v_email text := nullif(trim(p_email), '');
  v_phone text := nullif(trim(p_phone), '');
  v_id    uuid;
begin
  if not coalesce(p_supplier_id = auth.uid() or is_managed_supplier(p_supplier_id) or is_admin(), false) then
    raise exception 'not authorized for this supplier';
  end if;
  if v_name is null and v_email is null then
    raise exception 'name or email required';
  end if;

  if v_email is not null then
    insert into vd_supplier_contacts (supplier_id, customer_user_id, name, email, phone, source, updated_at)
    values (p_supplier_id, null, v_name, v_email, v_phone, 'manual', now())
    on conflict (supplier_id, lower(email)) where source = 'manual' and email is not null do update set
      name = coalesce(excluded.name, vd_supplier_contacts.name),
      phone = coalesce(excluded.phone, vd_supplier_contacts.phone),
      updated_at = now()
    returning id into v_id;
  else
    -- No email to de-dupe on — each no-email guest becomes its own row,
    -- same as a no-email CSV row in vd_import_supplier_contacts.
    insert into vd_supplier_contacts (supplier_id, customer_user_id, name, email, phone, source, updated_at)
    values (p_supplier_id, null, v_name, null, v_phone, 'manual', now())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.vd_add_supplier_contact(uuid, text, text, text) to authenticated;
