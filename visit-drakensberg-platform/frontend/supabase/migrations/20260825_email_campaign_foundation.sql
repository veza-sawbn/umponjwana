-- ============================================================================
-- Visit Drakensberg — Email Campaign Foundation (Phase 5)
--
-- Customer Intelligence handoff §10/§11 "Email Campaign System" /
-- "Campaign Types". Purely additive — no existing table touched.
--
-- What this adds:
--   1. vd_email_templates    reusable subject/body templates.
--   2. vd_email_campaigns    a campaign: template + audience + status.
--   3. vd_email_events       schema-ready for a real ESP's webhook
--                             (sent/delivered/bounced/opened/clicked/
--                             unsubscribed) — nothing writes to it yet.
--   4. vd_campaign_dry_run_send()   the only "send" path that exists right
--      now. lib/mailer.ts is a personal SMTP mailbox, not a marketing ESP —
--      no bounce/open/click webhooks, real deliverability/suspension risk
--      at any real send volume, and no provider-side suppression-list
--      enforcement. Rather than point bulk sends at it, this RPC resolves
--      the real, marketing-consented audience, records the outcome
--      (status='dry_run_sent', audience count), and sends nothing. The
--      admin UI labels this honestly as a dry run throughout — see
--      docs/customer-intelligence/ARCHITECTURE_AUDIT.md for the ESP
--      decision this is deliberately deferred behind.
--
-- Audience resolution always requires marketing_consent = true, regardless
-- of which segment (if any) is targeted — this system is exclusively for
-- promotional campaigns. Transactional trip communication (booking
-- confirmations, pre-trip prep) is a different system (handoff §12-15,
-- Phase 6) and is never gated by marketing consent — see §22's
-- transactional/promotional distinction.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. vd_email_templates
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null default '',
  preheader   text not null default '',
  html_body   text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vd_email_templates_created_idx on vd_email_templates (created_at desc);

alter table vd_email_templates enable row level security;
drop policy if exists "Admins manage email templates" on vd_email_templates;
create policy "Admins manage email templates" on vd_email_templates for all using (is_admin());
-- Internal admin tooling only — no customer or supplier ever reads this
-- table, so unlike most tables in this schema there's no owner/participant
-- policy alongside the admin one.

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_email_campaigns
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_email_campaigns (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  -- broadcast | segmented | behavioral | lifecycle (handoff §11) — behavioral
  -- and lifecycle campaigns are trigger-driven (Phase 6's automation engine)
  -- rather than admin-sent from here, but share this table so campaign
  -- history/reporting is one place regardless of how a send was initiated.
  campaign_type          text not null default 'broadcast'
                           check (campaign_type in ('broadcast', 'segmented', 'behavioral', 'lifecycle')),
  template_id            uuid references vd_email_templates(id) on delete set null,
  -- null = every marketing-consented customer; set = that segment,
  -- intersected with marketing_consent regardless.
  audience_segment_id    text references vd_customer_segments(id) on delete set null,
  status                 text not null default 'draft'
                           check (status in ('draft', 'scheduled', 'dry_run_sent', 'sent', 'paused', 'cancelled')),
  scheduled_at           timestamptz,
  sent_at                timestamptz,
  -- Always true until a real ESP is wired — see the migration header. Kept
  -- as an explicit column (not inferred from status) so the UI never has to
  -- guess whether a 'sent' status means a real send happened.
  dry_run                boolean not null default true,
  audience_count_snapshot integer,
  notes                  text not null default '',
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists vd_email_campaigns_status_idx  on vd_email_campaigns (status);
create index if not exists vd_email_campaigns_created_idx on vd_email_campaigns (created_at desc);

alter table vd_email_campaigns enable row level security;
drop policy if exists "Admins manage email campaigns" on vd_email_campaigns;
create policy "Admins manage email campaigns" on vd_email_campaigns for all using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 3. vd_email_events — schema-ready, unused until a real ESP's webhook
--    writes to it (service role, same pattern as booking_completed in
--    app/api/payments/ikhokha/webhook/route.ts). No client insert path.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_email_events (
  id           bigint generated always as identity primary key,
  campaign_id  uuid references vd_email_campaigns(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  email        text not null,
  event_type   text not null check (event_type in ('sent', 'delivered', 'bounced', 'opened', 'clicked', 'unsubscribed')),
  occurred_at  timestamptz not null default now(),
  metadata     jsonb not null default '{}'::jsonb
);
create index if not exists vd_email_events_campaign_idx on vd_email_events (campaign_id, event_type);
create index if not exists vd_email_events_user_idx     on vd_email_events (user_id);

alter table vd_email_events enable row level security;
drop policy if exists "Admins read email events" on vd_email_events;
create policy "Admins read email events" on vd_email_events for select using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Audience resolution + vd_campaign_dry_run_send() — the only "send"
--    action that exists today.
-- ────────────────────────────────────────────────────────────────────────────

-- Marketing-consented customers, optionally narrowed to one segment. Never
-- anything but consented recipients — see the migration header. A plain
-- count query, done server-side so the admin builder's live "N recipients"
-- preview never needs to pull membership rows to the client just to count
-- them (and so it's correct at any table size, no pagination needed).
--
-- Admin-gated like every other function in this file: as SECURITY DEFINER
-- it runs with the owner's privileges and so bypasses the admin-only RLS on
-- vd_customer_profiles/vd_customer_segment_members entirely — without an
-- explicit is_admin() check, any authenticated (and, since Postgres grants
-- EXECUTE to PUBLIC by default on new functions, actually any anonymous)
-- caller could use it to read aggregate marketing-consent and segment-size
-- counts straight through the RLS that's supposed to keep that admin-only.
create or replace function public.vd_count_consented_audience(p_segment_id text default null)
returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  if p_segment_id is not null then
    select count(*)::integer into v_count
    from vd_customer_segment_members m
    join vd_customer_profiles cp on cp.user_id = m.user_id and cp.marketing_consent
    where m.segment_id = p_segment_id;
  else
    select count(*)::integer into v_count from vd_customer_profiles cp where cp.marketing_consent;
  end if;

  return v_count;
end;
$$;
grant execute on function public.vd_count_consented_audience(text) to authenticated;

create or replace function public.vd_campaign_dry_run_send(p_campaign_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_campaign vd_email_campaigns%rowtype;
  v_count integer;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  select * into v_campaign from vd_email_campaigns where id = p_campaign_id;
  if v_campaign.id is null then
    raise exception 'campaign not found';
  end if;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'campaign is not in a sendable state (status: %)', v_campaign.status;
  end if;

  v_count := vd_count_consented_audience(v_campaign.audience_segment_id);

  update vd_email_campaigns
  set status = 'dry_run_sent', dry_run = true, sent_at = now(), audience_count_snapshot = v_count, updated_at = now()
  where id = p_campaign_id;

  return v_count;
end;
$$;
grant execute on function public.vd_campaign_dry_run_send(uuid) to authenticated;
