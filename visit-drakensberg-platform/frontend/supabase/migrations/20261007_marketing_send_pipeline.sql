-- ============================================================================
-- Visit Drakensberg — Marketing send pipeline (Brevo)
--
-- Turns the Phase 5 "dry run" campaign system into one that can really send,
-- without weakening any of its consent rules. Run AFTER
-- 20261001_campaign_manual_recipients.sql.
--
-- WHAT THIS ADDS
--   1. vd_email_suppressions      addresses we must never mail again (hard
--                                 bounce, spam complaint, …). Sticky: a later
--                                 "yes" in the consent log does not lift one.
--   2. vd_campaign_recipients     one row per (campaign × address) — the unit
--                                 of work a send is made of. Makes a send
--                                 resumable and idempotent: a crash mid-send,
--                                 or a retried cron, cannot double-send.
--   3. vd_marketing_optins        pending double-opt-in confirmations. Only the
--                                 SHA-256 of the emailed token is stored.
--   4. Audience resolution keyed on the EMAIL ADDRESS (vd_marketing_audience),
--      so newsletter subscribers and anyone else without an account are no
--      longer invisible to campaigns. Segment / hand-picked campaigns remain
--      account-only, because segments are derived from account data.
--   5. Send RPCs: enqueue, claim a batch, mark a result, activate scheduled
--      campaigns, finalize, and record a provider webhook event.
--   6. Consent hardening (see the vd_set_consent notes below).
--
-- CONSENT HARDENING — behaviour changes worth knowing about
--   * vd_set_consent() used to accept an ANONYMOUS "granted = true" for any
--     email. That let anyone subscribe anyone — at bulk volume that is spam
--     complaints and a blocklisted domain. It now refuses anonymous callers
--     outright. Anonymous opt-in goes through the double-opt-in route
--     (/api/marketing/subscribe → emailed link → /api/marketing/confirm), and
--     anonymous opt-OUT through a signed link (/api/unsubscribe). Both run as
--     the service role via vd_record_marketing_consent().
--   * The old anonymous unsubscribe wrote a consent-log row but never cleared
--     vd_customer_profiles.marketing_consent for an account holder, so an
--     unsubscribed customer kept receiving campaigns. vd_record_marketing_consent
--     updates the cached flag for every account with that address.
--   * vd_is_subscribed() let any caller (including anon) test whether an
--     arbitrary address is on the list. It is now service-role only.
--
-- Transactional mail is untouched: nothing here is consulted when sending
-- booking confirmations, invoices, quotes, waivers or password resets.
-- ============================================================================
-- @rollback: additive apart from the vd_set_consent / vd_is_subscribed grants and the status check; to roll back, re-apply those two functions from 20260824_customer_intelligence_foundation.sql and drop the new tables and functions

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Campaign + event table adjustments
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare c record;
begin
  -- The inline CHECKs from 20260825 carry auto-generated names; find them by
  -- definition rather than assuming the name.
  for c in
    select conname from pg_constraint
    where conrelid = 'public.vd_email_campaigns'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%dry_run_sent%'
  loop
    execute format('alter table vd_email_campaigns drop constraint %I', c.conname);
  end loop;
  for c in
    select conname from pg_constraint
    where conrelid = 'public.vd_email_events'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%unsubscribed%'
  loop
    execute format('alter table vd_email_events drop constraint %I', c.conname);
  end loop;
end $$;

alter table vd_email_campaigns
  add constraint vd_email_campaigns_status_check
  check (status in ('draft', 'scheduled', 'sending', 'dry_run_sent', 'sent', 'paused', 'cancelled'));

alter table vd_email_campaigns
  add column if not exists started_at   timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_error   text;

alter table vd_email_events
  add constraint vd_email_events_event_type_check
  check (event_type in (
    'sent', 'delivered', 'bounced', 'soft_bounced', 'blocked', 'invalid', 'deferred',
    'opened', 'clicked', 'unsubscribed', 'complaint'
  ));

alter table vd_email_events
  add column if not exists provider            text,
  add column if not exists provider_message_id text,
  add column if not exists provider_event_key  text;

-- Brevo retries webhooks; the key is what makes a redelivery a no-op.
create unique index if not exists vd_email_events_provider_key_uidx
  on vd_email_events (provider_event_key) where provider_event_key is not null;
create index if not exists vd_email_events_message_idx
  on vd_email_events (provider_message_id) where provider_message_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Suppressions
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists vd_email_suppressions (
  email       text primary key check (email = lower(email)),
  reason      text not null check (reason in ('hard_bounce', 'spam_complaint', 'blocked', 'invalid', 'manual')),
  source      text not null default 'unknown',
  created_at  timestamptz not null default now()
);

alter table vd_email_suppressions enable row level security;
drop policy if exists "Admins read suppressions" on vd_email_suppressions;
create policy "Admins read suppressions" on vd_email_suppressions for select using (coalesce(is_admin(), false));
-- No write policy: rows arrive via vd_email_record_event() (webhook) or an
-- admin using the service role. Marketing must never be able to un-suppress
-- an address from the browser.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Pending double-opt-in confirmations (server only — RLS on, no policies)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists vd_marketing_optins (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (email = lower(email)),
  token_hash    text not null unique,
  source        text not null default 'unknown',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  confirmed_at  timestamptz
);
create index if not exists vd_marketing_optins_email_idx on vd_marketing_optins (email, created_at desc);
alter table vd_marketing_optins enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Per-recipient send state
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists vd_campaign_recipients (
  id                   uuid primary key default gen_random_uuid(),
  campaign_id          uuid not null references vd_email_campaigns(id) on delete cascade,
  email                text not null check (email = lower(email)),
  user_id              uuid references auth.users(id) on delete set null,
  status               text not null default 'queued'
                         check (status in ('queued', 'sending', 'sent', 'failed', 'suppressed', 'bounced', 'complained')),
  attempts             integer not null default 0,
  provider_message_id  text,
  last_error           text,
  claimed_at           timestamptz,
  sent_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists vd_campaign_recipients_campaign_email_uidx
  on vd_campaign_recipients (campaign_id, email);
create index if not exists vd_campaign_recipients_queue_idx
  on vd_campaign_recipients (campaign_id, created_at) where status in ('queued', 'sending');
create index if not exists vd_campaign_recipients_message_idx
  on vd_campaign_recipients (provider_message_id) where provider_message_id is not null;
create index if not exists vd_campaign_recipients_sent_idx
  on vd_campaign_recipients (sent_at) where status = 'sent';

alter table vd_campaign_recipients enable row level security;
drop policy if exists "Admins read campaign recipients" on vd_campaign_recipients;
create policy "Admins read campaign recipients" on vd_campaign_recipients for select using (coalesce(is_admin(), false));

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Consent recording (service role) + hardened client-facing functions
-- ─────────────────────────────────────────────────────────────────────────

-- The one place an anonymous-origin consent decision is written. Called only
-- by server routes that have already proven control of the address (a
-- confirmed opt-in link, or a signed unsubscribe token). Appends to the
-- audit log AND moves the cached flag on every account with that address.
create or replace function public.vd_record_marketing_consent(
  p_email text,
  p_granted boolean,
  p_source text default 'unknown'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  if v_email = '' or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'a valid email is required';
  end if;

  insert into vd_customer_consents (user_id, email, consent_type, granted, source)
  values (null, v_email, 'marketing_email', p_granted, coalesce(p_source, 'unknown'));

  update vd_customer_profiles cp
  set marketing_consent = p_granted, updated_at = now()
  from profiles p
  where p.id = cp.user_id and lower(p.email) = v_email;
end;
$$;
revoke execute on function public.vd_record_marketing_consent(text, boolean, text) from public, anon, authenticated;
grant execute on function public.vd_record_marketing_consent(text, boolean, text) to service_role;

-- Authenticated callers only, and only for their own account (the original
-- body already forced the email to the account's own address). Anonymous
-- callers are refused — see the header.
create or replace function public.vd_set_consent(
  p_email text,
  p_consent_type text,
  p_granted boolean,
  p_source text default 'unknown'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_account_email text;
begin
  if v_user is null then
    raise exception 'sign in, or confirm by email, to change marketing consent';
  end if;

  select email into v_account_email from profiles where id = v_user;
  if v_account_email is not null and v_account_email <> '' then
    v_email := lower(trim(v_account_email));
  end if;

  if v_email = '' or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'a valid email is required';
  end if;
  if p_consent_type is null or p_consent_type = '' then
    raise exception 'consent_type is required';
  end if;

  insert into vd_customer_consents (user_id, email, consent_type, granted, source)
  values (v_user, v_email, p_consent_type, p_granted, coalesce(p_source, 'unknown'));

  if p_consent_type = 'marketing_email' then
    update vd_customer_profiles
    set marketing_consent = p_granted, updated_at = now()
    where user_id = v_user;
  end if;
end;
$$;
revoke execute on function public.vd_set_consent(text, text, boolean, text) from public, anon;
grant execute on function public.vd_set_consent(text, text, boolean, text) to authenticated, service_role;

revoke execute on function public.vd_is_subscribed(text, text) from public, anon, authenticated;
grant execute on function public.vd_is_subscribed(text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Audience resolution
-- ─────────────────────────────────────────────────────────────────────────

-- Is this address allowed to receive promotional mail RIGHT NOW? The same
-- test is applied when a campaign is enqueued and again when each recipient
-- is claimed, because consent can be withdrawn between the two.
create or replace function public.vd_marketing_can_email(p_email text, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    not exists (select 1 from vd_email_suppressions s where s.email = lower(p_email))
    and case
      when p_user_id is not null then
        coalesce((select cp.marketing_consent from vd_customer_profiles cp where cp.user_id = p_user_id), false)
      else
        coalesce((
          select c.granted from vd_customer_consents c
          where lower(c.email) = lower(p_email) and c.consent_type = 'marketing_email'
          order by c.created_at desc, c.id desc limit 1
        ), false)
    end
$$;
revoke execute on function public.vd_marketing_can_email(text, uuid) from public, anon, authenticated;
grant execute on function public.vd_marketing_can_email(text, uuid) to service_role;

-- The audience, as people to mail. One row per address.
--   p_manual = true   → exactly those accounts (hand-picked list)
--   p_segment given   → accounts in that segment
--   neither           → every account with consent, PLUS every address whose
--                       latest consent-log decision is "yes" and which has no
--                       account (newsletter subscribers).
-- Suppressed addresses never appear, in any mode.
create or replace function public.vd_marketing_audience(
  p_segment text default null,
  p_user_ids uuid[] default null,
  p_manual boolean default false
) returns table (email text, user_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  with accounts as (
    select lower(trim(p.email)) as email, cp.user_id, nullif(trim(coalesce(p.full_name, '')), '') as full_name
    from vd_customer_profiles cp
    join profiles p on p.id = cp.user_id
    where cp.marketing_consent
      and coalesce(trim(p.email), '') <> ''
      and (
        case
          when p_manual then cp.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
          when p_segment is not null then exists (
            select 1 from vd_customer_segment_members m
            where m.user_id = cp.user_id and m.segment_id = p_segment)
          else true
        end
      )
  ),
  subscribers as (
    select l.email, null::uuid as user_id, null::text as full_name
    from (
      select distinct on (lower(c.email)) lower(c.email) as email, c.granted
      from vd_customer_consents c
      where not p_manual and p_segment is null
        and c.consent_type = 'marketing_email'
        and not exists (select 1 from profiles p where lower(p.email) = lower(c.email))
      order by lower(c.email), c.created_at desc, c.id desc
    ) l
    where l.granted
  ),
  everyone as (
    select * from accounts
    union all
    select * from subscribers
  )
  select distinct on (e.email) e.email, e.user_id, e.full_name
  from everyone e
  where not exists (select 1 from vd_email_suppressions s where s.email = e.email)
  order by e.email, (e.user_id is null)
$$;
revoke execute on function public.vd_marketing_audience(text, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.vd_marketing_audience(text, uuid[], boolean) to service_role;

-- The builder's live count and the real send now read the same resolver, so
-- the number an admin sees is the number that will be queued.
create or replace function public.vd_count_consented_audience(p_segment_id text default null)
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;
  return (select count(*)::integer from vd_marketing_audience(p_segment_id, null, false));
end;
$$;
grant execute on function public.vd_count_consented_audience(text) to authenticated;

create or replace function public.vd_count_consented_recipients(p_user_ids uuid[])
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;
  return (select count(*)::integer from vd_marketing_audience(null, p_user_ids, true));
end;
$$;
revoke execute on function public.vd_count_consented_recipients(uuid[]) from public;
grant execute on function public.vd_count_consented_recipients(uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Send RPCs
-- ─────────────────────────────────────────────────────────────────────────

-- No auth check: callers are the two wrappers below, which each have one.
create or replace function public.vd_campaign_enqueue_core(p_campaign_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_campaign vd_email_campaigns%rowtype;
  v_count integer;
begin
  select * into v_campaign from vd_email_campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception 'campaign not found';
  end if;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'campaign is not in a sendable state (status: %)', v_campaign.status;
  end if;
  if v_campaign.template_id is null then
    raise exception 'campaign has no template';
  end if;
  if v_campaign.audience_mode = 'manual'
     and coalesce(cardinality(v_campaign.recipient_user_ids), 0) = 0 then
    raise exception 'no recipients selected';
  end if;

  insert into vd_campaign_recipients (campaign_id, email, user_id)
  select p_campaign_id, a.email, a.user_id
  from vd_marketing_audience(
    case when v_campaign.audience_mode = 'segment' then v_campaign.audience_segment_id end,
    case when v_campaign.audience_mode = 'manual' then v_campaign.recipient_user_ids end,
    v_campaign.audience_mode = 'manual'
  ) a
  on conflict (campaign_id, email) do nothing;

  select count(*)::integer into v_count from vd_campaign_recipients where campaign_id = p_campaign_id;
  if v_count = 0 then
    raise exception 'no consented recipients to send to';
  end if;

  update vd_email_campaigns
  set status = 'sending', dry_run = false, started_at = now(), last_error = null,
      audience_count_snapshot = v_count, updated_at = now()
  where id = p_campaign_id;

  return v_count;
end;
$$;
revoke execute on function public.vd_campaign_enqueue_core(uuid) from public, anon, authenticated;

create or replace function public.vd_campaign_enqueue(p_campaign_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not (coalesce(is_admin(), false) or auth.role() = 'service_role') then
    raise exception 'admin only';
  end if;
  return vd_campaign_enqueue_core(p_campaign_id);
end;
$$;
revoke execute on function public.vd_campaign_enqueue(uuid) from public, anon;
grant execute on function public.vd_campaign_enqueue(uuid) to authenticated, service_role;

-- Scheduled campaigns whose time has come. One bad campaign must not stop the
-- others, so each is enqueued in its own sub-transaction and a failure parks
-- that campaign as 'paused' with the reason, rather than retrying forever.
create or replace function public.vd_campaign_activate_due()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_started integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  for r in
    select id from vd_email_campaigns
    where status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()
    order by scheduled_at
  loop
    begin
      perform vd_campaign_enqueue_core(r.id);
      v_started := v_started + 1;
    exception when others then
      update vd_email_campaigns
      set status = 'paused', last_error = left(sqlerrm, 500), updated_at = now()
      where id = r.id;
    end;
  end loop;
  return v_started;
end;
$$;
revoke execute on function public.vd_campaign_activate_due() from public, anon, authenticated;
grant execute on function public.vd_campaign_activate_due() to service_role;

-- Hand the dispatcher its next batch. FOR UPDATE SKIP LOCKED means two
-- overlapping dispatcher runs never claim the same recipient. A recipient
-- stuck in 'sending' for over 10 minutes (the worker died mid-batch) is
-- reclaimed. Consent is re-checked here: anyone who unsubscribed or was
-- suppressed since the campaign was enqueued is marked 'suppressed' instead.
create or replace function public.vd_campaign_claim_batch(p_limit integer default 40)
returns table (recipient_id uuid, campaign_id uuid, email text, user_id uuid, attempts integer)
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  if p_limit is null or p_limit < 1 then
    return;
  end if;

  return query
  with candidate as (
    select r.id
    from vd_campaign_recipients r
    join vd_email_campaigns c on c.id = r.campaign_id and c.status = 'sending'
    where r.status = 'queued'
       or (r.status = 'sending' and r.claimed_at < now() - interval '10 minutes')
    order by c.started_at, r.created_at
    limit p_limit
    for update of r skip locked
  ),
  refused as (
    update vd_campaign_recipients r
    set status = 'suppressed', last_error = 'consent withdrawn or address suppressed', updated_at = now()
    from candidate k
    where r.id = k.id and not vd_marketing_can_email(r.email, r.user_id)
    returning r.id
  ),
  claimed as (
    update vd_campaign_recipients r
    set status = 'sending', claimed_at = now(), attempts = r.attempts + 1, updated_at = now()
    from candidate k
    where r.id = k.id and r.id not in (select id from refused)
    returning r.id, r.campaign_id, r.email, r.user_id, r.attempts
  )
  select cl.id, cl.campaign_id, cl.email, cl.user_id, cl.attempts from claimed cl;
end;
$$;
revoke execute on function public.vd_campaign_claim_batch(integer) from public, anon, authenticated;
grant execute on function public.vd_campaign_claim_batch(integer) to service_role;

-- Record what happened to one recipient. A retryable failure goes back on the
-- queue until it has used 3 attempts.
create or replace function public.vd_campaign_mark_recipient(
  p_recipient_id uuid,
  p_ok boolean,
  p_message_id text default null,
  p_error text default null,
  p_retryable boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_r vd_campaign_recipients%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  select * into v_r from vd_campaign_recipients where id = p_recipient_id for update;
  if v_r.id is null then return; end if;

  if p_ok then
    update vd_campaign_recipients
    set status = 'sent', provider_message_id = p_message_id, sent_at = now(),
        last_error = null, updated_at = now()
    where id = p_recipient_id;
    insert into vd_email_events (campaign_id, user_id, email, event_type, provider, provider_message_id)
    values (v_r.campaign_id, v_r.user_id, v_r.email, 'sent', 'brevo', p_message_id);
  elsif p_retryable and v_r.attempts < 3 then
    update vd_campaign_recipients
    set status = 'queued', last_error = left(p_error, 500), updated_at = now()
    where id = p_recipient_id;
  else
    update vd_campaign_recipients
    set status = 'failed', last_error = left(p_error, 500), updated_at = now()
    where id = p_recipient_id;
  end if;
end;
$$;
revoke execute on function public.vd_campaign_mark_recipient(uuid, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function public.vd_campaign_mark_recipient(uuid, boolean, text, text, boolean) to service_role;

-- Close out campaigns with nothing left to send.
create or replace function public.vd_campaign_finalize()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_done integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  with finished as (
    update vd_email_campaigns c
    set status = 'sent', completed_at = now(), sent_at = coalesce(c.sent_at, now()), updated_at = now()
    where c.status = 'sending'
      and not exists (
        select 1 from vd_campaign_recipients r
        where r.campaign_id = c.id and r.status in ('queued', 'sending'))
    returning c.id
  )
  select count(*)::integer into v_done from finished;
  return v_done;
end;
$$;
revoke execute on function public.vd_campaign_finalize() from public, anon, authenticated;
grant execute on function public.vd_campaign_finalize() to service_role;

-- Park a campaign (e.g. the provider key was rejected) without losing its queue.
create or replace function public.vd_campaign_halt(p_campaign_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  update vd_email_campaigns
  set status = 'paused', last_error = left(p_reason, 500), updated_at = now()
  where id = p_campaign_id and status = 'sending';
  -- Whatever this worker had claimed goes straight back on the queue.
  update vd_campaign_recipients
  set status = 'queued', updated_at = now()
  where campaign_id = p_campaign_id and status = 'sending';
end;
$$;
revoke execute on function public.vd_campaign_halt(uuid, text) from public, anon, authenticated;
grant execute on function public.vd_campaign_halt(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Provider webhook → events, suppressions, consent
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.vd_email_record_event(
  p_event_key text,
  p_event_type text,
  p_email text,
  p_message_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_rec vd_campaign_recipients%rowtype;
  v_inserted integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  if v_email = '' then return false; end if;
  if p_event_type not in (
    'delivered', 'bounced', 'soft_bounced', 'blocked', 'invalid', 'deferred',
    'opened', 'clicked', 'unsubscribed', 'complaint'
  ) then
    return false;
  end if;

  if p_message_id is not null then
    select * into v_rec from vd_campaign_recipients
    where provider_message_id = p_message_id limit 1;
  end if;

  insert into vd_email_events (campaign_id, user_id, email, event_type, occurred_at, metadata,
                               provider, provider_message_id, provider_event_key)
  values (v_rec.campaign_id, v_rec.user_id, v_email, p_event_type, coalesce(p_occurred_at, now()),
          coalesce(p_metadata, '{}'::jsonb), 'brevo', p_message_id, p_event_key)
  on conflict (provider_event_key) where provider_event_key is not null do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;  -- a redelivery we have already applied
  end if;

  -- Hard failures and complaints suppress the ADDRESS, sticky.
  if p_event_type in ('bounced', 'blocked', 'invalid', 'complaint') then
    insert into vd_email_suppressions (email, reason, source)
    values (
      v_email,
      case p_event_type when 'bounced' then 'hard_bounce' when 'complaint' then 'spam_complaint' else p_event_type end,
      'brevo_webhook'
    )
    on conflict (email) do nothing;
    if v_rec.id is not null then
      update vd_campaign_recipients
      set status = case when p_event_type = 'complaint' then 'complained' else 'bounced' end,
          last_error = p_event_type, updated_at = now()
      where id = v_rec.id;
    end if;
  end if;

  -- A complaint or a provider-side unsubscribe is also a withdrawal of consent.
  if p_event_type in ('complaint', 'unsubscribed') then
    insert into vd_customer_consents (user_id, email, consent_type, granted, source)
    values (v_rec.user_id, v_email, 'marketing_email', false,
            case p_event_type when 'complaint' then 'spam_complaint' else 'esp_unsubscribe' end);
    update vd_customer_profiles cp
    set marketing_consent = false, updated_at = now()
    from profiles p
    where p.id = cp.user_id and lower(p.email) = v_email;
  end if;

  return true;
end;
$$;
revoke execute on function public.vd_email_record_event(text, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.vd_email_record_event(text, text, text, text, jsonb, timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Reporting
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.vd_campaign_stats(p_campaign_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_status jsonb;
  v_events jsonb;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_status
  from (select status, count(*) n from vd_campaign_recipients where campaign_id = p_campaign_id group by status) s;

  -- Distinct addresses per event type: a reader opening an email five times is
  -- one open, which is the number that means something.
  select coalesce(jsonb_object_agg(event_type, n), '{}'::jsonb) into v_events
  from (
    select event_type, count(distinct lower(email)) n
    from vd_email_events where campaign_id = p_campaign_id group by event_type
  ) e;

  return jsonb_build_object('recipients', v_status, 'events', v_events);
end;
$$;
revoke execute on function public.vd_campaign_stats(uuid) from public, anon;
grant execute on function public.vd_campaign_stats(uuid) to authenticated;
