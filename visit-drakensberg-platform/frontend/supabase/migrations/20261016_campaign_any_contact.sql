-- ============================================================================
-- Visit Drakensberg — Campaigns to any contact, not only account holders
--
-- Until now a hand-picked campaign could only reach people with a website
-- account (recipient_user_ids) whose profile carried marketing_consent. The
-- contacts imported from Wix live in supplier address books
-- (vd_supplier_contacts, source 'imported' / 'manual') with no account at
-- all, so the campaign builder could not see them.
--
-- WHAT THIS ADDS
--   recipient_emails             hand-picked recipients by email address,
--                                account or not. recipient_user_ids stays
--                                for campaigns saved before this; both count.
--   vd_customer_consents.recorded_by
--                                which admin recorded a consent row.
--   vd_campaign_contacts()       everyone the builder can offer: customers
--                                and address-book contacts, one row per
--                                address, with their consent status.
--   vd_marketing_consent_status()  consent status for typed-in addresses.
--   vd_admin_record_marketing_consent()
--                                an admin's confirmation that people opted in
--                                elsewhere (e.g. on Wix), written to the
--                                consent log as source 'admin_attested'. It
--                                never overrides a recorded opt-out.
--   vd_campaign_recipients()     the one place a campaign's recipients are
--                                resolved; the real send, the dry run and the
--                                campaign page's count all use it.
--
-- CONSENT RULE (unchanged in spirit, now applied to addresses)
--   The latest marketing_email row in vd_customer_consents decides. With no
--   row at all, an account's cached marketing_consent flag decides. Anyone
--   else is not emailed. Staff accounts (admin, supplier, staff_role) never
--   are.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

alter table vd_email_campaigns
  add column if not exists recipient_emails text[] not null default '{}';
comment on column vd_email_campaigns.recipient_emails is
  'Hand-picked recipients by lower-cased email (audience_mode = manual). Union with recipient_user_ids; consent decided per address at send.';

alter table vd_customer_consents
  add column if not exists recorded_by uuid references auth.users(id) on delete set null;

-- ────────────────────────────────────────────────────────────────────────────
-- Shared helpers
-- ────────────────────────────────────────────────────────────────────────────

-- Latest recorded marketing choice for an address, or null if none.
create or replace function public.vd_latest_marketing_choice(p_email text)
returns boolean
language sql stable security definer set search_path = public as $$
  select cc.granted from vd_customer_consents cc
  where lower(cc.email) = lower(trim(p_email)) and cc.consent_type = 'marketing_email'
  order by cc.created_at desc, cc.id desc
  limit 1
$$;
revoke execute on function public.vd_latest_marketing_choice(text) from public, anon, authenticated;

-- An address that belongs to a staff account is never a marketing recipient.
create or replace function public.vd_is_staff_email(p_email text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where lower(trim(p.email)) = lower(trim(p_email))
      and (coalesce(p.role::text, '') in ('admin', 'supplier') or p.staff_role is not null)
  )
$$;
revoke execute on function public.vd_is_staff_email(text) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- vd_campaign_contacts — the builder's contact list
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_campaign_contacts()
returns table (
  email                  text,
  full_name              text,
  user_id                uuid,
  kind                   text,     -- 'customer' (has an account) | 'address_book'
  address_books          text[],   -- supplier names whose address book holds this address
  consent                text,     -- 'opted_in' | 'unknown' | 'opted_out'
  country                text,
  city                   text,
  lifecycle_stage        text,
  interests              text[],
  favourite_destinations text[],
  favourite_activities   text[],
  trip_count             integer,
  upcoming_travel        date,
  segment_ids            text[]
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  return query
  with customers as (
    select distinct on (lower(trim(p.email)))
           lower(trim(p.email)) as e, p.id as uid, nullif(trim(p.full_name), '') as nm
    from profiles p
    where coalesce(trim(p.email), '') <> ''
      and coalesce(p.role::text, '') not in ('admin', 'supplier') and p.staff_role is null
    order by lower(trim(p.email)), p.created_at
  ),
  book as (
    select lower(trim(sc.email)) as e,
           (array_agg(nullif(trim(sc.name), '') order by (nullif(trim(sc.name), '') is null), sc.updated_at desc))[1] as nm,
           array_agg(distinct coalesce(nullif(trim(sp.full_name), ''), 'Unnamed supplier')) as books
    from vd_supplier_contacts sc
    left join profiles sp on sp.id = sc.supplier_id
    where coalesce(trim(sc.email), '') <> ''
    group by 1
  ),
  allc as (
    select coalesce(c.e, b.e) as e, c.uid, coalesce(c.nm, b.nm) as nm, coalesce(b.books, '{}'::text[]) as books
    from customers c
    full join book b on b.e = c.e
  ),
  latest as (
    select distinct on (lower(cc.email)) lower(cc.email) as e, cc.granted
    from vd_customer_consents cc
    where cc.consent_type = 'marketing_email'
    order by lower(cc.email), cc.created_at desc, cc.id desc
  ),
  orders as (
    select o.user_id,
           count(*)::integer as trip_count,
           min(o.travel_start) filter (where o.travel_start >= current_date) as upcoming_travel
    from vd_orders o
    where o.booking_status <> 'cancelled'
    group by o.user_id
  ),
  segs as (
    select m.user_id, array_agg(m.segment_id) as ids
    from vd_customer_segment_members m
    group by m.user_id
  )
  select a.e,
         coalesce(a.nm, ''),
         a.uid,
         case when a.uid is not null then 'customer' else 'address_book' end,
         a.books,
         case when l.granted is true then 'opted_in'
              when l.granted is false then 'opted_out'
              when coalesce(cp.marketing_consent, false) then 'opted_in'
              else 'unknown' end,
         cp.country, cp.province_or_city, coalesce(cp.lifecycle_stage, 'visitor'),
         coalesce(cp.interests, '{}'::text[]), coalesce(cp.favourite_destinations, '{}'::text[]),
         coalesce(cp.favourite_activities, '{}'::text[]),
         coalesce(o.trip_count, 0), o.upcoming_travel,
         coalesce(s.ids, '{}'::text[])
  from allc a
  left join latest l               on l.e = a.e
  left join vd_customer_profiles cp on cp.user_id = a.uid
  left join orders o               on o.user_id = a.uid
  left join segs s                 on s.user_id = a.uid
  where a.e ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    and not vd_is_staff_email(a.e)
  order by lower(coalesce(a.nm, a.e)), a.e;
end;
$$;
revoke execute on function public.vd_campaign_contacts() from public, anon;
grant execute on function public.vd_campaign_contacts() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- vd_marketing_consent_status — for addresses typed into the builder
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_marketing_consent_status(p_emails text[])
returns table (email text, consent text, is_staff boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  return query
  select x.e,
         case vd_latest_marketing_choice(x.e)
           when true then 'opted_in'
           when false then 'opted_out'
           else case when exists (
                  select 1 from profiles p join vd_customer_profiles cp on cp.user_id = p.id
                  where lower(trim(p.email)) = x.e and cp.marketing_consent) then 'opted_in' else 'unknown' end
         end,
         vd_is_staff_email(x.e)
  from (select distinct lower(trim(e)) as e from unnest(coalesce(p_emails, '{}'::text[])) as e
        where trim(e) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') x;
end;
$$;
revoke execute on function public.vd_marketing_consent_status(text[]) from public, anon;
grant execute on function public.vd_marketing_consent_status(text[]) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- vd_admin_record_marketing_consent — "these people opted in elsewhere"
--
-- Writes one consent row per address that has no current opt-in, attributed
-- to the admin. An address whose latest choice is an opt-out is skipped:
-- an admin can't override someone's unsubscribe. Staff addresses are skipped
-- too. Returns how many rows were written.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_admin_record_marketing_consent(p_emails text[], p_source text default 'admin_attested')
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_count integer := 0;
  r record;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  for r in
    select distinct lower(trim(e)) as e
    from unnest(coalesce(p_emails, '{}'::text[])) as e
    where trim(e) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  loop
    continue when vd_is_staff_email(r.e);
    continue when vd_latest_marketing_choice(r.e) is not null;  -- already opted in, or opted out: leave it
    continue when exists (  -- an account already opted in through its profile
      select 1 from profiles p join vd_customer_profiles cp on cp.user_id = p.id
      where lower(trim(p.email)) = r.e and cp.marketing_consent);

    insert into vd_customer_consents (user_id, email, consent_type, granted, source, recorded_by)
    values (
      (select p.id from profiles p where lower(trim(p.email)) = r.e order by p.created_at limit 1),
      r.e, 'marketing_email', true, coalesce(nullif(trim(p_source), ''), 'admin_attested'), v_admin
    );

    update vd_customer_profiles cp
    set marketing_consent = true, updated_at = now()
    from profiles p
    where p.id = cp.user_id and lower(trim(p.email)) = r.e and not cp.marketing_consent;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.vd_admin_record_marketing_consent(text[], text) from public, anon;
grant execute on function public.vd_admin_record_marketing_consent(text[], text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- vd_campaign_recipients — who a campaign actually reaches
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_campaign_recipients(p_campaign_id uuid)
returns table (
  user_id                uuid,
  email                  text,
  full_name              text,
  country                text,
  city                   text,
  lifecycle_stage        text,
  interests              text[],
  favourite_destinations text[],
  favourite_activities   text[],
  trip_count             integer,
  upcoming_travel        date
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_campaign vd_email_campaigns%rowtype;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  select * into v_campaign from vd_email_campaigns c where c.id = p_campaign_id;
  if v_campaign.id is null then
    raise exception 'campaign not found';
  end if;

  return query
  with picked as (
    -- manual: typed/picked addresses plus the addresses of picked accounts
    select lower(trim(e)) as e from unnest(v_campaign.recipient_emails) as e
    where v_campaign.audience_mode = 'manual'
    union
    select lower(trim(p.email)) from profiles p
    where v_campaign.audience_mode = 'manual' and p.id = any(v_campaign.recipient_user_ids)
    union
    -- segment: consenting accounts, everyone or one segment
    select lower(trim(p.email))
    from vd_customer_profiles cp
    join profiles p on p.id = cp.user_id
    where v_campaign.audience_mode <> 'manual'
      and cp.marketing_consent
      and (v_campaign.audience_segment_id is null or exists (
             select 1 from vd_customer_segment_members m
             where m.user_id = cp.user_id and m.segment_id = v_campaign.audience_segment_id))
  ),
  addr as (
    select distinct pk.e from picked pk
    where coalesce(pk.e, '') ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  ),
  acct as (
    select distinct on (lower(trim(p.email))) lower(trim(p.email)) as e, p.id, nullif(trim(p.full_name), '') as nm
    from profiles p
    where lower(trim(p.email)) in (select a.e from addr a)
    order by lower(trim(p.email)), p.created_at
  ),
  book as (
    select lower(trim(sc.email)) as e,
           (array_agg(nullif(trim(sc.name), '') order by (nullif(trim(sc.name), '') is null), sc.updated_at desc))[1] as nm
    from vd_supplier_contacts sc
    where lower(trim(sc.email)) in (select a.e from addr a)
    group by 1
  ),
  orders as (
    select o.user_id,
           count(*)::integer as trip_count,
           min(o.travel_start) filter (where o.travel_start >= current_date) as upcoming_travel
    from vd_orders o
    where o.booking_status <> 'cancelled'
    group by o.user_id
  )
  select ac.id, a.e, coalesce(ac.nm, b.nm, ''),
         cp.country, cp.province_or_city, coalesce(cp.lifecycle_stage, 'visitor'),
         coalesce(cp.interests, '{}'::text[]), coalesce(cp.favourite_destinations, '{}'::text[]),
         coalesce(cp.favourite_activities, '{}'::text[]),
         coalesce(o.trip_count, 0), o.upcoming_travel
  from addr a
  left join acct ac                 on ac.e = a.e
  left join book b                  on b.e = a.e
  left join vd_customer_profiles cp on cp.user_id = ac.id
  left join orders o                on o.user_id = ac.id
  where not vd_is_staff_email(a.e)
    and coalesce(vd_latest_marketing_choice(a.e), coalesce(cp.marketing_consent, false))
  order by a.e;
end;
$$;
revoke execute on function public.vd_campaign_recipients(uuid) from public, anon, authenticated;

-- How many a campaign would reach right now (the campaign page's number).
create or replace function public.vd_campaign_recipient_count(p_campaign_id uuid)
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;
  return (select count(*)::integer from vd_campaign_recipients(p_campaign_id));
end;
$$;
revoke execute on function public.vd_campaign_recipient_count(uuid) from public, anon;
grant execute on function public.vd_campaign_recipient_count(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- The real send and the dry run, both through vd_campaign_recipients
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_campaign_begin_send(p_campaign_id uuid)
returns table (
  user_id                uuid,
  email                  text,
  full_name              text,
  country                text,
  city                   text,
  lifecycle_stage        text,
  interests              text[],
  favourite_destinations text[],
  favourite_activities   text[],
  trip_count             integer,
  upcoming_travel        date
)
language plpgsql security definer set search_path = public as $$
declare
  v_campaign vd_email_campaigns%rowtype;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  select * into v_campaign from vd_email_campaigns c where c.id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception 'campaign not found';
  end if;
  if v_campaign.status not in ('draft', 'scheduled', 'dry_run_sent') then
    raise exception 'campaign is not in a sendable state (status: %)', v_campaign.status;
  end if;
  if v_campaign.template_id is null then
    raise exception 'campaign has no template';
  end if;
  if v_campaign.audience_mode = 'manual'
     and coalesce(cardinality(v_campaign.recipient_user_ids), 0) + coalesce(cardinality(v_campaign.recipient_emails), 0) = 0 then
    raise exception 'no recipients selected';
  end if;

  update vd_email_campaigns c
  set status = 'sending', dry_run = false, send_error = null, updated_at = now()
  where c.id = p_campaign_id;

  return query select * from vd_campaign_recipients(p_campaign_id);
end;
$$;
revoke execute on function public.vd_campaign_begin_send(uuid) from public;
grant execute on function public.vd_campaign_begin_send(uuid) to authenticated;

create or replace function public.vd_campaign_dry_run_send(p_campaign_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_campaign vd_email_campaigns%rowtype;
  v_count integer;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  select * into v_campaign from vd_email_campaigns c where c.id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception 'campaign not found';
  end if;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'campaign is not in a sendable state (status: %)', v_campaign.status;
  end if;
  if v_campaign.audience_mode = 'manual'
     and coalesce(cardinality(v_campaign.recipient_user_ids), 0) + coalesce(cardinality(v_campaign.recipient_emails), 0) = 0 then
    raise exception 'no recipients selected';
  end if;

  select count(*)::integer into v_count from vd_campaign_recipients(p_campaign_id);

  update vd_email_campaigns
  set status = 'dry_run_sent', dry_run = true, sent_at = now(), audience_count_snapshot = v_count, updated_at = now()
  where id = p_campaign_id;

  return v_count;
end;
$$;
revoke execute on function public.vd_campaign_dry_run_send(uuid) from public;
grant execute on function public.vd_campaign_dry_run_send(uuid) to authenticated;
