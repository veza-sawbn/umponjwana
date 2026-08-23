-- ============================================================================
-- Visit Drakensberg — Close self-service privilege escalation at signup
-- Run AFTER 20260725_business_quotes_roles.sql. Deploy the matching app change
-- (invite / set-level routes, middleware) together with this.
--
-- THE HOLE
--
-- handle_new_user() cast the signup payload's role straight to user_role:
--
--     v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'visitor');
--
-- raw_user_meta_data is the `data` bag on a signup request. It is written by
-- whoever makes the request, and the anon key that authorises that request is
-- public by design — it ships in the browser bundle. So anyone could POST to
-- /auth/v1/signup with {"data":{"role":"admin"}} and land a profiles row with
-- role='admin'. is_admin() reads exactly that column, so the new account
-- immediately satisfied every "Admins ..." policy in the schema: every listing
-- application and the contact details on it, every booking, every profile,
-- and write access to the whole catalog.
--
-- staff_role and ops_role were the same shape one notch down: self-assigning
-- staff_role='finance' put an account into the admin console, because the
-- middleware's isStaff check reads it.
--
-- The tell that this was an oversight rather than a decision: the very same
-- function already allowlisted the *values* of staff_role and ops_role. It
-- checked what the strings were, never who was entitled to send them.
--
-- THE FIX
--
-- Supabase splits user metadata in two, and the split is the security
-- boundary: raw_user_meta_data is user-writable (at signup, and afterwards via
-- auth.updateUser), while raw_app_meta_data can only be written with the
-- service role. Privileged assignments therefore come from app_metadata; the
-- signup payload can ask for nothing beyond 'supplier', which is inert on its
-- own because is_active_supplier() also demands is_approved, and that flag
-- only moves through admin_set_supplier_approval().
--
-- The middleware already carried a comment saying roles belong in app_metadata
-- — it just kept a user_metadata fallback, and the invite route wrote to the
-- wrong bag. Both are corrected in the same change.
--
-- EXISTING ACCOUNTS ARE NOT TOUCHED
--
-- This migration cannot tell an admin who was promoted legitimately from one
-- who assigned it to themselves, and guessing would either leave an intruder
-- in place or lock the owners out of their own platform. Audit them by hand —
-- the query at the bottom lists every privileged account with the role its
-- signup payload asked for.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. handle_new_user(): privileged fields from app_metadata only.
--    Everything else about this function is unchanged from what is live —
--    the ops_role handling, the organisation default and the customer-profile
--    row all behave exactly as before.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role       user_role := 'visitor';
  v_staff_role text      := null;
  v_ops_role   text      := null;
  v_org        text      := null;
  v_granted    text      := null;
  v_asked      text      := null;
begin
  v_granted := new.raw_app_meta_data->>'role';
  v_asked   := new.raw_user_meta_data->>'role';

  -- Service-role grant (invites, back office) wins and may say anything valid.
  if v_granted in ('admin', 'supplier', 'visitor') then
    v_role := v_granted::user_role;
  -- Otherwise this is a self-service signup: 'supplier' is the ceiling, and it
  -- grants nothing until an admin approves the account.
  elsif v_asked = 'supplier' then
    v_role := 'supplier';
  else
    v_role := 'visitor';
  end if;

  if new.raw_app_meta_data->>'staff_role' in ('finance', 'operations') then
    v_staff_role := new.raw_app_meta_data->>'staff_role';
  end if;

  if new.raw_app_meta_data->>'ops_role' in (
    'reservation_agent', 'reservations_manager', 'asset_manager', 'ops_administrator'
  ) then
    v_ops_role   := new.raw_app_meta_data->>'ops_role';
    v_org        := coalesce(
                      new.raw_app_meta_data->>'organisation',
                      new.raw_user_meta_data->>'organisation',
                      'vd_operations'
                    );
    v_staff_role := 'operations';
  end if;

  insert into profiles (id, full_name, email, role, staff_role, ops_role, organisation)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    v_role,
    v_staff_role,
    v_ops_role,
    v_org
  )
  on conflict (id) do nothing;

  insert into vd_customer_profiles (user_id, acquisition_source, first_seen_at, lifecycle_stage)
  values (new.id, coalesce(new.raw_user_meta_data->>'acquisition_source', 'direct'), now(), 'prospect')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- The trigger itself is unchanged; re-asserted so this migration is complete
-- on a database where it was somehow dropped.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Promotion stays where it already was.
--    admin_set_role() and admin_set_staff_role() are unchanged: both are
--    SECURITY DEFINER, both check is_admin() first, and admin_set_role also
--    refuses to let a caller change their own role. Nothing new is needed —
--    the point of this migration is that they become the *only* way in.
-- ────────────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────────────────────
-- 3. AUDIT — run this by hand after applying. It lists every account that
--    currently holds elevated access, next to the role its own signup payload
--    asked for. A row where user_metadata already said 'admin' is one the old
--    trigger would have handed admin to on the spot; treat it as suspect
--    unless you know you invited that person.
--
--    Demote with: select admin_set_role('<uuid>', 'visitor');
--    (as an admin session — the RPC will not let you demote yourself)
--
--  select p.id, p.email, p.role, p.staff_role, p.created_at,
--         u.raw_user_meta_data->>'role'     as signup_asked_for,
--         u.raw_app_meta_data->>'role'      as granted_server_side,
--         u.last_sign_in_at
--    from profiles p
--    join auth.users u on u.id = p.id
--   where p.role = 'admin'
--      or p.staff_role in ('finance', 'operations')
--   order by p.created_at;
-- ────────────────────────────────────────────────────────────────────────────
