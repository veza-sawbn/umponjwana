-- ============================================================================
-- Campaigns to any contact — imported address-book contacts, typed addresses,
-- admin-recorded consent, and the opt-outs that must still win
--
-- See supabase/migrations/20261016_campaign_any_contact.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin    uuid;
  v_customer uuid;
  v_supplier uuid;
  v_cust_in  uuid;
  v_cust_no  uuid;
  v_template uuid;
  v_campaign uuid;
  v_emails   text[];
  v_n        int;
begin
  raise notice 'campaign any contact';

  v_admin    := vdtest.make_user('ac-admin@example.test', 'admin');
  v_customer := vdtest.make_user('ac-nosy@example.test', 'visitor');
  v_supplier := vdtest.make_user('ac-supplier@example.test', 'supplier');
  v_cust_in  := vdtest.make_user('ac-cust-in@example.test', 'visitor');
  v_cust_no  := vdtest.make_user('ac-cust-no@example.test', 'visitor');

  perform vdtest.act_as_nobody();
  insert into vd_customer_profiles (user_id, marketing_consent) values (v_cust_in, true), (v_cust_no, false)
  on conflict (user_id) do update set marketing_consent = excluded.marketing_consent;

  -- A supplier's imported (Wix) address book: no accounts behind these.
  insert into vd_supplier_contacts (supplier_id, customer_user_id, name, email, source) values
    (v_supplier, null, 'Wix Person',  'wix-person@example.test',  'imported'),
    (v_supplier, null, 'Wix Optout',  'wix-optout@example.test',  'imported'),
    (v_supplier, null, null,          'AC-Cust-No@example.test',  'imported'),
    (v_supplier, null, 'Staff Alias', 'ac-supplier@example.test', 'imported');
  insert into vd_customer_consents (email, consent_type, granted, source)
  values ('wix-optout@example.test', 'marketing_email', false, 'unsubscribe_link');

  -- ── The builder's contact list ────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  perform vdtest.eq((select consent from vd_campaign_contacts() where email = 'wix-person@example.test'), 'unknown',
    'an imported contact is listed with no consent on record');
  perform vdtest.eq((select kind from vd_campaign_contacts() where email = 'wix-person@example.test'), 'address_book',
    'and is marked as an address-book contact');
  perform vdtest.eq((select consent from vd_campaign_contacts() where email = 'wix-optout@example.test'), 'opted_out',
    'an opt-out is shown as one');
  perform vdtest.eq((select consent from vd_campaign_contacts() where email = 'ac-cust-in@example.test'), 'opted_in',
    'a consenting customer is opted in');
  perform vdtest.eq((select count(*)::int from vd_campaign_contacts() where email = 'ac-cust-no@example.test'), 1,
    'a customer also in an address book appears once');
  perform vdtest.eq((select kind from vd_campaign_contacts() where email = 'ac-cust-no@example.test'), 'customer',
    'as a customer');
  perform vdtest.eq((select count(*)::int from vd_campaign_contacts() where email in ('ac-supplier@example.test', 'ac-admin@example.test')), 0,
    'staff addresses are never offered, even from an address book');

  perform vdtest.eq((select consent from vd_marketing_consent_status(array['Typed@Example.test']) ), 'unknown',
    'a typed address with no history is unknown');

  -- ── Admin-recorded consent ────────────────────────────────────────────────
  v_n := vd_admin_record_marketing_consent(array['wix-person@example.test', 'wix-optout@example.test', 'ac-cust-in@example.test', 'ac-supplier@example.test', 'typed@example.test']);
  perform vdtest.eq(v_n, 2, 'consent is recorded only for addresses with no choice on record (not opt-outs, not existing opt-ins, not staff)');
  perform vdtest.eq((select consent from vd_campaign_contacts() where email = 'wix-person@example.test'), 'opted_in',
    'the imported contact is now opted in');
  perform vdtest.eq((select consent from vd_campaign_contacts() where email = 'wix-optout@example.test'), 'opted_out',
    'an admin cannot override an opt-out');
  perform vdtest.eq((select recorded_by from vd_customer_consents where email = 'wix-person@example.test' order by id desc limit 1), v_admin,
    'the consent row names the admin who recorded it');

  -- ── Who a hand-picked campaign reaches ────────────────────────────────────
  insert into vd_email_templates (name, subject) values ('T', 'Hello') returning id into v_template;
  insert into vd_email_campaigns (name, template_id, audience_mode, recipient_emails, recipient_user_ids)
  values ('Mixed', v_template, 'manual',
          array['wix-person@example.test', 'WIX-OPTOUT@example.test', 'ac-supplier@example.test', 'never-heard-of@example.test', 'typed@example.test'],
          array[v_cust_in, v_cust_no])
  returning id into v_campaign;

  perform vdtest.eq(vd_campaign_recipient_count(v_campaign), 3, 'the count matches who would be emailed');
  select array_agg(email order by email) into v_emails from vd_campaign_begin_send(v_campaign);
  perform vdtest.eq(v_emails, array['ac-cust-in@example.test', 'typed@example.test', 'wix-person@example.test'],
    'sends to consenting accounts and consenting typed/imported addresses only');
  perform vdtest.eq((select full_name from vd_campaign_recipients(v_campaign) where email = 'wix-person@example.test'), 'Wix Person',
    'an address-book contact keeps its name for merge tags');

  -- ── Dry run counts the same way ───────────────────────────────────────────
  insert into vd_email_campaigns (name, template_id, audience_mode, recipient_emails)
  values ('Dry', v_template, 'manual', array['wix-person@example.test', 'wix-optout@example.test'])
  returning id into v_campaign;
  perform vdtest.eq(vd_campaign_dry_run_send(v_campaign), 1, 'the dry run counts with the same rules');

  -- ── Admin only ────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_customer);
  perform vdtest.raises('select * from vd_campaign_contacts()', 'admin only', 'a customer cannot list contacts');
  perform vdtest.raises($q$select vd_admin_record_marketing_consent(array['x@example.test'])$q$, 'admin only',
    'a customer cannot record consent');
  perform vdtest.raises($q$select * from vd_marketing_consent_status(array['x@example.test'])$q$, 'admin only',
    'a customer cannot probe consent status');
  perform vdtest.eq(has_function_privilege('authenticated', 'public.vd_campaign_recipients(uuid)', 'execute'), false,
    'the recipient resolver is not callable from the client');

  raise notice 'campaign any contact: all assertions passed';
end $$;
