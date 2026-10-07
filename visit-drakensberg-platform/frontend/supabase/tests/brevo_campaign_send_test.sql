-- ============================================================================
-- Real campaign sends — claim once, honour the consent log, admin only
--
-- See supabase/migrations/20261008_brevo_campaign_send.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin      uuid;
  v_customer   uuid;
  v_in         uuid;
  v_in_2       uuid;
  v_unsubbed   uuid;
  v_no_consent uuid;
  v_supplier   uuid;
  v_template   uuid;
  v_campaign   uuid;
  v_emails     text[];
begin
  raise notice 'brevo campaign send';

  v_admin      := vdtest.make_user('send-admin@example.test', 'admin');
  v_customer   := vdtest.make_user('send-nosy@example.test', 'visitor');
  v_in         := vdtest.make_user('Send-In@Example.test', 'visitor');
  v_in_2       := vdtest.make_user('send-in2@example.test', 'visitor');
  v_unsubbed   := vdtest.make_user('send-unsub@example.test', 'visitor');
  v_no_consent := vdtest.make_user('send-no@example.test', 'visitor');
  v_supplier   := vdtest.make_user('send-supplier@example.test', 'supplier');

  perform vdtest.act_as_nobody();
  insert into vd_customer_profiles (user_id, marketing_consent) values
    (v_in, true), (v_in_2, true), (v_unsubbed, true), (v_no_consent, false), (v_supplier, true)
  on conflict (user_id) do update set marketing_consent = excluded.marketing_consent;
  -- An anonymous /unsubscribe: the log says no, the cached flag still says yes.
  insert into vd_customer_consents (email, consent_type, granted, source)
  values ('send-unsub@example.test', 'marketing_email', false, 'unsubscribe_link');

  perform vdtest.act_as(v_admin);
  insert into vd_email_templates (name, subject) values ('T', 'Hello') returning id into v_template;

  -- ── Recipients ────────────────────────────────────────────────────────────
  insert into vd_email_campaigns (name, template_id, audience_mode, recipient_user_ids)
  values ('Picked', v_template, 'manual', array[v_in, v_in_2, v_unsubbed, v_no_consent, v_supplier])
  returning id into v_campaign;

  select array_agg(email order by email) into v_emails from vd_campaign_begin_send(v_campaign);
  perform vdtest.eq(v_emails, array['send-in2@example.test', 'send-in@example.test'],
    'only consented, non-staff, not-unsubscribed recipients, lower-cased');
  perform vdtest.eq((select status from vd_email_campaigns where id = v_campaign), 'sending',
    'begin claims the campaign');
  perform vdtest.eq((select dry_run from vd_email_campaigns where id = v_campaign), false,
    'a real send is not a dry run');

  perform vdtest.raises(format('select * from vd_campaign_begin_send(%L)', v_campaign),
    'not in a sendable state', 'a campaign cannot be claimed twice');

  perform vd_campaign_finish_send(v_campaign, 2, null);
  perform vdtest.eq((select status from vd_email_campaigns where id = v_campaign), 'sent', 'finish marks it sent');
  perform vdtest.eq((select audience_count_snapshot from vd_email_campaigns where id = v_campaign), 2,
    'the snapshot is the sent count');
  perform vdtest.raises(format('select vd_campaign_finish_send(%L, 1, null)', v_campaign),
    'not sending', 'finish only applies to a campaign mid-send');

  -- ── Nothing accepted → back to draft ──────────────────────────────────────
  insert into vd_email_campaigns (name, template_id) values ('Broadcast', v_template)
  returning id into v_campaign;
  perform count(*) from vd_campaign_begin_send(v_campaign);
  perform vd_campaign_finish_send(v_campaign, 0, 'Brevo 401: Key not found');
  perform vdtest.eq((select status from vd_email_campaigns where id = v_campaign), 'draft',
    'a send nobody received returns to draft');
  perform vdtest.eq((select send_error from vd_email_campaigns where id = v_campaign), 'Brevo 401: Key not found',
    'and keeps the error');

  -- ── Preconditions ─────────────────────────────────────────────────────────
  insert into vd_email_campaigns (name) values ('No template') returning id into v_campaign;
  perform vdtest.raises(format('select * from vd_campaign_begin_send(%L)', v_campaign),
    'no template', 'a campaign without a template cannot be sent');

  -- ── Admin only ────────────────────────────────────────────────────────────
  insert into vd_email_campaigns (name, template_id) values ('Guarded', v_template) returning id into v_campaign;
  perform vdtest.act_as(v_customer);
  perform vdtest.raises(format('select * from vd_campaign_begin_send(%L)', v_campaign),
    'admin only', 'a customer cannot send or read the audience');
  perform vdtest.raises(format('select vd_campaign_finish_send(%L, 1, null)', v_campaign),
    'admin only', 'a customer cannot record an outcome');
  perform vdtest.act_as_nobody();
  perform vdtest.raises(format('select * from vd_campaign_begin_send(%L)', v_campaign),
    'admin only', 'no JWT is refused');

  raise notice 'brevo campaign send: all assertions passed';
end $$;
