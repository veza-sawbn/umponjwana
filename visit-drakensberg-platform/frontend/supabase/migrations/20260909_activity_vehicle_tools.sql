-- ============================================================================
-- Visit Drakensberg — vehicle-based activities unlock the transport tools
--
-- An activity supplier who drives their own guests (Sani Pass 4x4 runs, game
-- drives, guided tours by minibus) needs the fleet tooling the 'Shuttle'
-- supplier type already carries: /supplier/transport, /supplier/vehicles,
-- /supplier/drivers, /supplier/jobs. Until now the only way to get it was a
-- second listing application — the portal builds its nav from
-- profiles.supplier_type (mergeNavForTypes(), lib/supplier-config.ts), and
-- that column is only ever written at registration/approval
-- (app/api/admin/listing-applications/[id]/decide) or by an admin.
--
-- Ticking "this activity uses your own vehicles" on the activity form now
-- appends 'Shuttle' to that supplier's own supplier_type through this
-- function, so the fleet tools appear beside their Activities nav.
--
-- Why an RPC, when 20260704 already grants authenticated users
-- update (supplier_type) on their own profile row:
--   * an ops employee filling this in for a managed supplier is not
--     auth.uid() = id, so "Users can update own profile" would match zero
--     rows and fail silently — they have been able to READ that profile
--     since 20260819, but never to write it;
--   * the column is free text. A direct client update could put anything in
--     it; this validates against the SupplierType union the portal actually
--     understands, and only ever ADDS, so no client write can drop the tools
--     a supplier already has or store a nav key that resolves to null.
--
-- role / is_approved are untouched: revealing the tools is not approval.
-- Every transport write still passes the same is_active_supplier() RLS gate
-- as before, so an unapproved supplier gains screens, not the ability to
-- publish through them.
-- ============================================================================

create or replace function public.vd_add_supplier_type(p_supplier_id uuid, p_type text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_type    text := nullif(trim(p_type), '');
  v_current text;
begin
  -- Same authorization shape as vd_add_supplier_contact (20260828), in the
  -- null-safe form 20260903 standardised on.
  if not coalesce(p_supplier_id = auth.uid() or is_managed_supplier(p_supplier_id) or is_admin(), false) then
    raise exception 'not authorized for this supplier';
  end if;

  if v_type is null or v_type not in ('Accommodation', 'Activity', 'Guided Tours', 'Shuttle', 'Experience') then
    raise exception 'unknown supplier type: %', p_type;
  end if;

  select supplier_type into v_current from profiles where id = p_supplier_id;
  if not found then
    raise exception 'no profile for supplier %', p_supplier_id;
  end if;

  -- Compared element-wise against the comma-separated list rather than with a
  -- LIKE, so 'Guided Tours' is never read as already containing 'Tours'.
  if v_type = any (select trim(part) from unnest(string_to_array(coalesce(v_current, ''), ',')) as u(part)) then
    return false;
  end if;

  update profiles
     set supplier_type = case
           when nullif(trim(coalesce(v_current, '')), '') is null then v_type
           else trim(v_current) || ',' || v_type
         end,
         updated_at = now()
   where id = p_supplier_id;

  return true;
end;
$$;

grant execute on function public.vd_add_supplier_type(uuid, text) to authenticated;
