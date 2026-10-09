-- ============================================================================
-- Shareable group waiver links
--
-- See supabase/migrations/20261010_waiver_group_links.sql. A link is handed
-- out publicly, so these check that it can only ever add signatures to its
-- own trip, honours close / expiry / cap, and leaks nothing to anon.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_a        uuid;
  v_b        uuid;
  v_template uuid;
begin
  raise notice 'waiver group links';

  v_a := vdtest.make_user('wl-alpha@example.test', 'supplier', null, true);
  v_b := vdtest.make_user('wl-beta@example.test',  'supplier', null, true);

  perform vdtest.act_as_nobody();
  insert into vd_waiver_templates (supplier_id, title, clauses)
  values (v_a, 'Gorge hike', '[{"id":"c1","text":"I accept the risks","required":true},
                               {"id":"c2","text":"Photos ok","required":false}]'::jsonb)
  returning id into v_template;

  insert into vd_waiver_links (token, template_id, supplier_id, activity_name, max_signatures)
  values ('link-open',   v_template, v_a, 'Tugela Gorge', 2),
         ('link-closed', v_template, v_a, 'Old trip', null);
  update vd_waiver_links set is_active = false where token = 'link-closed';
  insert into vd_waiver_links (token, template_id, supplier_id, activity_name, expires_at)
  values ('link-expired', v_template, v_a, 'Past trip', now() - interval '1 day');

  perform set_config('test.a', v_a::text, false);
  perform set_config('test.b', v_b::text, false);
end $$;

-- ── The public path, as the real anon database role ─────────────────────────
set local role anon;

do $$
declare
  v_open jsonb;
  v_seen int;
begin
  perform vdtest.act_as_nobody();

  v_open := vd_waiver_open('link-open');
  perform vdtest.eq(v_open->>'ok', 'true', 'a live link opens');
  perform vdtest.eq(v_open->>'shared', 'true', 'it is flagged as a shared link');
  perform vdtest.eq(v_open->'request'->>'activityName', 'Tugela Gorge', 'it carries the trip context');
  perform vdtest.ok(not (v_open ? 'supplierId') and not (v_open::text like '%link-open%'),
    'the open payload exposes neither the supplier id nor the token');

  perform vdtest.eq(vd_waiver_open('link-closed')->>'reason', 'closed', 'a closed link refuses to open');
  perform vdtest.eq(vd_waiver_open('link-expired')->>'reason', 'expired', 'an expired link refuses to open');
  perform vdtest.eq(vd_waiver_open('nope')->>'reason', 'not_found', 'an unknown token is not found');

  perform vdtest.raises(
    $q$select vd_waiver_link_submit('link-open', '', '{}', '{"c2":true}', 'Ann Hiker')$q$,
    'required clauses', 'required clauses are still enforced');
  perform vdtest.raises(
    $q$select vd_waiver_link_submit('link-open', 'not-an-email', '{}', '{"c1":true}', 'Ann Hiker')$q$,
    'valid email', 'a malformed email is refused');
  perform vdtest.raises(
    $q$select vd_waiver_link_submit('link-open', '', '{}', '{"c1":true}', '   ')$q$,
    'signature name', 'a blank name is refused');
  perform vdtest.raises(
    $q$select vd_waiver_link_submit('link-closed', '', '{}', '{"c1":true}', 'Ann Hiker')$q$,
    'closed', 'a closed link refuses signatures');
  perform vdtest.raises(
    $q$select vd_waiver_link_submit('link-expired', '', '{}', '{"c1":true}', 'Ann Hiker')$q$,
    'expired', 'an expired link refuses signatures');

  perform vdtest.allows(
    $q$select vd_waiver_link_submit('link-open', 'Ann@Example.test', '{}', '{"c1":true}', 'Ann Hiker')$q$,
    'the first participant signs');
  perform vdtest.allows(
    $q$select vd_waiver_link_submit('link-open', '', '{}', '{"c1":true}', 'Ben Hiker', null, 'Ann Hiker')$q$,
    'a second participant signs on the same link, without an email');

  perform vdtest.eq(vd_waiver_open('link-open')->>'reason', 'full', 'a capped link reports full once reached');
  perform vdtest.raises(
    $q$select vd_waiver_link_submit('link-open', '', '{}', '{"c1":true}', 'Cat Hiker')$q$,
    'signature limit', 'a capped link refuses the signature over the cap');

  -- anon reaches no table or view directly.
  begin
    select count(*) into v_seen from vd_waiver_links;
  exception when insufficient_privilege then
    v_seen := 0;
  end;
  perform vdtest.eq(v_seen, 0, 'anon cannot read the links table');
end $$;

reset role;

-- ── What the signatures produced ────────────────────────────────────────────
do $$
declare
  v_a uuid := current_setting('test.a')::uuid;
  v_link uuid := (select id from vd_waiver_links where token = 'link-open');
begin
  perform vdtest.eq((select count(*)::int from vd_waiver_requests where link_id = v_link), 2,
    'each signature became its own request');
  perform vdtest.eq(
    (select count(*)::int from vd_waiver_requests r
       join vd_waiver_submissions s on s.request_id = r.id
      where r.link_id = v_link and r.status = 'signed' and r.supplier_id = v_a),
    2, 'each request is signed, owned by the link''s supplier, with a submission');
  perform vdtest.eq(
    (select participant_email from vd_waiver_requests where link_id = v_link and participant_name = 'Ann Hiker'),
    'ann@example.test', 'the email is normalised');
  perform vdtest.eq(
    (select guardian_name from vd_waiver_submissions s join vd_waiver_requests r on r.id = s.request_id
      where r.participant_name = 'Ben Hiker'),
    'Ann Hiker', 'the guardian countersignature is kept');
  perform vdtest.eq(
    (select signature_count from vd_waiver_link_details where id = v_link), 2,
    'the link details view counts signatures');
  perform vdtest.eq(
    (select count(*)::int from vd_notifications where user_id = v_a and title like 'Waiver signed%'),
    2, 'the supplier is notified of each signature');
  perform vdtest.raises(
    format('delete from vd_waiver_links where id = %L', v_link),
    'foreign key', 'a link with signatures cannot be deleted out from under them');
end $$;

-- ── Tenant isolation through RLS ────────────────────────────────────────────
set local role authenticated;

do $$
begin
  perform vdtest.act_as(current_setting('test.b')::uuid);
  perform vdtest.eq((select count(*)::int from vd_waiver_links), 0,
    'another supplier sees none of supplier A''s links');
  perform vdtest.eq((select count(*)::int from vd_waiver_link_details), 0,
    'nor through the details view');

  perform vdtest.act_as(current_setting('test.a')::uuid);
  perform vdtest.eq((select count(*)::int from vd_waiver_links), 3,
    'supplier A sees their own links');
  perform vdtest.eq(
    (select count(*)::int from vd_waiver_request_details where link_id is not null), 2,
    'and the signatures they produced, tagged with their link');
end $$;

reset role;

do $$ begin raise notice 'waiver group links: all assertions passed'; end $$;
