-- ============================================================================
-- Draft departures: hidden from the public, not bookable, and not published
-- by accident. See supabase/migrations/20261109_departure_drafts.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_supplier uuid;
  v_guest    uuid;
  v_dep      text := 'dep-' || gen_random_uuid();
  v_n        int;
begin
  raise notice 'departure drafts';

  v_supplier := vdtest.make_user('dd-supplier@example.test', 'supplier', null, true);
  v_guest    := vdtest.make_user('dd-guest@example.test', 'visitor');

  perform vdtest.act_as_nobody();
  insert into vd_entities (id, kind, owner_id, status, value)
  values (v_dep, 'departure', v_supplier, 'draft',
          jsonb_build_object('id', v_dep, 'maxSeats', 2, 'bookedSeats', 0, 'status', 'draft'));

  -- ── Who can see it ───────────────────────────────────────────────────────
  set local role authenticated;
  perform vdtest.act_as(v_guest);
  select count(*) into v_n from vd_entities where id = v_dep;
  perform vdtest.eq(v_n, 0, 'a customer cannot see a draft departure');
  perform vdtest.act_as(v_supplier);
  select count(*) into v_n from vd_entities where id = v_dep;
  perform vdtest.eq(v_n, 1, 'its supplier can');
  reset role;

  -- ── Nobody can hold a seat on it ────────────────────────────────────────
  perform vdtest.act_as(v_guest);
  perform vdtest.raises(format('select vd_hold_inventory(''departure'', %L, '''', 1)', v_dep),
    'not open for booking', 'checkout cannot hold a seat on a draft');

  -- ── Filling it by hand keeps it a draft ─────────────────────────────────
  perform vdtest.act_as_nobody();
  perform vd_inventory_adjust('departure', v_dep, '', 2);
  perform vdtest.eq((select status from vd_entities where id = v_dep), 'draft',
    'a draft with every seat taken stays a draft');
  perform vdtest.eq((select value->>'status' from vd_entities where id = v_dep), 'draft',
    'in its value too');
  perform vd_inventory_adjust('departure', v_dep, '', -1);
  perform vdtest.eq((select status from vd_entities where id = v_dep), 'draft',
    'and giving a seat back does not publish it');

  -- ── Publishing ──────────────────────────────────────────────────────────
  set local role authenticated;
  perform vdtest.act_as(v_supplier);
  update vd_entities set status = 'open', value = value || '{"status":"open"}' where id = v_dep;
  reset role;
  perform vdtest.eq((select status from vd_entities where id = v_dep), 'open', 'its supplier can publish it');

  set local role authenticated;
  perform vdtest.act_as(v_guest);
  select count(*) into v_n from vd_entities where id = v_dep;
  perform vdtest.eq(v_n, 1, 'and now customers see it');
  reset role;
  perform vdtest.act_as(v_guest);
  perform vdtest.ok(vd_hold_inventory('departure', v_dep, '', 1) is not null, 'and can book it');

  perform vdtest.act_as_nobody();
  perform vdtest.eq((select status from vd_entities where id = v_dep), 'full',
    'a published departure still turns full as before');

  -- ── Back to draft: only with no seats taken, by the live count ─────────
  perform vdtest.raises(format(
    'update vd_entities set status = ''draft'', value = value || ''{"status":"draft"}'' where id = %L', v_dep),
    'cannot go back to draft', 'a departure with seats taken cannot go back to draft');
  update vd_entities set value = value || '{"bookedSeats":0}', status = 'open' where id = v_dep;
  update vd_entities set status = 'draft', value = value || '{"status":"draft"}' where id = v_dep;
  perform vdtest.eq((select status from vd_entities where id = v_dep), 'draft',
    'an empty departure can go back to draft');

  -- A full draft published as full stays full.
  update vd_entities set value = value || '{"bookedSeats":2}' where id = v_dep;
  update vd_entities set status = 'full', value = value || '{"status":"full"}' where id = v_dep;
  perform vdtest.eq((select status from vd_entities where id = v_dep), 'full',
    'publishing a draft whose seats are all taken makes it full');
end $$;
