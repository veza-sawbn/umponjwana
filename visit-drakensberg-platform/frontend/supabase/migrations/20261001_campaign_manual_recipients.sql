-- ============================================================================
-- Visit Drakensberg — Hand-picked campaign recipients + campaign merge fields
--
-- Purely additive: three columns on vd_email_campaigns with defaults that
-- keep every existing campaign behaving exactly as it does today, one new
-- admin-only count function, and vd_campaign_dry_run_send() redefined to
-- honour the new audience mode.
--
-- WHAT THIS ADDS:
--   audience_mode       'segment' (today's behaviour: everyone consented, or
--                       one segment) | 'manual' (an explicit list of people
--                       the admin ticked in the builder).
--   recipient_user_ids  the hand-picked list. Ignored unless audience_mode =
--                       'manual'.
--   merge_values        campaign-level details ({"offer": "...", "promo_code":
--                       "..."}) that the merge-tag engine (lib/email-merge-tags.ts)
--                       fills into {{offer}}, {{promo_code}} alongside each
--                       recipient's own profile fields.
--
-- CONSENT IS STILL NOT OPTIONAL:
--   Picking someone by hand does not make a promotional email to them lawful.
--   A manual list is intersected with marketing_consent at send time exactly
--   as a segment is — the builder only offers consented customers, but a
--   customer can withdraw consent between the pick and the send, and the
--   server is the place that has to get that right.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

alter table vd_email_campaigns
  add column if not exists audience_mode text not null default 'segment'
    check (audience_mode in ('segment', 'manual')),
  add column if not exists recipient_user_ids uuid[] not null default '{}',
  add column if not exists merge_values jsonb not null default '{}'::jsonb;

comment on column vd_email_campaigns.audience_mode is
  'segment = audience_segment_id (null = all consented); manual = recipient_user_ids. Both are intersected with marketing_consent at send.';
comment on column vd_email_campaigns.recipient_user_ids is
  'Hand-picked recipients for audience_mode = manual. Never sent to without a current marketing_consent.';
comment on column vd_email_campaigns.merge_values is
  'Campaign-level merge fields, e.g. {"offer":"Winter midweek","promo_code":"BERG20"}, rendered as {{offer}} etc.';

-- Consented count for a hand-picked list. Admin-gated for the same reason as
-- vd_count_consented_audience (see 20260825_email_campaign_foundation.sql):
-- as SECURITY DEFINER it reads straight through admin-only RLS.
create or replace function public.vd_count_consented_recipients(p_user_ids uuid[])
returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;

  select count(distinct cp.user_id)::integer into v_count
  from vd_customer_profiles cp
  where cp.marketing_consent and cp.user_id = any(coalesce(p_user_ids, '{}'::uuid[]));

  return v_count;
end;
$$;
revoke execute on function public.vd_count_consented_recipients(uuid[]) from public;
grant execute on function public.vd_count_consented_recipients(uuid[]) to authenticated;

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

  select * into v_campaign from vd_email_campaigns where id = p_campaign_id;
  if v_campaign.id is null then
    raise exception 'campaign not found';
  end if;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'campaign is not in a sendable state (status: %)', v_campaign.status;
  end if;

  if v_campaign.audience_mode = 'manual' then
    if coalesce(cardinality(v_campaign.recipient_user_ids), 0) = 0 then
      raise exception 'no recipients selected';
    end if;
    v_count := vd_count_consented_recipients(v_campaign.recipient_user_ids);
  else
    v_count := vd_count_consented_audience(v_campaign.audience_segment_id);
  end if;

  update vd_email_campaigns
  set status = 'dry_run_sent', dry_run = true, sent_at = now(), audience_count_snapshot = v_count, updated_at = now()
  where id = p_campaign_id;

  return v_count;
end;
$$;
grant execute on function public.vd_campaign_dry_run_send(uuid) to authenticated;
