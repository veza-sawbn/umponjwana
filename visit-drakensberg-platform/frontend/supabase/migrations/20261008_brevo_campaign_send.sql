-- ============================================================================
-- Visit Drakensberg — Real campaign sends through Brevo
--
-- 20260825_email_campaign_foundation.sql deliberately stopped at a dry run:
-- lib/mailer.ts is a single SMTP mailbox, not a marketing ESP. Brevo is that
-- ESP now (lib/brevo.ts), so this adds the server side of a real send. The
-- dry run stays exactly as it was — it is still the way to check an audience
-- without emailing anyone.
--
-- WHAT THIS ADDS:
--   status 'sending'      a campaign mid-send. Set atomically by
--                         vd_campaign_begin_send(), so two admins (or one
--                         double-click) can never send the same campaign twice.
--   send_error            what went wrong, when something did.
--   vd_campaign_begin_send()   claims the campaign and returns its recipients
--                         with every field the merge tags read.
--   vd_campaign_finish_send()  records the outcome.
--
-- WHO GETS EMAILED:
--   Everyone the dry run counts (marketing_consent, and the segment or the
--   hand-picked list), MINUS
--     * staff (admin / supplier / any staff_role) — they are not customers;
--     * anyone whose most recent marketing_email row in vd_customer_consents
--       is a withdrawal. This matters: vd_set_consent() only refreshes the
--       cached vd_customer_profiles.marketing_consent when the caller is
--       logged in, so an opt-out from the public /unsubscribe page (or from
--       Brevo's webhook) lands in the log but not in the cache. The log is
--       the source of truth, and a real send must honour it.
--   So the sent count can be lower than the dry-run count. That is correct.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

alter table vd_email_campaigns drop constraint if exists vd_email_campaigns_status_check;
alter table vd_email_campaigns add constraint vd_email_campaigns_status_check
  check (status in ('draft', 'scheduled', 'dry_run_sent', 'sending', 'sent', 'paused', 'cancelled'));

alter table vd_email_campaigns
  add column if not exists send_error text;

comment on column vd_email_campaigns.send_error is
  'Last send failure from the ESP (lib/brevo.ts). A partial failure is kept alongside status = sent.';

-- ────────────────────────────────────────────────────────────────────────────
-- vd_campaign_begin_send — claim + resolve
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

  -- Row lock: a second concurrent call waits here, then sees 'sending'.
  select * into v_campaign from vd_email_campaigns c where c.id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception 'campaign not found';
  end if;
  if v_campaign.status not in ('draft', 'scheduled') then
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

-- ────────────────────────────────────────────────────────────────────────────
-- vd_campaign_finish_send — record the outcome
--
-- Nothing accepted by the ESP → back to draft with the error, so the admin
-- can fix the cause and retry without anyone having been emailed. Anything
-- accepted → 'sent', even if some batches failed: retrying would email the
-- accepted recipients a second time, so the partial failure is recorded in
-- send_error instead.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_campaign_finish_send(p_campaign_id uuid, p_sent_count integer, p_error text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  if coalesce(p_sent_count, 0) <= 0 then
    update vd_email_campaigns
    set status = 'draft', send_error = coalesce(p_error, 'no recipients were sent'), updated_at = now()
    where id = p_campaign_id and status = 'sending';
  else
    update vd_email_campaigns
    set status = 'sent', sent_at = now(), audience_count_snapshot = p_sent_count,
        send_error = p_error, updated_at = now()
    where id = p_campaign_id and status = 'sending';
  end if;

  if not found then
    raise exception 'campaign is not sending';
  end if;
end;
$$;
revoke execute on function public.vd_campaign_finish_send(uuid, integer, text) from public;
grant execute on function public.vd_campaign_finish_send(uuid, integer, text) to authenticated;

-- The webhook (app/api/webhooks/brevo) dedupes on Brevo's message id + event.
alter table vd_email_events add column if not exists provider_message_id text;
create unique index if not exists vd_email_events_provider_uniq
  on vd_email_events (provider_message_id, event_type, email)
  where provider_message_id is not null;
