-- ============================================================================
-- Marketing send pipeline — consent, audience, queue, webhook
--
-- See supabase/migrations/20261007_marketing_send_pipeline.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin      uuid;
  v_visitor    uuid;
  v_in         uuid;
  v_in2        uuid;
  v_out        uuid;
  v_tpl        uuid;
  v_campaign   uuid;
  v_n          int;
  v_claim      record;
  v_stats      jsonb;
begin
  raise notice 'marketing send pipeline';

  v_admin   := vdtest.make_user('pipe-admin@example.test', 'admin');
  v_visitor := vdtest.make_user('pipe-visitor@example.test', 'visitor');
  v_in      := vdtest.make_user('pipe-in@example.test', 'visitor');
  v_in2     := vdtest.make_user('pipe-in2@example.test', 'visitor');
  v_out     := vdtest.make_user('pipe-out@example.test', 'visitor');

  perform vdtest.act_as_nobody();
  insert into vd_customer_profiles (user_id, marketing_consent) values
    (v_in, true), (v_in2, true), (v_out, false)
  on conflict (user_id) do update set marketing_consent = excluded.marketing_consent;

  -- ── Consent hardening ─────────────────────────────────────────────────────
  perform vdtest.raises(
    $q$select vd_set_consent('victim@example.test', 'marketing_email', true, 'forged')$q$,
    'sign in', 'an anonymous caller can no longer subscribe someone else');
  perform vdtest.raises(
    $q$select vd_set_consent('victim@example.test', 'marketing_email', false, 'forged')$q$,
    'sign in', 'nor unsubscribe them');
  -- EXECUTE grants are not exercised by the act_as shim (it flips GUCs, not
  -- Postgres roles), so the grant-only functions are checked directly.
  perform vdtest.ok(not has_function_privilege('anon', 'vd_is_subscribed(text,text)', 'execute'),
    'anon cannot probe whether an address is on the list');
  perform vdtest.ok(not has_function_privilege('authenticated', 'vd_is_subscribed(text,text)', 'execute'),
    'a signed-in customer cannot probe the list either');
  perform vdtest.ok(has_function_privilege('service_role', 'vd_is_subscribed(text,text)', 'execute'),
    'the server can');
  perform vdtest.ok(not has_function_privilege('anon', 'vd_set_consent(text,text,boolean,text)', 'execute'),
    'anon has no EXECUTE on vd_set_consent at all');
  perform vdtest.ok(not has_function_privilege('authenticated', 'vd_marketing_audience(text,uuid[],boolean)', 'execute'),
    'the audience resolver is not callable by customers or admins in the browser');
  perform vdtest.ok(not has_function_privilege('authenticated', 'vd_campaign_claim_batch(integer)', 'execute'),
    'only the worker can claim sends');

  perform vdtest.act_as(v_visitor);
  perform vdtest.raises(
    $q$select vd_record_marketing_consent('someone@example.test', true, 'x')$q$,
    'service role only', 'a signed-in customer cannot use the service-only recorder');
  perform vdtest.act_as(v_visitor);
  perform vd_set_consent('whatever@example.test', 'marketing_email', true, 'registration');
  perform vdtest.ok(
    (select marketing_consent from vd_customer_profiles where user_id = v_visitor),
    'a signed-in customer opts themselves in (email forced to their own account)');
  perform vdtest.eq(
    (select email from vd_customer_consents where source = 'registration' order by id desc limit 1),
    'pipe-visitor@example.test', 'the consent row is for their own address, not the one they typed');

  -- ── Audience: accounts + newsletter-only subscribers ──────────────────────
  perform vdtest.act_as_service();
  perform vd_record_marketing_consent('News.Only@Example.test', true, 'newsletter_footer');
  perform vd_record_marketing_consent('lapsed@example.test', true, 'newsletter_footer');
  perform vd_record_marketing_consent('lapsed@example.test', false, 'unsubscribe_link');

  perform vdtest.act_as(v_admin);
  v_n := vd_count_consented_audience(null);
  perform vdtest.eq(v_n, 4, 'the whole audience = 3 consented accounts + 1 newsletter-only address');
  perform vdtest.eq(vd_count_consented_recipients(array[v_in, v_out]), 1, 'a pick still needs consent');

  perform vdtest.act_as_service();
  perform vdtest.ok(
    exists (select 1 from vd_marketing_audience(null, null, false) where email = 'news.only@example.test' and user_id is null),
    'the newsletter-only address is in the audience, lower-cased');
  perform vdtest.ok(
    not exists (select 1 from vd_marketing_audience(null, null, false) where email = 'lapsed@example.test'),
    'an address whose latest decision is "no" is out');

  -- Unsubscribing an ACCOUNT holder by email must clear their cached flag.
  perform vd_record_marketing_consent('PIPE-IN2@example.test', false, 'unsubscribe_link');
  perform vdtest.ok(
    not (select marketing_consent from vd_customer_profiles where user_id = v_in2),
    'an email-based opt-out clears the account holder''s marketing_consent');
  perform vd_record_marketing_consent('pipe-in2@example.test', true, 'registration');

  -- ── Enqueue ───────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  insert into vd_email_templates (name, subject, html_body) values ('T', 'Hello {{first_name|there}}', '<p>Hi</p>')
  returning id into v_tpl;
  insert into vd_email_campaigns (name, template_id) values ('Broadcast', v_tpl) returning id into v_campaign;

  perform vdtest.act_as(v_visitor);
  perform vdtest.raises(
    format('select vd_campaign_enqueue(%L)', v_campaign), 'admin only', 'a customer cannot start a send');

  perform vdtest.act_as(v_admin);
  v_n := vd_campaign_enqueue(v_campaign);
  perform vdtest.eq(v_n, 4, 'enqueue queued the full consented audience (3 accounts + 1 newsletter-only address)');
  perform vdtest.eq((select status from vd_email_campaigns where id = v_campaign), 'sending', 'campaign is now sending');
  perform vdtest.ok(not (select dry_run from vd_email_campaigns where id = v_campaign), 'and no longer a dry run');
  perform vdtest.raises(
    format('select vd_campaign_enqueue(%L)', v_campaign), 'not in a sendable state', 'a send cannot be started twice');

  -- A template-less campaign is refused.
  insert into vd_email_campaigns (name) values ('No template') returning id into v_campaign;
  perform vdtest.raises(
    format('select vd_campaign_enqueue(%L)', v_campaign), 'no template', 'no template, no send');

  -- ── Claim ─────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  perform vdtest.raises('select * from vd_campaign_claim_batch(10)', 'service role only', 'an admin cannot claim as the worker');

  perform vdtest.act_as_service();
  -- One recipient withdraws consent between enqueue and send.
  perform vd_record_marketing_consent('pipe-in@example.test', false, 'unsubscribe_link');
  -- One address hard-bounces.
  perform vd_email_record_event('k-bounce', 'bounced', 'news.only@example.test', null, '{}', now());

  select count(*) into v_n from vd_campaign_claim_batch(10);
  perform vdtest.eq(v_n, 2, 'the unsubscribed and the suppressed addresses were not claimed');
  perform vdtest.eq(
    (select count(*)::int from vd_campaign_recipients where status = 'suppressed'), 2,
    'both are recorded as suppressed, not silently dropped');
  select count(*) into v_n from vd_campaign_claim_batch(10);
  perform vdtest.eq(v_n, 0, 'claimed rows are not handed out twice');

  -- ── Results ───────────────────────────────────────────────────────────────
  for v_claim in select id, attempts from vd_campaign_recipients where status = 'sending' order by id limit 1 loop
    perform vd_campaign_mark_recipient(v_claim.id, true, '<msg-1@brevo>', null, false);
  end loop;
  perform vdtest.eq((select count(*)::int from vd_campaign_recipients where status = 'sent'), 1, 'a success is recorded');

  perform vd_campaign_mark_recipient(
    (select id from vd_campaign_recipients where status = 'sending'), false, null, 'timeout', true);
  perform vdtest.eq((select count(*)::int from vd_campaign_recipients where status = 'queued'), 1,
    'a retryable failure goes back on the queue');

  select count(*) into v_n from vd_campaign_claim_batch(10);
  perform vd_campaign_mark_recipient(
    (select id from vd_campaign_recipients where status = 'sending'), false, null, 'rejected', false);
  perform vdtest.eq((select count(*)::int from vd_campaign_recipients where status = 'failed'), 1,
    'a permanent failure is final');

  perform vdtest.eq(vd_campaign_finalize(), 1, 'a drained campaign is finalized');
  perform vdtest.eq(
    (select status from vd_email_campaigns where name = 'Broadcast'), 'sent', 'and reads as sent');

  -- ── Webhook ───────────────────────────────────────────────────────────────
  perform vdtest.ok(
    vd_email_record_event('k-open-1', 'opened', 'pipe-visitor@example.test', '<msg-1@brevo>', '{}', now()),
    'a new event is applied');
  perform vdtest.ok(
    not vd_email_record_event('k-open-1', 'opened', 'pipe-visitor@example.test', '<msg-1@brevo>', '{}', now()),
    'the same event redelivered is a no-op');
  perform vdtest.ok(
    not vd_email_record_event('k-weird', 'exploded', 'pipe-visitor@example.test', null, '{}', now()),
    'an unknown event type is ignored');

  perform vdtest.ok(
    exists (select 1 from vd_email_suppressions where email = 'news.only@example.test' and reason = 'hard_bounce'),
    'a hard bounce suppresses the address');

  perform vd_email_record_event('k-spam', 'complaint', 'pipe-in2@example.test', null, '{}', now());
  perform vdtest.ok(
    not (select marketing_consent from vd_customer_profiles where user_id = v_in2),
    'a spam complaint withdraws consent');
  perform vdtest.ok(
    exists (select 1 from vd_email_suppressions where email = 'pipe-in2@example.test' and reason = 'spam_complaint'),
    'and suppresses the address');

  -- Suppression is sticky: a fresh "yes" does not lift it.
  perform vd_record_marketing_consent('news.only@example.test', true, 'newsletter_footer');
  perform vdtest.ok(
    not exists (select 1 from vd_marketing_audience(null, null, false) where email = 'news.only@example.test'),
    'a bounced address stays out even after re-subscribing');

  -- ── Suppressions are not writable from the browser ────────────────────────
  -- Real Postgres role switch, so RLS applies (superusers bypass it).
  perform vdtest.act_as(v_admin);
  set local role authenticated;
  perform vdtest.raises(
    $q$insert into vd_email_suppressions (email, reason) values ('x@example.test', 'manual')$q$,
    'row-level security', 'not even an admin can edit suppressions through the client');
  perform vdtest.ok(exists (select 1 from vd_email_suppressions), 'but an admin can read them');
  perform vdtest.act_as(v_visitor);
  perform vdtest.ok(not exists (select 1 from vd_email_suppressions), 'and a customer sees none');
  perform vdtest.ok(not exists (select 1 from vd_campaign_recipients), 'nor any recipient list');
  reset role;
  perform vdtest.act_as(v_admin);

  -- ── Stats ─────────────────────────────────────────────────────────────────
  v_stats := vd_campaign_stats((select id from vd_email_campaigns where name = 'Broadcast'));
  perform vdtest.eq((v_stats->'recipients'->>'sent')::int, 1, 'stats report the recipient breakdown');
  perform vdtest.eq((v_stats->'events'->>'opened')::int, 1, 'and de-duplicated engagement');
  perform vdtest.act_as(v_visitor);
  perform vdtest.raises(
    format('select vd_campaign_stats(%L)', (select id from vd_email_campaigns where name = 'Broadcast')),
    'admin only', 'customers cannot read campaign stats');

  raise notice 'marketing send pipeline: all assertions passed';
end $$;
