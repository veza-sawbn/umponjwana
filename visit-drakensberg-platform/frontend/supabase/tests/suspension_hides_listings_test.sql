-- ============================================================================
-- Suspension actually takes a supplier off the public site — every type.
--
-- Written after a report that visitors were still finding SUSPENDED transport
-- operators while booking a shuttle. The database half of that story is meant
-- to be settled by three migrations:
--
--   20260906_suspension_hides_listings      — the public read policy consults
--                                             the owner, not just row status
--   20260912_orphan_entities_are_not_public — an ownerless row is not public
--   20260815_approval_consistency           — is_approved and approval_status
--                                             cannot drift apart
--
-- but nothing pinned that down per supplier type, and the public read policy
-- is one OR'd branch among several that key on the *reader* ("Admins read all
-- entities", "Owners read own entities", the managed-ops policies). This test
-- fixes the contract for every kind a supplier can own, and for each class of
-- reader, so a future policy edit cannot quietly put a suspended operator back
-- on the site.
--
-- Suspending a supplier deliberately does NOT touch their rows: a
-- transport_company stays status='active' while its owner is suspended. Every
-- assertion here is therefore about the OWNER's status, never the row's.
--
-- Note the `set local role` switches: as the superuser that builds the
-- fixtures, RLS is bypassed entirely, so an assertion written without one
-- passes whatever the policies say.
-- ============================================================================

\set ON_ERROR_STOP on

-- Ids have to survive the role switches below, and a temp table belongs to the
-- superuser that made it. A real table in vdtest, readable by the roles under
-- test, does survive — and the whole file runs inside a rolled-back
-- transaction, so it never outlives the run.
create table vdtest.susp_ids (tag text primary key, id uuid not null);
grant select on vdtest.susp_ids to anon, authenticated;

create or replace function vdtest.susp_kinds()
returns table (kind text, public_status text) language sql immutable as $$
  values ('property', 'active'), ('room', 'active'), ('activity', 'active'),
         ('tour', 'active'), ('departure', 'open'), ('transport_company', 'active'),
         ('supplier_vehicles', 'active'), ('supplier_drivers', 'active'),
         ('supplier_routes', 'active'), ('supplier_guides', 'verified'),
         ('supplier_events', 'active'), ('operator_profile', 'active')
$$;
grant execute on function vdtest.susp_kinds() to anon, authenticated;

-- ── Fixtures ────────────────────────────────────────────────────────────────
do $$
declare
  v_live uuid; v_suspended uuid; v_rejected uuid; v_pending uuid;
begin
  raise notice 'suspension hides listings';

  v_live      := vdtest.make_user('live@supplier.test',      'supplier', null, true);
  v_suspended := vdtest.make_user('suspended@supplier.test', 'supplier', null, true);
  v_rejected  := vdtest.make_user('rejected@supplier.test',  'supplier', null, true);
  v_pending   := vdtest.make_user('pending@supplier.test',   'supplier', null, false);

  insert into vdtest.susp_ids values
    ('live', v_live), ('suspended', v_suspended), ('rejected', v_rejected),
    ('pending', v_pending),
    ('admin',    vdtest.make_user('admin@vd.test',    'admin')),
    ('customer', vdtest.make_user('customer@vd.test', 'visitor'));

  -- One publicly-statused row of every kind for each of the four suppliers.
  insert into vd_entities (id, kind, owner_id, status, value)
  select 'ent-' || k.kind || '-' || o.tag, k.kind, o.id, k.public_status,
         jsonb_build_object('name', k.kind || ' by ' || o.tag, 'supplierId', o.id)
    from vdtest.susp_kinds() k
    cross join (values (v_live, 'live'), (v_suspended, 'susp'),
                       (v_rejected, 'rej'), (v_pending, 'pend')) as o(id, tag);

  -- Suspend / reject through the same column the admin console writes.
  update profiles set approval_status = 'suspended' where id = v_suspended;
  update profiles set approval_status = 'rejected'  where id = v_rejected;

  -- The consistency trigger must carry is_approved with it: every assertion
  -- below depends on that, and a silent drift is precisely how a suspended
  -- supplier would stay live.
  perform vdtest.ok((select not is_approved from profiles where id = v_suspended),
    'suspending clears is_approved, which is what the read policy consults');
  perform vdtest.ok((select not is_approved from profiles where id = v_rejected),
    'rejecting clears is_approved too');
end $$;


-- ── The public, per supplier type ───────────────────────────────────────────
set local role anon;
do $$
declare r record; v_seen int;
begin
  perform vdtest.act_as_nobody();
  for r in select * from vdtest.susp_kinds() loop
    select count(*) into v_seen from vd_entities e
      join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'suspended'
     where e.kind = r.kind;
    perform vdtest.eq(v_seen, 0, 'anon cannot see a suspended supplier''s ' || r.kind);

    select count(*) into v_seen from vd_entities e
      join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'rejected'
     where e.kind = r.kind;
    perform vdtest.eq(v_seen, 0, 'anon cannot see a rejected supplier''s ' || r.kind);

    select count(*) into v_seen from vd_entities e
      join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'pending'
     where e.kind = r.kind;
    perform vdtest.eq(v_seen, 0, 'anon cannot see a never-approved supplier''s ' || r.kind);

    -- The control: the gate hides the suspended, not the whole catalog.
    select count(*) into v_seen from vd_entities e
      join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'live'
     where e.kind = r.kind;
    perform vdtest.eq(v_seen, 1, 'anon still sees an approved supplier''s ' || r.kind);
  end loop;
end $$;
reset role;


-- ── A signed-in customer is still the public ────────────────────────────────
-- The shuttle picker runs mid-checkout, so this is the reader that actually
-- books the transfer that started this.
set local role authenticated;
do $$
declare v_seen int;
begin
  perform vdtest.act_as((select id from vdtest.susp_ids where tag = 'customer'));
  select count(*) into v_seen from vd_entities e
    join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'suspended';
  perform vdtest.eq(v_seen, 0, 'a signed-in customer sees nothing of a suspended supplier');

  select count(*) into v_seen from vd_entities e
    join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'live'
   where e.kind = 'transport_company';
  perform vdtest.eq(v_seen, 1, '…and still sees the live transport operator');
end $$;
reset role;


-- ── Suspension is not deletion, and the console still works ─────────────────
set local role authenticated;
do $$
declare v_seen int; v_kinds int := (select count(*) from vdtest.susp_kinds());
begin
  perform vdtest.act_as((select id from vdtest.susp_ids where tag = 'suspended'));
  select count(*) into v_seen from vd_entities e
    join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'suspended';
  perform vdtest.eq(v_seen, v_kinds,
    'the suspended supplier still sees their own rows in their portal');

  perform vdtest.act_as((select id from vdtest.susp_ids where tag = 'admin'));
  select count(*) into v_seen from vd_entities e
    join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'suspended';
  perform vdtest.eq(v_seen, v_kinds,
    'an admin still sees a suspended supplier''s rows in the console');
end $$;
reset role;


-- ── Reinstatement puts them back, with no per-row edit ──────────────────────
update profiles set approval_status = 'approved'
 where id = (select id from vdtest.susp_ids where tag = 'suspended');

set local role anon;
do $$
declare v_seen int;
begin
  perform vdtest.act_as_nobody();
  select count(*) into v_seen from vd_entities e
    join vdtest.susp_ids s on s.id = e.owner_id and s.tag = 'suspended';
  perform vdtest.eq(v_seen, (select count(*)::int from vdtest.susp_kinds()),
    'reinstating the supplier restores every listing on its own');
  raise notice 'suspension hides listings: all assertions passed';
end $$;
reset role;
