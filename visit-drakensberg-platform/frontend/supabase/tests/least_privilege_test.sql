-- ============================================================================
-- profiles column grants / vd_entities update policy
--
-- Regression tests for audit findings L3 and L4.
-- See supabase/migrations/20260913_least_privilege_profiles_and_entities.sql.
--
-- These exercise the GRANTs and POLICIES themselves, so unlike the other test
-- files they have to act as the `authenticated` database role rather than
-- merely setting auth.uid() — SECURITY DEFINER functions run as the owner and
-- would not see them.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_approved  uuid;
  v_suspended uuid;
  v_granted   text[];
begin
  raise notice 'least privilege: profiles columns and vd_entities updates';

  v_approved  := vdtest.make_user('approved@example.test',  'supplier', null, true);
  v_suspended := vdtest.make_user('suspended@example.test', 'supplier', null, false);

  perform vdtest.act_as_nobody();
  insert into vd_entities (id, kind, owner_id, status, value)
  values ('ent-approved',  'activity', v_approved,  'active', '{"price": 100}'::jsonb),
         ('ent-suspended', 'activity', v_suspended, 'active', '{"price": 100}'::jsonb);

  -- ── L3: the email column grant ────────────────────────────────────────────
  select array_agg(privilege_type::text || ':' || column_name)
    into v_granted
    from information_schema.column_privileges
   where table_name = 'profiles'
     and grantee = 'authenticated'
     and privilege_type = 'UPDATE'
     and column_name = 'email';

  perform vdtest.eq(v_granted, null::text[],
    'L3: authenticated can no longer UPDATE profiles.email');

  -- The contact fields the grant exists for are untouched.
  perform vdtest.ok(
    exists (select 1 from information_schema.column_privileges
             where table_name = 'profiles' and grantee = 'authenticated'
               and privilege_type = 'UPDATE' and column_name = 'full_name'),
    'L3: full_name is still editable by its owner');
  perform vdtest.ok(
    exists (select 1 from information_schema.column_privileges
             where table_name = 'profiles' and grantee = 'authenticated'
               and privilege_type = 'UPDATE' and column_name = 'phone'),
    'L3: phone is still editable by its owner');

  -- And the fields 20260704 was protecting are still not grantable.
  perform vdtest.ok(
    not exists (select 1 from information_schema.column_privileges
                 where table_name = 'profiles' and grantee = 'authenticated'
                   and privilege_type = 'UPDATE'
                   and column_name in ('role', 'is_approved', 'loyalty_points', 'staff_role')),
    'nobody gained role/is_approved/loyalty_points/staff_role along the way');
end $$;

-- ── L4: the vd_entities update policy, exercised as `authenticated` ─────────
do $$
declare
  v_approved  uuid;
  v_suspended uuid;
  v_using     text;
  v_check     text;
begin
  select id into v_approved  from profiles where email = 'approved@example.test';
  select id into v_suspended from profiles where email = 'suspended@example.test';

  select pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    into v_using, v_check
    from pg_policy
   where polrelid = 'vd_entities'::regclass and polname = 'Owners update own';

  perform vdtest.ok(v_using like '%is_active_supplier()%',
    'L4: the owner update policy now demands an active supplier');
  perform vdtest.ok(v_check like '%is_active_supplier()%',
    'L4: …and states WITH CHECK explicitly rather than inheriting USING');

  -- The other write paths are untouched: RLS ORs policies together, so
  -- narrowing the owner's own path must not have narrowed staff or ops.
  perform vdtest.ok(
    exists (select 1 from pg_policy
             where polrelid = 'vd_entities'::regclass and polname = 'Admins write all'),
    'admins still write everything');
  perform vdtest.ok(
    exists (select 1 from pg_policy
             where polrelid = 'vd_entities'::regclass
               and polname = 'Managed ops agents update entities'),
    'ops employees still write for the suppliers they manage');
end $$;

-- Behavioural check: run the policy for real, as the authenticated role.
--
-- The two user ids are resolved and stashed FIRST, while still superuser:
-- `authenticated` has no SELECT on profiles beyond its own row, which is the
-- point of the policies on that table and not what this file is testing.
do $$
begin
  perform set_config('test.approved',
    (select id::text from profiles where email = 'approved@example.test'), false);
  perform set_config('test.suspended',
    (select id::text from profiles where email = 'suspended@example.test'), false);
end $$;

set local role authenticated;

do $$
declare
  v_approved  uuid := current_setting('test.approved')::uuid;
  v_suspended uuid := current_setting('test.suspended')::uuid;
  v_rows      int;
begin
  -- An approved supplier edits their own listing: unchanged behaviour.
  perform vdtest.act_as(v_approved);
  update vd_entities set value = '{"price": 200}'::jsonb where id = 'ent-approved';
  get diagnostics v_rows = row_count;
  perform vdtest.eq(v_rows, 1, 'an approved supplier still edits their own listing');

  -- A suspended supplier's update matches no policy, so it silently affects
  -- zero rows — which is how RLS refuses an UPDATE.
  perform vdtest.act_as(v_suspended);
  update vd_entities set value = '{"price": 1}'::jsonb where id = 'ent-suspended';
  get diagnostics v_rows = row_count;
  perform vdtest.eq(v_rows, 0, 'L4: a suspended supplier cannot edit their own listing');

  perform vdtest.eq(
    (select value->>'price' from vd_entities where id = 'ent-suspended'), '100',
    'L4: the suspended supplier''s listing is unchanged');

  -- And still cannot reach anyone else's.
  perform vdtest.act_as(v_approved);
  update vd_entities set value = '{"price": 1}'::jsonb where id = 'ent-suspended';
  get diagnostics v_rows = row_count;
  perform vdtest.eq(v_rows, 0, 'a supplier cannot edit another supplier''s listing');

  raise notice 'least privilege: all assertions passed';
end $$;

reset role;
