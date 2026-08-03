-- Isolation invariants for the partner access-control layer.
--
-- Run against a database with every migration applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f partner_access_control_test.sql
--
-- Every assertion below is a property the platform must never lose. They are
-- written as hard failures, not printed output, so a regression stops the run.
--
-- NOTE ON RLS: PostgreSQL bypasses row level security for superusers and table
-- owners. The data-isolation section therefore SETs ROLE to a non-privileged
-- role; running the whole file as postgres would make those checks pass
-- vacuously.

begin;

create or replace function pg_temp.check(p_label text, p_condition boolean)
returns void language plpgsql as $$
begin
  if p_condition then
    raise notice 'pass  %', p_label;
  else
    raise exception 'FAIL  %', p_label;
  end if;
end;
$$;

-- ── fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local'),
  ('b0000000-0000-0000-0000-000000000002', 'alice@test.local'),
  ('c0000000-0000-0000-0000-000000000003', 'bob@test.local')
on conflict do nothing;
update profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
update profiles set role = 'supplier', is_approved = true
 where id in ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003');

insert into vd_entities (id, kind, owner_id, status, value) values
  ('t-est-a', 'property', null, 'active', '{"name":"Lodge A"}'::jsonb),
  ('t-est-b', 'property', null, 'active', '{"name":"Lodge B"}'::jsonb)
on conflict (id) do nothing;

insert into vd_establishment_internal (establishment_id, internal_notes)
values ('t-est-a', 'internal only') on conflict (establishment_id) do nothing;
insert into vd_commission_agreements (id, establishment_id, commission_rate)
values ('t-com-a', 't-est-a', 0.18) on conflict (id) do nothing;

insert into vd_establishment_access
  (id, establishment_id, user_id, role_key, handover_level, access_status) values
  ('t-acc-a','t-est-a','b0000000-0000-0000-0000-000000000002','supplier_owner','self_managed','active'),
  ('t-acc-b','t-est-b','c0000000-0000-0000-0000-000000000003','supplier_owner','managed','active')
on conflict (id) do nothing;

-- ── 1. no supplier role may carry a platform permission ─────────────────────
select pg_temp.check(
  'no supplier role grants any platform_only permission',
  not exists (
    select 1 from vd_role_permissions rp
      join vd_roles r on r.key = rp.role_key
      join vd_permissions p on p.key = rp.permission_key
     where r.scope = 'supplier' and p.platform_only));

select pg_temp.check(
  'no supplier role grants listing.publish',
  not exists (
    select 1 from vd_role_permissions rp join vd_roles r on r.key = rp.role_key
     where r.scope = 'supplier' and rp.permission_key = 'listing.publish'));

-- ── 2. the handover ceiling clamps an identical role ────────────────────────
select pg_temp.check(
  'self-managed owner reaches rates.edit',
  'rates.edit' = any (vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-a')));

select pg_temp.check(
  'managed owner does NOT reach rates.edit',
  not ('rates.edit' = any (vd_effective_permissions('c0000000-0000-0000-0000-000000000003','t-est-b'))));

select pg_temp.check(
  'managed owner does NOT reach listing.edit',
  not ('listing.edit' = any (vd_effective_permissions('c0000000-0000-0000-0000-000000000003','t-est-b'))));

select pg_temp.check(
  'managed owner does NOT reach photos.upload',
  not ('photos.upload' = any (vd_effective_permissions('c0000000-0000-0000-0000-000000000003','t-est-b'))));

-- ── 3. an explicit override cannot escalate ─────────────────────────────────
update vd_establishment_access
   set granted_permissions = array['listing.publish','commission.edit','platform.settings','supplier.delete']
 where id = 't-acc-a';

select pg_temp.check(
  'override cannot grant listing.publish',
  not ('listing.publish' = any (vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-a'))));
select pg_temp.check(
  'override cannot grant commission.edit',
  not ('commission.edit' = any (vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-a'))));
select pg_temp.check(
  'override cannot grant platform.settings',
  not ('platform.settings' = any (vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-a'))));
select pg_temp.check(
  'override cannot grant supplier.delete',
  not ('supplier.delete' = any (vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-a'))));

-- an override cannot push a managed partner past the ceiling either
update vd_establishment_access
   set granted_permissions = array['rates.edit','listing.edit','photos.upload']
 where id = 't-acc-b';
select pg_temp.check(
  'override cannot lift a managed partner past the ceiling',
  not ('rates.edit' = any (vd_effective_permissions('c0000000-0000-0000-0000-000000000003','t-est-b'))));

update vd_establishment_access set granted_permissions = '{}' where id in ('t-acc-a','t-acc-b');

-- ── 4. revocation removes authority ─────────────────────────────────────────
select pg_temp.check(
  'a partner holds nothing on an establishment they are not assigned to',
  cardinality(vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-b')) = 0);

update vd_establishment_access set access_status = 'revoked' where id = 't-acc-a';
select pg_temp.check(
  'revoked access yields no permissions',
  cardinality(vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-a')) = 0);
update vd_establishment_access set access_status = 'active' where id = 't-acc-a';

-- expiry window is respected
update vd_establishment_access set access_end_date = current_date - 1 where id = 't-acc-a';
select pg_temp.check(
  'expired access yields no permissions',
  cardinality(vd_effective_permissions('b0000000-0000-0000-0000-000000000002','t-est-a')) = 0);
update vd_establishment_access set access_end_date = null where id = 't-acc-a';

-- ── 5. data isolation, with RLS actually enforced ───────────────────────────
grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on auth.users to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';

select pg_temp.check(
  'partner cannot read internal establishment data',
  (select count(*) from vd_establishment_internal) = 0);

select pg_temp.check(
  'partner cannot read commission agreements',
  (select count(*) from vd_commission_agreements) = 0);

select pg_temp.check(
  'partner sees only their own access row, not other partners',
  (select count(*) from vd_establishment_access) = 1);

-- writing to another establishment must affect nothing
update vd_entities set value = value || '{"name":"TAMPERED"}'::jsonb where id = 't-est-b';
reset role;
select pg_temp.check(
  'partner cannot edit an establishment they are not assigned to',
  (select value->>'name' from vd_entities where id = 't-est-b') = 'Lodge B');

set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000003';
update vd_entities set value = value || '{"name":"TAMPERED"}'::jsonb where id = 't-est-b';
reset role;
select pg_temp.check(
  'managed partner cannot edit their own establishment',
  (select value->>'name' from vd_entities where id = 't-est-b') = 'Lodge B');

-- ── 6. invitations ──────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000004','carol@test.local'),
  ('e0000000-0000-0000-0000-000000000005','mallory@test.local')
on conflict do nothing;

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
create temp table t_invite as
  select (vd_invite_establishment_user('t-est-a','carol@test.local','supplier_manager','self_managed')->>'token') as token;

-- the wrong account cannot redeem it
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000005';
do $$
declare v_ok boolean := false;
begin
  begin
    perform vd_accept_establishment_invitation((select token from t_invite));
    v_ok := true;
  exception when others then null;
  end;
  if v_ok then raise exception 'FAIL  an invitation was redeemable by the wrong account'; end if;
  raise notice 'pass  invitation rejects a different email address';
end $$;

-- the right account can, exactly once
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000004';
select vd_accept_establishment_invitation((select token from t_invite));
select pg_temp.check(
  'invitee gains the invited role',
  exists (select 1 from vd_establishment_access
           where user_id = 'd0000000-0000-0000-0000-000000000004'
             and establishment_id = 't-est-a' and role_key = 'supplier_manager'
             and access_status = 'active'));

do $$
declare v_ok boolean := false;
begin
  begin
    perform vd_accept_establishment_invitation((select token from t_invite));
    v_ok := true;
  exception when others then null;
  end;
  if v_ok then raise exception 'FAIL  an invitation token was reusable'; end if;
  raise notice 'pass  invitation token is single-use';
end $$;

-- ── 7. a non-admin cannot hand out access ───────────────────────────────────
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
do $$
declare v_ok boolean := false;
begin
  begin
    perform vd_invite_establishment_user('t-est-a','someone@test.local','supplier_owner','self_managed');
    v_ok := true;
  exception when others then null;
  end;
  if v_ok then raise exception 'FAIL  a partner was able to invite users'; end if;
  raise notice 'pass  only admins may issue invitations';
end $$;

-- ── 8. revocation leaves the listing intact ─────────────────────────────────
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select vd_revoke_establishment_access(
  (select id from vd_establishment_access
    where user_id = 'd0000000-0000-0000-0000-000000000004' and establishment_id = 't-est-a'),
  'test');
select pg_temp.check(
  'revoking access does not delete the establishment',
  exists (select 1 from vd_entities where id = 't-est-a'));
select pg_temp.check(
  'revoked partner holds no permissions',
  cardinality(vd_effective_permissions('d0000000-0000-0000-0000-000000000004','t-est-a')) = 0);

-- ── 9. every action is audited ──────────────────────────────────────────────
select pg_temp.check(
  'handover actions are written to the audit log',
  (select count(*) from vd_audit_log
    where entity = 'establishment'
      and action in ('establishment.invited','establishment.access_accepted','establishment.access_revoked')) >= 3);

rollback;
