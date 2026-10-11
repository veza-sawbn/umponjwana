-- ============================================================================
-- Visit Drakensberg — Campaign send: dry run first, and recovery from a send
-- that was cut off
--
-- Follow-up to 20261008_brevo_campaign_send.sql (already applied, so it is
-- not edited — see the ledger rules in 20260914_schema_migrations_ledger.sql).
--
-- 1. A dry run no longer dead-ends a campaign. vd_campaign_dry_run_send()
--    leaves it in 'dry_run_sent', which vd_campaign_begin_send() refused, so
--    the natural "check the audience, then send" order meant recreating the
--    campaign. 'dry_run_sent' is now sendable.
--
-- 2. A send cut off mid-way (function timeout, crash) used to leave the
--    campaign in 'sending' for good: begin refuses it, finish never ran, and
--    the admin UI offers nothing for that state. vd_campaign_release_stuck()
--    lets an admin close it out once it has plainly stopped. It is closed as
--    'sent', never back to 'draft': some batches were very likely accepted
--    by Brevo, and a retry would email those people twice. The snapshot is
--    the number of 'sent' rows in vd_email_events, which the send route now
--    writes after every accepted batch rather than once at the end.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

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
  -- dry_run_sent: the dry run recorded an audience and emailed nobody.
  if v_campaign.status not in ('draft', 'scheduled', 'dry_run_sent') then
    raise exception 'campaign is not in a sendable state (status: %)', v_campaign.status;
  end if;
  if v_campaign.template_id is null then
    raise exception 'campaign has no template';
  end if;
  if v_campaign.audience_mode = 'manual' and coalesce(cardinality(v_campaign.recipient_user_ids), 0) = 0 then
    raise exception 'no recipients selected';
  end if;

  update vd_email_campaigns c
  set status = 'sending', dry_run = false, send_error = null, updated_at = now()
  where c.id = p_campaign_id;

  return query
  with audience as (
    select cp.user_id
    from vd_customer_profiles cp
    where cp.marketing_consent
      and (
        (v_campaign.audience_mode = 'manual' and cp.user_id = any(v_campaign.recipient_user_ids))
        or (v_campaign.audience_mode <> 'manual' and v_campaign.audience_segment_id is null)
        or (v_campaign.audience_mode <> 'manual' and exists (
              select 1 from vd_customer_segment_members m
              where m.user_id = cp.user_id and m.segment_id = v_campaign.audience_segment_id))
      )
  ),
  orders as (
    select o.user_id,
           count(*)::integer as trip_count,
           min(o.travel_start) filter (where o.travel_start >= current_date) as upcoming_travel
    from vd_orders o
    where o.booking_status <> 'cancelled'
    group by o.user_id
  )
  select distinct on (lower(trim(p.email)))
         p.id, lower(trim(p.email)), coalesce(nullif(trim(p.full_name), ''), ''),
         cp.country, cp.province_or_city, cp.lifecycle_stage,
         cp.interests, cp.favourite_destinations, cp.favourite_activities,
         coalesce(o.trip_count, 0), o.upcoming_travel
  from audience a
  join profiles p              on p.id = a.user_id
  join vd_customer_profiles cp on cp.user_id = a.user_id
  left join orders o           on o.user_id = a.user_id
  where coalesce(trim(p.email), '') <> ''
    and coalesce(p.role::text, '') not in ('admin', 'supplier')
    and p.staff_role is null
    and coalesce((
          select cc.granted from vd_customer_consents cc
          where lower(cc.email) = lower(trim(p.email)) and cc.consent_type = 'marketing_email'
          order by cc.created_at desc limit 1
        ), true)
  order by lower(trim(p.email)), p.id;
end;
$$;
revoke execute on function public.vd_campaign_begin_send(uuid) from public;
grant execute on function public.vd_campaign_begin_send(uuid) to authenticated;

-- 10 minutes: the send route's maxDuration is 300s, so a campaign still
-- 'sending' after twice that has certainly stopped.
create or replace function public.vd_campaign_release_stuck(p_campaign_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_sent integer;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  select count(distinct lower(e.email))::integer into v_sent
  from vd_email_events e
  where e.campaign_id = p_campaign_id and e.event_type = 'sent';

  update vd_email_campaigns
  set status = 'sent', sent_at = now(), audience_count_snapshot = v_sent,
      send_error = 'The send was interrupted before it finished. ' || v_sent
        || ' recipient(s) are recorded as sent; check Brevo''s logs for the rest before sending anything similar.',
      updated_at = now()
  where id = p_campaign_id and status = 'sending' and updated_at < now() - interval '10 minutes';

  if not found then
    raise exception 'campaign is not stuck (only a send that stopped over 10 minutes ago can be released)';
  end if;
  return v_sent;
end;
$$;
revoke execute on function public.vd_campaign_release_stuck(uuid) from public;
grant execute on function public.vd_campaign_release_stuck(uuid) to authenticated;
