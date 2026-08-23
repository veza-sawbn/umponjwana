-- ────────────────────────────────────────────────────────────────────────────
-- Booking staff assignment
--
-- Lets whoever can manage a booking line (ops with manage_bookings on that
-- supplier, or the supplier themselves) appoint one of the supplier's own
-- roster entries (a guide or a driver — vd_entities kind supplier_guides /
-- supplier_drivers) as the person responsible for delivering it. The line
-- carries a denormalised snapshot (name/email) at assignment time rather
-- than a live join, since the roster entity's email may change later and
-- we want the email that was actually notified to stay on record.
--
-- Roster entities are not platform users (no auth.users row), so this can't
-- reuse vd_notifications/notify() — the app layer sends the email directly
-- once this RPC hands back the recipient, see
-- app/api/notifications/staff-assignment/route.ts.
-- ────────────────────────────────────────────────────────────────────────────

alter table vd_order_lines
  add column if not exists assigned_kind      text,          -- 'guides' | 'drivers'
  add column if not exists assigned_entity_id text,           -- vd_entities.id
  add column if not exists assigned_name      text,
  add column if not exists assigned_email     text,
  add column if not exists assigned_at        timestamptz,
  add column if not exists assigned_by        uuid references auth.users(id) on delete set null;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: appoint a roster entity to a line. Validates the entity actually
-- belongs to the line's supplier and reads its name/email server-side (never
-- trusts the caller for those), so the recipient can't be spoofed.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_assign_line_staff(p_line_id text, p_kind text, p_entity_id text)
returns table(name text, email text) language plpgsql security definer set search_path = public as $$
declare
  v_line vd_order_lines%rowtype;
  v_name text;
  v_email text;
begin
  if p_kind not in ('guides', 'drivers') then
    raise exception 'invalid staff kind';
  end if;

  select * into v_line from vd_order_lines where id = p_line_id for update;
  if not found then raise exception 'line not found'; end if;
  if v_line.supplier_id is null then raise exception 'line has no supplier'; end if;

  if auth.uid() is null or (
    v_line.supplier_id is distinct from auth.uid()
    and not has_supplier_permission(v_line.supplier_id, 'manage_bookings')
  ) then
    raise exception 'not allowed';
  end if;

  select value->>'name', nullif(trim(value->>'email'), '')
    into v_name, v_email
    from vd_entities
   where id = p_entity_id and kind = 'supplier_' || p_kind and owner_id = v_line.supplier_id;

  if v_name is null then raise exception 'staff member not found for this supplier'; end if;
  if v_email is null then raise exception 'this person has no email on file — add one under Guides or Drivers first'; end if;

  update vd_order_lines set
    assigned_kind      = p_kind,
    assigned_entity_id = p_entity_id,
    assigned_name       = v_name,
    assigned_email      = v_email,
    assigned_at          = now(),
    assigned_by          = auth.uid(),
    updated_at           = now()
  where id = p_line_id;

  perform vd_audit('line.assign_staff', 'order_line', p_line_id,
    jsonb_build_object('kind', p_kind, 'entity_id', p_entity_id, 'name', v_name));

  return query select v_name, v_email;
end;
$$;
grant execute on function public.vd_assign_line_staff(text, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: clear an assignment (reassign-from-scratch or the trip fell through).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_clear_line_staff(p_line_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_line vd_order_lines%rowtype;
begin
  select * into v_line from vd_order_lines where id = p_line_id for update;
  if not found then raise exception 'line not found'; end if;

  if auth.uid() is null or (
    v_line.supplier_id is distinct from auth.uid()
    and not has_supplier_permission(v_line.supplier_id, 'manage_bookings')
  ) then
    raise exception 'not allowed';
  end if;

  update vd_order_lines set
    assigned_kind = null, assigned_entity_id = null, assigned_name = null,
    assigned_email = null, assigned_at = null, assigned_by = null,
    updated_at = now()
  where id = p_line_id;

  perform vd_audit('line.unassign_staff', 'order_line', p_line_id, '{}'::jsonb);
end;
$$;
grant execute on function public.vd_clear_line_staff(text) to authenticated;
