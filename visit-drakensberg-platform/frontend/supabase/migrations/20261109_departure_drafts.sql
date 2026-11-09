-- ============================================================================
-- Visit Drakensberg — Draft departures
-- Run AFTER 20261102_checkout_seat_cleanup.sql.
--
-- A supplier (or ops managing them) can save a departure as a draft and
-- publish it later. A draft is a departure whose status is 'draft':
--
--   * The public read policy on vd_entities ("Public entities are readable")
--     only lists active/open/confirmed/full/verified, so a draft is already
--     invisible to visitors and other suppliers. Only its owner, people
--     managing that supplier, and admins can read it.
--   * vd_hold_inventory is SECURITY DEFINER, so it would still hold seats on a
--     draft for anyone who knew its id. Holds on a draft are now refused.
--   * vd_inventory_adjust turns a departure 'full' when its last seat goes
--     (an operator adding guests by hand). That would publish a draft, so a
--     seat-count change keeps a draft a draft.
--   * A published departure can go back to draft only while no seat is taken,
--     checked against the row as it is when the update lands (the same row
--     vd_hold_inventory locks), not the supplier's page.
-- ============================================================================
-- @rollback: additive — drop trigger vd_inventory_holds_no_draft_trg on vd_inventory_holds; drop trigger vd_entities_keep_draft_trg on vd_entities; drop function vd_inventory_holds_no_draft(); drop function vd_entities_keep_draft()

create or replace function public.vd_inventory_holds_no_draft()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'departure' and exists (
       select 1 from vd_entities
        where id = new.entity_id and kind = 'departure' and status = 'draft') then
    raise exception 'this departure is not open for booking yet';
  end if;
  return new;
end;
$$;
revoke all on function public.vd_inventory_holds_no_draft() from public, anon, authenticated;

drop trigger if exists vd_inventory_holds_no_draft_trg on public.vd_inventory_holds;
create trigger vd_inventory_holds_no_draft_trg
  before insert on public.vd_inventory_holds
  for each row execute function public.vd_inventory_holds_no_draft();

create or replace function public.vd_entities_keep_draft()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Only a seat-count change (vd_inventory_adjust) is held back. Publishing
  -- leaves bookedSeats alone and goes through, 'full' included.
  if new.kind = 'departure' and old.status = 'draft' and new.status = 'full'
     and (new.value->'bookedSeats') is distinct from (old.value->'bookedSeats') then
    new.status := 'draft';
    new.value  := new.value || jsonb_build_object('status', 'draft');
  end if;
  if new.kind = 'departure' and new.status = 'draft' and old.status <> 'draft'
     and coalesce((old.value->>'bookedSeats')::int, 0) > 0 then
    raise exception 'guests already hold seats on this departure, so it cannot go back to draft';
  end if;
  return new;
end;
$$;

drop trigger if exists vd_entities_keep_draft_trg on public.vd_entities;
create trigger vd_entities_keep_draft_trg
  before update on public.vd_entities
  for each row execute function public.vd_entities_keep_draft();
