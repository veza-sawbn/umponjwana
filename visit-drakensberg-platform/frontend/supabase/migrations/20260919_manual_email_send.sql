-- ============================================================================
-- Visit Drakensberg — Manual recipient send
--
-- Purely additive: one function, one table. No existing table, policy or
-- function is touched, and vd_campaign_dry_run_send() is left exactly as it
-- is — segment-wide campaigns remain a dry run until a real ESP is wired.
--
-- WHAT THIS IS FOR:
--   Hand-picking a handful of recipients and actually sending to them. That
--   is a different risk profile from a segment blast: fifty individually
--   addressed messages through the business mailbox is ordinary business
--   email, whereas the same mailbox pointed at an entire segment is the
--   deliverability problem the 20260825 migration header describes. The send
--   route enforces the cap; this migration gives it the two things it needs
--   to be defensible — a way to ask about consent properly, and a record of
--   what it did.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. vd_consent_state()
--
-- vd_is_subscribed() answers a yes/no question and coalesces a missing record
-- to false. That is right for the unsubscribe page — "are you currently
-- subscribed?" — but it cannot distinguish "this person opted out" from "we
-- have never heard from this address", and those two need opposite treatment:
--
--   * A CUSTOMER is a natural person being sent consumer marketing. That is
--     opt-IN: no record means do not send.
--   * A DIRECTORY CONTACT is a business being approached about listing on the
--     platform. B2B outreach is opt-OUT: no record means the approach has not
--     been refused, and an explicit withdrawal must stop it.
--
-- Same log, same addresses, one extra bit of information. The send route
-- applies the policy; this function only reports the state.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_consent_state(
  p_email text,
  p_consent_type text default 'marketing_email'
)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when granted then 'granted' else 'withdrawn' end
     from vd_customer_consents
     where lower(email) = lower(trim(p_email)) and consent_type = p_consent_type
     order by created_at desc limit 1),
    'unknown'
  )
$$;
-- Boolean-ish and single-address, like vd_is_subscribed — it leaks no row
-- data, so it carries that function's grants rather than an admin gate. The
-- send route is admin-gated separately.
grant execute on function public.vd_consent_state(text, text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vd_email_sends
--
-- One row per recipient per send attempt, including the ones that were
-- skipped and the ones that failed. A send that only recorded its successes
-- would be useless for the two questions actually asked of it later: "did
-- this person ever hear from us?" and "why did this one not go?".
--
-- recipient_id is deliberately NOT a foreign key. It points at either
-- profiles.id or vd_directory_contacts.id depending on recipient_kind, and a
-- contact being deleted from the directory later must not erase the fact that
-- we emailed them.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_email_sends (
  id              uuid primary key default gen_random_uuid(),
  -- Null once a template is deleted; the subject and body sent are captured
  -- below so the record survives that.
  template_id     uuid references vd_email_templates(id) on delete set null,
  -- Set when the send was launched from a campaign rather than ad hoc.
  campaign_id     uuid references vd_email_campaigns(id) on delete set null,
  recipient_email text not null,
  recipient_name  text not null default '',
  recipient_kind  text not null check (recipient_kind in ('customer', 'contact')),
  recipient_id    text,
  subject         text not null default '',
  status          text not null
                    check (status in ('sent', 'skipped_no_consent', 'skipped_opted_out', 'failed')),
  -- The SMTP error, or the reason it was skipped. Empty on success.
  detail          text not null default '',
  sent_by         uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists vd_email_sends_created_idx   on vd_email_sends (created_at desc);
create index if not exists vd_email_sends_email_idx     on vd_email_sends (lower(recipient_email), created_at desc);
create index if not exists vd_email_sends_template_idx  on vd_email_sends (template_id, created_at desc);

alter table vd_email_sends enable row level security;

drop policy if exists "Admins read email sends" on vd_email_sends;
create policy "Admins read email sends" on vd_email_sends for select using (is_admin());
-- No insert/update/delete policy on purpose. Rows are written by the send
-- route using the service role, so nothing client-side can forge a delivery
-- record or quietly remove one — the same reasoning as vd_customer_consents
-- being write-only through vd_set_consent().

comment on table vd_email_sends is
  'Audit trail for manually-addressed sends: one row per recipient per attempt, successes, skips and failures alike.';
