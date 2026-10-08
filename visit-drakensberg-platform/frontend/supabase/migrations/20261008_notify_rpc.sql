-- ============================================================================
-- Visit Drakensberg — Notifications to other people actually get delivered
--
-- THE BUG
--   lib/notifications.ts notify() inserts into vd_notifications and asks for
--   the new row's id back (`.insert(...).select('id')`) so it can email it.
--   PostgREST turns that into INSERT … RETURNING, and RETURNING is checked
--   against the SELECT policy — "Users read own notifications" (user_id =
--   auth.uid()). A notification FOR someone else is, by definition, not the
--   sender's to read, so Postgres rejects the whole insert:
--
--     new row violates row-level security policy for table "vd_notifications"
--
--   notify() swallows errors by design, so nothing surfaced. Since
--   20260913_notification_provenance_and_seat_authorization.sql every
--   guest → supplier and supplier → guest notification (new messages, trip
--   requests, quotes, itinerary updates…) was silently dropped. Only admins'
--   got through.
--
-- THE FIX
--   vd_notify() inserts on the caller's behalf and returns the new ids. It is
--   security definer only so that the id can come back; everything the
--   provenance migration put in place still applies, because the insert still
--   fires vd_stamp_notification_sender: created_by is the caller (auth.uid()
--   reads the request's JWT, not the function owner), and the hourly cap on
--   notifying other people still counts every row. The email route still only
--   mails rows the caller created (vd_notification_for_email).
--
-- VD OPERATIONS STAFF
--   With p_include_managers, the same notification also goes to every VD
--   Operations employee actively assigned to the recipient supplier with
--   'manage_customers' or 'view_bookings' — the people who actually run that
--   supplier's portal. Their link opens the managed-supplier console, which is
--   how they enter that supplier's portal.
-- ============================================================================
-- @rollback: reversible — drop function vd_notify(uuid, text, text, text, text, boolean);

create or replace function public.vd_notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text default null,
  p_include_managers boolean default false
) returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[] := '{}';
  v_id  uuid;
  r     record;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_user_id is null then
    return v_ids;
  end if;

  insert into vd_notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link)
  returning id into v_id;
  v_ids := v_ids || v_id;

  if p_include_managers then
    for r in
      select distinct a.employee_id
        from vd_ops_assignments a
       where a.supplier_id = p_user_id
         and a.is_active
         and (a.ended_at is null or a.ended_at >= current_date)
         and ('manage_customers' = any(a.permissions) or 'view_bookings' = any(a.permissions))
         and a.employee_id <> p_user_id
         and a.employee_id <> auth.uid()
    loop
      insert into vd_notifications (user_id, type, title, body, link)
      values (r.employee_id, p_type, p_title, p_body,
              '/admin/operations/managed-suppliers/' || p_user_id::text)
      returning id into v_id;
      v_ids := v_ids || v_id;
    end loop;
  end if;

  return v_ids;
end $$;

revoke all on function public.vd_notify(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.vd_notify(uuid, text, text, text, text, boolean) to authenticated;
