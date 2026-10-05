-- ============================================================================
-- Hand-picked campaign recipients — consent still decides who is counted
--
-- See supabase/migrations/20261001_campaign_manual_recipients.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin      uuid;
  v_customer   uuid;
  v_opted_in   uuid;
  v_opted_in_2 uuid;
  v_opted_out  uuid;
  v_campaign   uuid;
  v_count      int;
begin
  raise notice 'campaign manual recipients';

  v_admin      := vdtest.make_user('mkt-admin@example.test', 'admin');
  v_customer   := vdtest.make_user('mkt-nosy@example.test', 'visitor');
  v_opted_in   := vdtest.make_user('mkt-in@example.test', 'visitor');
  v_opted_in_2 := vdtest.make_user('mkt-in2@example.test', 'visitor');
  v_opted_out  := vdtest.make_user('mkt-out@example.test', 'visitor');

  -- Fixture rows written directly (acting as nobody), not through
  -- vd_set_consent(), so the test doesn't depend on that function's own rules.
  perform vdtest.act_as_nobody();
  insert into vd_customer_profiles (user_id, marketing_consent) values
    (v_opted_in, true), (v_opted_in_2, true), (v_opted_out, false)
  on conflict (user_id) do update set marketing_consent = excluded.marketing_consent;

  -- ── Counting ──────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  v_count := vd_count_consented_recipients(array[v_opted_in, v_opted_out, v_opted_in, v_opted_in_2]);
  perform vdtest.eq(v_count, 2, 'only consented picks are counted, once each');
  perform vdtest.eq(vd_count_consented_recipients('{}'::uuid[]), 0, 'an empty pick counts nobody');

  perform vdtest.act_as(v_customer);
  perform vdtest.raises(
    format('select vd_count_consented_recipients(array[%L]::uuid[])', v_opted_in),
    'admin only', 'a customer cannot probe who has consented');
  perform vdtest.act_as_nobody();
  perform vdtest.raises(
    format('select vd_count_consented_recipients(array[%L]::uuid[])', v_opted_in),
    'admin only', 'no JWT is refused, not admitted');

  -- ── Dry-run send of a manual campaign ─────────────────────────────────────
  perform vdtest.act_as(v_admin);
  insert into vd_email_campaigns (name, audience_mode, recipient_user_ids)
  values ('Picked', 'manual', array[v_opted_in, v_opted_out])
  returning id into v_campaign;

  v_count := vd_campaign_dry_run_send(v_campaign);
  perform vdtest.eq(v_count, 1, 'a manual send skips a pick without consent');
  perform vdtest.eq(
    (select audience_count_snapshot from vd_email_campaigns where id = v_campaign), 1,
    'the snapshot records the consented count');

  insert into vd_email_campaigns (name, audience_mode) values ('Empty', 'manual')
  returning id into v_campaign;
  perform vdtest.raises(
    format('select vd_campaign_dry_run_send(%L)', v_campaign),
    'no recipients selected', 'a manual campaign with nobody picked cannot be sent');

  -- ── Existing campaigns are untouched ──────────────────────────────────────
  insert into vd_email_campaigns (name) values ('Legacy broadcast')
  returning id into v_campaign;
  perform vdtest.eq(
    (select audience_mode from vd_email_campaigns where id = v_campaign), 'segment',
    'campaigns default to segment mode');
  perform vdtest.eq(vd_campaign_dry_run_send(v_campaign), vd_count_consented_audience(null),
    'a segment-mode send still counts the whole consented audience');

  perform vdtest.raises(
    format('update vd_email_campaigns set audience_mode = %L where id = %L', 'everyone', v_campaign),
    'check', 'audience_mode is constrained');

  raise notice 'campaign manual recipients: all assertions passed';
end $$;
