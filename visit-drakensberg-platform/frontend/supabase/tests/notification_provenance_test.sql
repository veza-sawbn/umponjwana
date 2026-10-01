-- ============================================================================
-- vd_notifications — provenance, volume, and what may be emailed
--
-- Regression tests for audit finding H5.
-- See supabase/migrations/20260913_notification_provenance_and_seat_authorization.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_customer  uuid;
  v_supplier  uuid;
  v_attacker  uuid;
  v_admin     uuid;
  v_id        uuid;
  v_payload   jsonb;
  v_cap       int := vd_notification_hourly_cap();
  i           int;
begin
  raise notice 'vd_notifications provenance';

  v_customer := vdtest.make_user('cust@example.test',     'visitor');
  v_supplier := vdtest.make_user('supp@example.test',     'supplier', null, true);
  v_attacker := vdtest.make_user('phisher@example.test',  'visitor');
  v_admin    := vdtest.make_user('staff@example.test',    'admin');

  -- ── Provenance is stamped, never accepted ─────────────────────────────────
  -- A customer notifying their supplier about a booking is the legitimate
  -- flow (lib/notifications.ts notify()) and must keep working.
  perform vdtest.act_as(v_customer);
  insert into vd_notifications (user_id, type, title, body)
  values (v_supplier, 'booking', 'New booking VD-1', 'A guest booked with you')
  returning id into v_id;
  perform vdtest.ok(v_id is not null, 'a customer may still notify their supplier');

  perform vdtest.eq(
    (select created_by from vd_notifications where id = v_id), v_customer,
    'H5: the row records who really raised it');

  -- Claiming to be somebody else is overwritten by the trigger, not trusted.
  insert into vd_notifications (user_id, type, title, body, created_by)
  values (v_supplier, 'info', 'Spoofed', 'body', v_admin)
  returning id into v_id;
  perform vdtest.eq(
    (select created_by from vd_notifications where id = v_id), v_customer,
    'H5: a caller-supplied created_by is ignored');

  -- ── What the email route may send ─────────────────────────────────────────
  -- /api/notifications/email no longer takes title/body from the request. It
  -- passes an id here and sends what is stored — so the email can never say
  -- something different from what is recorded.
  perform vdtest.act_as(v_customer);
  insert into vd_notifications (user_id, type, title, body, link)
  values (v_supplier, 'booking', 'Real title', 'Real body', '/supplier/bookings')
  returning id into v_id;

  v_payload := vd_notification_for_email(v_id);
  perform vdtest.eq(v_payload->>'title', 'Real title', 'the sender gets the stored title back');
  perform vdtest.eq(v_payload->>'body',  'Real body',  'the sender gets the stored body back');
  perform vdtest.eq((v_payload->>'user_id')::uuid, v_supplier, 'and the real recipient');

  -- The recipient's email address is never returned — the route looks that up
  -- with the service client, so this cannot be used to harvest addresses.
  perform vdtest.ok(not (v_payload ? 'email'), 'H5: no email address is disclosed');

  -- ── H5: the phishing path ─────────────────────────────────────────────────
  -- Someone else's notification cannot be emailed, so an attacker cannot
  -- borrow a legitimate row to trigger a send.
  perform vdtest.act_as(v_attacker);
  perform vdtest.eq(vd_notification_for_email(v_id), null::jsonb,
    'H5: a stranger cannot email a notification they did not create');

  -- A row that does not exist is not an oracle either.
  perform vdtest.eq(vd_notification_for_email(gen_random_uuid()), null::jsonb,
    'an unknown notification id returns nothing');
  perform vdtest.eq(vd_notification_for_email(null), null::jsonb,
    'a null id returns nothing');

  -- Staff and the service role may send anything — campaigns and system mail.
  perform vdtest.act_as(v_admin);
  perform vdtest.ok(vd_notification_for_email(v_id) is not null,
    'staff may email any notification');
  perform vdtest.act_as_service();
  perform vdtest.ok(vd_notification_for_email(v_id) is not null,
    'the service role may email any notification');

  -- ── Volume ────────────────────────────────────────────────────────────────
  -- Legitimate flows raise one to a handful. The cap sits far above that and
  -- far below "mail the customer base".
  perform vdtest.act_as(v_attacker);
  for i in 1..v_cap loop
    insert into vd_notifications (user_id, type, title, body)
    values (v_customer, 'info', 'burst ' || i, 'body');
  end loop;

  perform vdtest.raises(
    format('insert into vd_notifications (user_id, type, title, body) values (%L, %L, %L, %L)',
           v_customer, 'info', 'one too many', 'body'),
    'notification rate limit reached',
    'H5: an account cannot mailshot other people');

  -- Notifying yourself is never counted — a burst of those must not lock you
  -- out of your own notifications.
  perform vdtest.allows(
    format('insert into vd_notifications (user_id, type, title, body) values (%L, %L, %L, %L)',
           v_attacker, 'info', 'note to self', 'body'),
    'notifying yourself is not rate limited');

  -- Staff are exempt: a campaign or a bulk approval is their job.
  perform vdtest.act_as(v_admin);
  for i in 1..(v_cap + 5) loop
    insert into vd_notifications (user_id, type, title, body)
    values (v_customer, 'info', 'campaign ' || i, 'body');
  end loop;
  perform vdtest.ok(true, 'staff are exempt from the cap');

  -- The service role is exempt too — the webhook notifies every supplier on a
  -- multi-operator booking.
  perform vdtest.act_as_service();
  for i in 1..(v_cap + 5) loop
    insert into vd_notifications (user_id, type, title, body)
    values (v_customer, 'payment', 'system ' || i, 'body');
  end loop;
  perform vdtest.ok(
    (select count(*) from vd_notifications where created_by is null) >= v_cap,
    'the service role is exempt from the cap');

  raise notice 'notification provenance: all assertions passed';
end $$;
