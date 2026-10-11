-- ============================================================================
-- Campaign send recovery — a dry run doesn't block a real send, and a send
-- that was cut off can be closed out without being sent twice
--
-- See supabase/migrations/20261012_campaign_send_recovery.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin    uuid;
  v_customer uuid;
  v_in       uuid;
  v_in_2     uuid;
  v_template uuid;
  v_campaign uuid;
  v_n        int;
begin
  raise notice 'campaign send recovery';

  v_admin    := vdtest.make_user('rec-admin@example.test', 'admin');
  v_customer := vdtest.make_user('rec-nosy@example.test', 'visitor');
  v_in       := vdtest.make_user('rec-in@example.test', 'visitor');
  v_in_2     := vdtest.make_user('rec-in2@example.test', 'visitor');

  perform vdtest.act_as_nobody();
  insert into vd_customer_profiles (user_id, marketing_consent) values (v_in, true), (v_in_2, true)
  on conflict (user_id) do update set marketing_consent = excluded.marketing_consent;

  perform vdtest.act_as(v_admin);
  insert into vd_email_templates (name, subject) values ('T', 'Hello') returning id into v_template;

  -- ── Dry run, then the real send ───────────────────────────────────────────
  insert into vd_email_campaigns (name, template_id, audience_mode, recipient_user_ids)
  values ('Checked first', v_template, 'manual', array[v_in, v_in_2])
  returning id into v_campaign;
  perform vd_campaign_dry_run_send(v_campaign);
  perform vdtest.eq((select status from vd_email_campaigns where id = v_campaign), 'dry_run_sent', 'dry run recorded');
  select count(*) into v_n from vd_campaign_begin_send(v_campaign);
  perform vdtest.eq(v_n, 2, 'a dry-run campaign can still be sent for real');

  -- ── A send that stopped part-way ──────────────────────────────────────────
  -- It is still 'sending'. One batch was logged before it died.
  perform vdtest.raises(format('select vd_campaign_release_stuck(%L)', v_campaign),
    'not stuck', 'a send that may still be running cannot be released');

  perform vdtest.act_as_service();
  insert into vd_email_events (campaign_id, user_id, email, event_type)
  values (v_campaign, v_in, 'rec-in@example.test', 'sent');
  update vd_email_campaigns set updated_at = now() - interval '11 minutes' where id = v_campaign;

  perform vdtest.act_as(v_customer);
  perform vdtest.raises(format('select vd_campaign_release_stuck(%L)', v_campaign),
    'admin only', 'a customer cannot release a send');

  perform vdtest.act_as(v_admin);
  perform vdtest.eq(vd_campaign_release_stuck(v_campaign), 1, 'release reports the recorded sends');
  perform vdtest.eq((select status from vd_email_campaigns where id = v_campaign), 'sent',
    'a released send is closed as sent, never back to draft');
  perform vdtest.eq((select audience_count_snapshot from vd_email_campaigns where id = v_campaign), 1,
    'the snapshot is the recorded count');
  perform vdtest.ok((select send_error from vd_email_campaigns where id = v_campaign) like '%interrupted%',
    'the campaign says it was interrupted');
  perform vdtest.raises(format('select * from vd_campaign_begin_send(%L)', v_campaign),
    'not in a sendable state', 'a released campaign cannot be sent again');

  raise notice 'campaign send recovery: all assertions passed';
end $$;
