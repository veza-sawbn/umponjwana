-- ============================================================================
-- Visit Drakensberg — Grand Tour tools belong to VD Operations
--
-- Run AFTER 20261008_grand_tour_boarding.sql.
--
-- The Grand Tour is run by Visit Drakensberg, not by each supplier: VD
-- Operations decides which activities are on it, which highlights they
-- visit and which hotels they collect from, and VD Operations boards the
-- guests. Suppliers keep listing and pricing their activities and scanning
-- their own event tickets. The tools moved in the UI (/operations/grand-tour
-- and /operations/boarding); this migration makes the database agree, so a
-- supplier cannot do through the API what the portal no longer offers.
--
--   1. vd_entities: only staff, an ops employee holding manage_inventory on
--      the activity's supplier, the service role, or a direct database
--      session (the SQL editor, migrations) may set or change an activity's
--      `grandTour` listing. Anyone else's write keeps the stored listing as
--      it was, so a supplier saving their activity form never clears it.
--   2. vd_redeem_ticket: a ticket for a Grand Tour day tour is boarded by
--      staff or an ops employee holding manage_bookings on its supplier —
--      not by the supplier. Other tickets are unchanged.
-- ============================================================================
-- @rollback: reversible — drop trigger vd_entities_grand_tour_guard on vd_entities; drop function vd_guard_grand_tour_listing(); and restore vd_redeem_ticket from 20261008_grand_tour_boarding.sql

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Who may set an activity's Grand Tour listing
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_guard_grand_tour_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'activity' then return new; end if;

  -- No JWT claims means no API request: a direct database session.
  if current_setting('request.jwt.claims', true) is null
     or coalesce(auth.role() = 'service_role', false)
     or is_admin()
     or (new.owner_id is not null and has_supplier_permission(new.owner_id, 'manage_inventory')) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.value := new.value - 'grandTour';
  elsif old.value ? 'grandTour' then
    new.value := jsonb_set(new.value, '{grandTour}', old.value->'grandTour', true);
  else
    new.value := new.value - 'grandTour';
  end if;
  return new;
end;
$$;

drop trigger if exists vd_entities_grand_tour_guard on vd_entities;
create trigger vd_entities_grand_tour_guard
  before insert or update of value on vd_entities
  for each row execute function public.vd_guard_grand_tour_listing();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Grand Tour tickets are boarded by VD Operations
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_redeem_ticket(
  p_ticket_id uuid,
  p_token     text,
  p_via       text default 'scan'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ticket vd_tickets;
  v_today  date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into v_ticket from vd_tickets where id = p_ticket_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- A Grand Tour day tour is boarded by VD Operations: staff, or an ops
  -- employee holding manage_bookings on the tour's supplier. Every other
  -- ticket (events, ordinary timeslotted activities) also admits the
  -- supplier who issued it, as before.
  if v_ticket.activity_id is not null and exists (
       select 1 from vd_entities
        where id = v_ticket.activity_id and (value#>>'{grandTour,enabled}') = 'true'
     ) then
    if not (is_admin() or has_supplier_permission(v_ticket.supplier_id, 'manage_bookings')) then
      raise exception 'Grand Tour tickets are boarded by VD Operations';
    end if;
  elsif not (v_ticket.supplier_id = auth.uid() or is_admin()
             or has_supplier_permission(v_ticket.supplier_id, 'manage_bookings')) then
    raise exception 'not authorized to redeem this ticket';
  end if;

  if v_ticket.token <> p_token then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  if v_ticket.status = 'void' then
    return jsonb_build_object('ok', false, 'reason', 'void', 'ticket', to_jsonb(v_ticket));
  end if;

  if v_ticket.status = 'redeemed' then
    return jsonb_build_object(
      'ok', false, 'reason', 'already_redeemed',
      'redeemed_at', v_ticket.redeemed_at,
      'redeemed_by', v_ticket.redeemed_by,
      'ticket', to_jsonb(v_ticket)
    );
  end if;

  if v_ticket.activity_id is not null and v_ticket.slot_date <> v_today then
    return jsonb_build_object(
      'ok', false, 'reason', 'wrong_date',
      'slot_date', v_ticket.slot_date,
      'ticket', to_jsonb(v_ticket)
    );
  end if;

  update vd_tickets
     set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid(),
         redeemed_via = case when p_via = 'manual' then 'manual' else 'scan' end
   where id = p_ticket_id
   returning * into v_ticket;

  return jsonb_build_object('ok', true, 'ticket', to_jsonb(v_ticket));
end;
$$;

revoke execute on function public.vd_redeem_ticket(uuid, text, text) from public, anon;
grant execute on function public.vd_redeem_ticket(uuid, text, text) to authenticated;
