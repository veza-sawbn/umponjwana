-- ============================================================================
-- vd_notify — notifications to other people are delivered, and ops staff who
-- manage a supplier are copied when asked.
--
-- See supabase/migrations/20261008_notify_rpc.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_guest    uuid := vdtest.make_user('notify-guest@example.test', 'visitor');
  v_supplier uuid := vdtest.make_user('notify-tours@example.test', 'supplier', null, true);
  v_ops      uuid := vdtest.make_user('notify-ops@example.test', 'visitor', 'operations');
  v_ops_off  uuid := vdtest.make_user('notify-ops-off@example.test', 'visitor', 'operations');
begin
  raise notice 'vd_notify';
  perform vdtest.act_as_nobody();
  insert into vd_ops_assignments (employee_id, supplier_id, permissions, is_active) values
    (v_ops,     v_supplier, array['view_bookings', 'manage_customers'], true),
    (v_ops_off, v_supplier, array['view_bookings', 'manage_customers'], false);
  perform set_config('test.guest', v_guest::text, false);
  perform set_config('test.supplier', v_supplier::text, false);
  perform set_config('test.ops', v_ops::text, false);
  perform set_config('test.ops_off', v_ops_off::text, false);
end $$;

set local role authenticated;

do $$
declare
  v_guest    uuid := current_setting('test.guest')::uuid;
  v_supplier uuid := current_setting('test.supplier')::uuid;
  v_ops      uuid := current_setting('test.ops')::uuid;
  v_ops_off  uuid := current_setting('test.ops_off')::uuid;
  v_ids      uuid[];
  v_id       uuid;
begin
  perform vdtest.act_as(v_guest);

  -- The bug: what notify() used to send (INSERT … RETURNING) is refused.
  perform vdtest.raises(format(
    $q$insert into vd_notifications (user_id, type, title, body) values (%L, 'message', 't', 'b') returning id$q$, v_supplier),
    'row-level security', 'THE BUG: insert-and-return a notification for someone else is refused');

  -- The fix.
  v_ids := vd_notify(v_supplier, 'message', 'New message', 'Hello', '/supplier/messages');
  perform vdtest.eq(coalesce(array_length(v_ids, 1), 0), 1, 'the guest notifies the supplier');

  v_ids := vd_notify(v_supplier, 'message', 'New message', 'Hello again', '/supplier/messages', true);
  perform vdtest.eq(coalesce(array_length(v_ids, 1), 0), 2, 'with managers: the supplier and their one active ops employee');

  -- The guest cannot read what they sent, but the email route's lookup
  -- (created_by = caller) still finds it.
  perform vdtest.eq((select count(*)::int from vd_notifications), 0, 'the guest cannot read other people''s notifications');
  perform vdtest.ok(vd_notification_for_email(v_ids[1]) is not null, 'the sender may have their notification emailed');

  perform vdtest.act_as(v_ops);
  perform vdtest.eq((select count(*)::int from vd_notifications where link like '/admin/operations/managed-suppliers/%'), 1,
    'the ops employee received it, linked to the managed-supplier console');

  perform vdtest.act_as(v_ops_off);
  perform vdtest.eq((select count(*)::int from vd_notifications), 0, 'an inactive assignment receives nothing');

  perform vdtest.act_as(v_supplier);
  perform vdtest.eq((select count(*)::int from vd_notifications), 2, 'the supplier received both');
  perform vdtest.eq((select count(*)::int from vd_notifications where created_by = v_guest), 2, 'provenance records the guest as sender');

  perform vdtest.act_as_nobody();
  perform vdtest.raises(format($q$select vd_notify(%L, 'info', 't', 'b')$q$, v_supplier),
    'not signed in', 'no JWT cannot notify anyone');

  raise notice 'vd_notify: all assertions passed';
end $$;

reset role;
