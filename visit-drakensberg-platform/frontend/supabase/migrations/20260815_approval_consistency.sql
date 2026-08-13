-- ============================================================================
-- Visit Drakensberg — supplier approval consistency
--
-- profiles stores approval twice:
--
--   is_approved      boolean  — the OPERATIVE flag. is_active_supplier() reads
--                               only this, and that function gates every
--                               vd_entities insert via the RLS policy
--                               "Suppliers insert own".
--   approval_status  text     — tri-state (pending/approved/suspended/rejected)
--                               used by the admin verification console.
--
-- When the two drift, a supplier can be shown as approved while every save is
-- refused by RLS — which is exactly what "Could not save the profile" was.
--
-- This migration reconciles existing rows and installs a trigger so the two
-- can never disagree again, whichever one a caller writes.
-- ============================================================================

-- ─── 1. Reconcile existing rows ─────────────────────────────────────────────
-- Approved in either representation counts as approved: both paths express a
-- deliberate admin action, and the failure mode of under-approving (silent
-- write refusals) is worse than the alternative.
update profiles
   set is_approved     = true,
       approval_status = 'approved'
 where role = 'supplier'
   and (is_approved is true or approval_status = 'approved')
   and (is_approved is distinct from true or approval_status is distinct from 'approved');

-- Everything else lines up behind approval_status, which carries more detail
-- (suspended and rejected have no boolean equivalent — both mean not active).
update profiles
   set is_approved = (approval_status = 'approved')
 where role = 'supplier'
   and approval_status in ('pending', 'suspended', 'rejected')
   and is_approved is distinct from false;

-- ─── 2. Keep them in step from here on ──────────────────────────────────────
create or replace function public.profiles_sync_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Seed whichever side wasn't supplied.
    if new.approval_status is null then
      new.approval_status := case when new.is_approved then 'approved' else 'pending' end;
    else
      new.is_approved := (new.approval_status = 'approved');
    end if;
    return new;
  end if;

  -- UPDATE: follow whichever column the caller actually changed. When both
  -- move together (admin_set_supplier_status does this) they already agree,
  -- so neither branch fires and the write passes through untouched.
  if new.approval_status is distinct from old.approval_status then
    new.is_approved := (new.approval_status = 'approved');
  elsif new.is_approved is distinct from old.is_approved then
    new.approval_status := case when new.is_approved then 'approved' else 'pending' end;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_approval_trg on profiles;
create trigger profiles_sync_approval_trg
  before insert or update on profiles
  for each row execute function public.profiles_sync_approval();

-- ─── 3. Check what changed ──────────────────────────────────────────────────
--   select id, email, role, is_approved, approval_status
--     from profiles
--    where role = 'supplier'
--    order by approval_status, email;
--
-- After this migration no supplier row should show is_approved = false
-- alongside approval_status = 'approved'.
