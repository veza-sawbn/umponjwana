-- ============================================================================
-- Listing applications — the front door is server-side only
--
-- 20260807_listing_applications.sql shipped with this policy:
--
--   create policy "Anyone can apply to list" on vd_listing_applications
--     for insert with check (status = 'new');
--
-- and a header warning that it was an unauthenticated write endpoint which
-- needed a captcha before it saw real traffic. It saw real traffic first: 144
-- applications by 2026-09-20, 109 of them scripted.
--
-- 20260921_listing_applications_server_only.sql drops that policy, so the only
-- way in is POST /api/listing-applications — which verifies a Turnstile token,
-- rate limits, and owns the id, status and timestamp.
--
-- These tests pin down the three properties that change has to keep:
--
--   1. anon and authenticated cannot insert, however the row is shaped;
--   2. the service role (the API route) still can;
--   3. everything the table was ALREADY careful about is untouched — an
--      application is still write-only to the public, and admins still read
--      and manage the queue.
--
-- Property 3 matters as much as 1: the cheapest way to "fix" an unauthenticated
-- write endpoint is to break the feature, and that would not show up in a test
-- that only checks the insert is refused.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin    uuid;
  v_visitor  uuid;
begin
  raise notice 'listing application intake';

  v_admin   := vdtest.make_user('queue-admin@example.test',   'admin');
  v_visitor := vdtest.make_user('would-be-lister@example.test', 'visitor');

  perform set_config('test.admin',   v_admin::text,   false);
  -- Stashed before the role switch: under `set local role authenticated` the
  -- RLS on profiles restricts it to the caller's own row, so looking this up
  -- later would return NULL and silently test "nobody".
  perform set_config('test.visitor', v_visitor::text, false);

  perform vdtest.act_as_nobody();

  -- One application already on file, written as the owner, so the read tests
  -- below have something to fail to see.
  insert into vd_listing_applications (id, reference, status, property_name, contact_email, region, value)
  values ('lapp-existing', 'LP-AAA222', 'new', 'Cathkin Lodge', 'owner@example.test', 'Central Berg', '{}'::jsonb);
end $$;

-- Everything below runs as a real Supabase role, so the shipped policies apply
-- rather than the owner's bypass.
set local role anon;

do $$
begin
  perform vdtest.act_as_nobody();

  -- ══ THE HOLE THAT WAS OPEN ═══════════════════════════════════════════════
  -- This is the insert lib/listing-applications.ts used to perform with the
  -- anon key — the key that ships in every page of the site. Under the old
  -- policy it succeeded, from anywhere, at whatever rate PostgREST would take.
  perform vdtest.raises(
    $sql$insert into vd_listing_applications (id, reference, status, contact_email, value)
         values ('lapp-bot-1', 'LP-BOT222', 'new', 'bot@example.test', '{}'::jsonb)$sql$,
    'row-level security',
    'anon CANNOT lodge an application directly any more');

  -- The old policy's only rule was `status = 'new'`, so it is worth proving
  -- the refusal is not just that clause still doing its narrow job.
  perform vdtest.raises(
    $sql$insert into vd_listing_applications (id, reference, status, contact_email, value)
         values ('lapp-bot-2', 'LP-BOT333', 'approved', 'bot@example.test', '{}'::jsonb)$sql$,
    'row-level security',
    'anon cannot self-approve on the way in either');

  -- An application has always been write-only to the public. Still true.
  perform vdtest.eq(
    (select count(*)::int from vd_listing_applications), 0,
    'anon still cannot read a single application back');
end $$;

reset role;

set local role authenticated;

do $$
begin
  -- A signed-in visitor is not a way round it. The wizard signs an applicant
  -- up before submitting, so "logged in" is a state a script can reach too —
  -- which is exactly why the gate is the route and not the session.
  perform vdtest.act_as(current_setting('test.visitor')::uuid);

  perform vdtest.raises(
    $sql$insert into vd_listing_applications (id, reference, status, contact_email, value)
         values ('lapp-bot-3', 'LP-BOT444', 'new', 'bot@example.test', '{}'::jsonb)$sql$,
    'row-level security',
    'a signed-in visitor cannot lodge one directly either');

  perform vdtest.eq(
    (select count(*)::int from vd_listing_applications), 0,
    'and cannot read the queue');

  -- ══ THE QUEUE STILL WORKS ════════════════════════════════════════════════
  perform vdtest.act_as(current_setting('test.admin')::uuid);

  perform vdtest.eq(
    (select count(*)::int from vd_listing_applications), 1,
    'an admin still reads the review queue');

  perform vdtest.allows(
    $sql$update vd_listing_applications set status = 'in_review' where id = 'lapp-existing'$sql$,
    'an admin still moves an application through the queue');

  -- ══ THE ROUTE'S OWN PATH ═════════════════════════════════════════════════
  -- The service role is not subject to RLS, which is what keeps
  -- POST /api/listing-applications working after the public policy is gone.
  -- Asserted rather than assumed: if this were ever untrue the form would be
  -- dead for everyone, and the anon tests above would still pass.
  perform vdtest.ok(
    (select rolbypassrls from pg_roles where rolname = 'service_role'),
    'the service role bypasses RLS — the API route is still the way in');

  raise notice 'listing application intake: all assertions passed';
end $$;

reset role;
