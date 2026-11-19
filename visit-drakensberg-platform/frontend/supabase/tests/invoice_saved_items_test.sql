-- ============================================================================
-- Saved invoice items and bundles: staff-only, well-formed, and counting a use
-- is not an edit. See supabase/migrations/20261119_invoice_saved_items.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_admin    uuid;
  v_finance  uuid;
  v_ops      uuid;
  v_customer uuid;
  v_supplier uuid;
begin
  raise notice 'saved invoice items';

  v_admin    := vdtest.make_user('isi-admin@example.test', 'admin');
  v_finance  := vdtest.make_user('isi-finance@example.test', 'visitor', 'finance');
  v_ops      := vdtest.make_user('isi-ops@example.test', 'visitor', 'operations');
  v_customer := vdtest.make_user('isi-customer@example.test', 'visitor');
  v_supplier := vdtest.make_user('isi-supplier@example.test', 'supplier', null, true);

  perform set_config('test.supplier', v_supplier::text, false);
  perform set_config('test.admin', v_admin::text, false);
  perform set_config('test.finance', v_finance::text, false);
  perform set_config('test.ops', v_ops::text, false);
  perform set_config('test.customer', v_customer::text, false);
end $$;

set local role authenticated;

do $$
declare
  v_admin    uuid := current_setting('test.admin')::uuid;
  v_finance  uuid := current_setting('test.finance')::uuid;
  v_ops      uuid := current_setting('test.ops')::uuid;
  v_customer uuid := current_setting('test.customer')::uuid;
  v_supplier uuid := current_setting('test.supplier')::uuid;
  v_item     vd_invoice_items%rowtype;
  v_n        int;
  v_updated  timestamptz;
begin
  -- ── Staff can save an item, and it is shared ────────────────────────────
  perform vdtest.act_as(v_admin);
  insert into vd_invoice_items (id, kind, name, lines) values
    ('isi-shuttle', 'item', 'ignored for items',
     jsonb_build_array(jsonb_build_object(
       'title', '  Shuttle: Sentinel car park to Mahai ', 'description', 'Return transfer',
       'category', 'shuttle', 'quantity', '1', 'unitLabel', 'person', 'unitPrice', '300',
       'supplierId', v_supplier)));
  select * into v_item from vd_invoice_items where id = 'isi-shuttle';
  perform vdtest.eq(v_item.name, 'Shuttle: Sentinel car park to Mahai', 'an item is named after its trimmed line title');
  perform vdtest.eq(v_item.created_by, v_admin, 'and records who saved it');

  perform vdtest.act_as(v_finance);
  select count(*) into v_n from vd_invoice_items where id = 'isi-shuttle';
  perform vdtest.eq(v_n, 1, 'finance staff see items another person saved');

  insert into vd_invoice_items (id, kind, name, lines) values
    ('isi-traverse', 'bundle', 'Northern Mini Traverse package',
     jsonb_build_array(
       jsonb_build_object('title', 'Northern Mini Traverse', 'category', 'hike', 'quantity', 1, 'unitPrice', 1500,
                          'supplierId', v_supplier),
       jsonb_build_object('title', 'Return shuttle', 'category', 'shuttle', 'quantity', 1, 'unitPrice', 300,
                          'discountType', 'percent', 'discountValue', '100',
                          'discountReason', 'Included in the package', 'discountFundedBy', 'platform')));
  perform vdtest.eq((select name from vd_invoice_items where id = 'isi-traverse'),
    'Northern Mini Traverse package', 'a bundle keeps its own name');

  -- ── Nobody else can read or write them ───────────────────────────────────
  perform vdtest.act_as(v_ops);
  select count(*) into v_n from vd_invoice_items;
  perform vdtest.eq(v_n, 0, 'operations staff cannot see saved items');

  perform vdtest.act_as(v_customer);
  select count(*) into v_n from vd_invoice_items;
  perform vdtest.eq(v_n, 0, 'a customer cannot see saved items');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-x', 'item', '', '[{"title":"Free night","unitPrice":0}]')$q$,
    'row-level security', 'a customer cannot save an item');
  update vd_invoice_items set lines = '[{"title":"Hacked","unitPrice":1}]' where id = 'isi-shuttle';
  get diagnostics v_n = row_count;
  perform vdtest.eq(v_n, 0, 'nor change one');

  perform vdtest.act_as(v_supplier);
  select count(*) into v_n from vd_invoice_items;
  perform vdtest.eq(v_n, 0, 'nor can a supplier, even one named on an item');
  perform vd_record_invoice_item_use(array['isi-shuttle']);

  -- ── Shape ────────────────────────────────────────────────────────────────
  perform vdtest.act_as(v_admin);
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"A","unitPrice":1},{"title":"B","unitPrice":1}]')$q$,
    'exactly one line', 'an item has one line');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'bundle', 'Solo', '[{"title":"A","unitPrice":1}]')$q$,
    'at least two lines', 'a bundle has at least two');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'bundle', '  ', '[{"title":"A","unitPrice":1},{"title":"B","unitPrice":1}]')$q$,
    'needs a name', 'a bundle needs a name');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"  ","unitPrice":1}]')$q$,
    'needs a title', 'every line needs a title');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"A","unitPrice":"-1"}]')$q$,
    'cannot be negative', 'a price cannot be negative');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"A","unitPrice":"abc"}]')$q$,
    'not a number', 'a price must be a number');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"A","quantity":0,"unitPrice":1}]')$q$,
    'more than 0', 'a quantity must be positive');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"A","unitPrice":1,"supplierId":"not-a-uuid"}]')$q$,
    'supplier', 'a supplier must be an id');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"A","unitPrice":100,"discountType":"percent","discountValue":"120"}]')$q$,
    '100%', 'a percentage discount cannot pass 100');
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-bad', 'item', '', '[{"title":"A","quantity":2,"unitPrice":100,"discountType":"amount","discountValue":"250"}]')$q$,
    'more than its price', 'an amount discount cannot pass the line');
  perform vdtest.allows($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-open-price', 'item', '', '[{"title":"Custom accommodation","unitPrice":""}]')$q$,
    'an item can leave its price to be entered on each invoice');

  -- ── One live entry per name ─────────────────────────────────────────────
  perform vdtest.raises($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-dupe', 'item', '', '[{"title":"shuttle: sentinel car park to mahai","unitPrice":1}]')$q$,
    'vd_invoice_items_live_name_idx', 'two live items cannot share a name');
  update vd_invoice_items set archived = true where id = 'isi-shuttle';
  perform vdtest.allows($q$insert into vd_invoice_items (id, kind, name, lines)
    values ('isi-dupe', 'item', '', '[{"title":"Shuttle: Sentinel car park to Mahai","unitPrice":350}]')$q$,
    'once archived, its name can be reused');

  -- ── Counting a use ──────────────────────────────────────────────────────
  -- now() is fixed inside the test's transaction, so start from an old stamp.
  update vd_invoice_items set updated_at = '2026-01-01T00:00:00Z' where id = 'isi-traverse';
  select updated_at into v_updated from vd_invoice_items where id = 'isi-traverse';
  perform vdtest.eq(v_updated, '2026-01-01T00:00:00Z'::timestamptz, 'fixture: an old updated_at');
  perform vd_record_invoice_item_use(array['isi-traverse', 'isi-traverse-missing']);
  perform vd_record_invoice_item_use(array['isi-traverse']);
  select * into v_item from vd_invoice_items where id = 'isi-traverse';
  perform vdtest.eq(v_item.use_count, 2, 'each use is counted');
  perform vdtest.ok(v_item.last_used_at is not null, 'with when it was last used');
  perform vdtest.eq(v_item.updated_at, v_updated, 'counting a use is not an edit');

  perform vdtest.eq((select use_count from vd_invoice_items where id = 'isi-shuttle'), 0,
    'a supplier''s call to count a use changed nothing');

  -- Editing a bundle's lines is an edit, and created_by cannot be rewritten.
  perform vdtest.act_as(v_finance);
  update vd_invoice_items
     set lines = jsonb_set(lines, '{0,unitPrice}', '1600'), created_by = v_admin
   where id = 'isi-traverse';
  select * into v_item from vd_invoice_items where id = 'isi-traverse';
  perform vdtest.eq(v_item.created_by, v_finance, 'the person who first saved it stays recorded');
  perform vdtest.eq(v_item.updated_by, v_finance, 'and the last editor is recorded');
  perform vdtest.eq((v_item.lines->0->>'unitPrice')::numeric, 1600::numeric, 'the edit lands');
  perform vdtest.ok(v_item.updated_at > v_updated, 'and moves updated_at');
end $$;

reset role;
