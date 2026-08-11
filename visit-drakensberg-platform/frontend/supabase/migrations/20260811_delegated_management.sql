-- ============================================================================
-- Visit Drakensberg — Delegated Supplier Management
-- Run AFTER 20260810_invoice_open_by_id.sql.
--
-- Introduces the Visit Drakensberg Operations Organisation layer:
--
--   Internal Employee (profiles.organisation = 'vd_operations')
--     ↓
--   Operational Role (profiles.ops_role)
--     ↓
--   Management Assignment (vd_ops_assignments)
--     ↓
--   Supplier (profiles.role = 'supplier')
--     ↓
--   Supplier Type (profiles.supplier_type)
--     ↓
--   Existing supplier-specific tools (unchanged)
--
-- Principles enforced here:
--   * Existing supplier architecture is NOT modified.
--   * Management assignment determines WHO can operate a supplier's tools.
--   * Supplier type continues to determine WHAT tools a supplier has.
--   * All ops employee actions are attributable in the audit log.
--   * RLS enforces access at every layer — URL manipulation cannot bypass it.
--   * Commission and agreement terms are extended additively at supplier level.
--   * All new DB columns are backwards-compatible with NULL/default fallbacks.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Profiles: add ops_role and organisation columns
--    ops_role refines the existing staff_role='operations' with granular levels.
--    organisation marks which internal team the employee belongs to.
--    Existing role/staff_role/is_approved are NOT changed.
-- ────────────────────────────────────────────────────────────────────────────
alter table profiles
  add column if not exists ops_role     text,            -- reservation_agent | reservations_manager | asset_manager | ops_administrator
  add column if not exists organisation text;            -- 'vd_operations' for VD internal employees

-- Validate ops_role values via a check constraint (additive, non-breaking)
do $$ begin
  alter table profiles add constraint profiles_ops_role_check
    check (ops_role is null or ops_role in (
      'reservation_agent', 'reservations_manager', 'asset_manager', 'ops_administrator'
    ));
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. is_vd_ops() helper — true for any VD Operations employee
--    (keeps existing is_ops() working; ops_role is more granular)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_vd_ops()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and organisation = 'vd_operations'
      and ops_role is not null
  )
$$;
grant execute on function public.is_vd_ops() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. vd_ops_assignments — the management relationship
--    One row = one employee authorised to manage one supplier.
--    Supports many-to-many: one employee → many suppliers; many employees → one supplier.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_ops_assignments (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references auth.users(id) on delete cascade,
  supplier_id    uuid not null references auth.users(id) on delete cascade,
  -- permissions: array of permission strings granted for this supplier only.
  -- Possible values: view_supplier, edit_supplier, view_inventory, manage_inventory,
  -- view_availability, manage_availability, view_rates, manage_rates, view_bookings,
  -- manage_bookings, view_customers, manage_customers, manage_content, manage_packages,
  -- view_financials, manage_financials, view_contract, manage_contract
  permissions    text[] not null default '{}',
  started_at     date not null default current_date,
  ended_at       date,               -- null = no expiry
  is_active      boolean not null default true,
  assigned_by    uuid references auth.users(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, supplier_id)
);

create index if not exists vd_ops_assignments_employee_idx on vd_ops_assignments (employee_id);
create index if not exists vd_ops_assignments_supplier_idx on vd_ops_assignments (supplier_id);
create index if not exists vd_ops_assignments_active_idx   on vd_ops_assignments (is_active, ended_at);

alter table vd_ops_assignments enable row level security;

drop policy if exists "Ops employees read own assignments"   on vd_ops_assignments;
drop policy if exists "Admins manage assignments"            on vd_ops_assignments;

-- Employees can read their own assignments (to populate the managed-suppliers dashboard)
create policy "Ops employees read own assignments" on vd_ops_assignments
  for select using (employee_id = auth.uid());

-- Admins manage all assignments
create policy "Admins manage assignments" on vd_ops_assignments
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Helper: get the list of supplier IDs the current user is actively assigned to
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_managed_supplier_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(
    array_agg(supplier_id),
    '{}'::uuid[]
  )
  from vd_ops_assignments
  where employee_id = auth.uid()
    and is_active = true
    and (ended_at is null or ended_at >= current_date)
$$;
grant execute on function public.vd_managed_supplier_ids() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Helper: check if current user can manage a specific supplier
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_managed_supplier(p_supplier_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vd_ops_assignments
    where employee_id = auth.uid()
      and supplier_id = p_supplier_id
      and is_active = true
      and (ended_at is null or ended_at >= current_date)
  )
$$;
grant execute on function public.is_managed_supplier(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Helper: check if current user has a specific permission for a supplier
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.has_supplier_permission(p_supplier_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vd_ops_assignments
    where employee_id = auth.uid()
      and supplier_id = p_supplier_id
      and is_active = true
      and (ended_at is null or ended_at >= current_date)
      and (p_permission = any(permissions) or is_admin())
  )
$$;
grant execute on function public.has_supplier_permission(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Admin helper: assign/update a management assignment
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_ops_assignment(
  p_employee_id  uuid,
  p_supplier_id  uuid,
  p_permissions  text[],
  p_is_active    boolean default true,
  p_ended_at     date    default null,
  p_notes        text    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;

  insert into vd_ops_assignments (
    employee_id, supplier_id, permissions, is_active, ended_at, notes, assigned_by
  ) values (
    p_employee_id, p_supplier_id, p_permissions, p_is_active, p_ended_at, p_notes, auth.uid()
  )
  on conflict (employee_id, supplier_id) do update
    set permissions  = excluded.permissions,
        is_active    = excluded.is_active,
        ended_at     = excluded.ended_at,
        notes        = excluded.notes,
        assigned_by  = excluded.assigned_by,
        updated_at   = now()
  returning id into v_id;

  perform vd_audit(
    'ops.assignment_set',
    'ops_assignment',
    v_id::text,
    jsonb_build_object(
      'employeeId', p_employee_id,
      'supplierId', p_supplier_id,
      'permissions', p_permissions,
      'isActive', p_is_active
    )
  );

  return v_id;
end;
$$;
grant execute on function public.admin_set_ops_assignment(uuid, uuid, text[], boolean, date, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Admin helper: set ops_role and organisation on a profile
--    Separate from staff_role to preserve the existing 'operations' access.
--    An ops employee keeps staff_role = 'operations' AND gets ops_role/organisation.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_ops_profile(
  p_user         uuid,
  p_ops_role     text,
  p_organisation text default 'vd_operations'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_ops_role is not null and p_ops_role not in (
    'reservation_agent', 'reservations_manager', 'asset_manager', 'ops_administrator'
  ) then
    raise exception 'unknown ops_role %', p_ops_role;
  end if;
  update profiles
     set ops_role     = p_ops_role,
         organisation  = case when p_ops_role is not null then p_organisation else null end,
         -- Also set staff_role = 'operations' so existing is_ops() / middleware works
         staff_role    = case when p_ops_role is not null then 'operations' else staff_role end,
         updated_at   = now()
   where id = p_user;
end;
$$;
grant execute on function public.admin_set_ops_profile(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Extend vd_entities RLS to allow managed-supplier access
--    An ops employee with an active assignment can read/write entities
--    belonging to their managed suppliers.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Managed ops agents read entities"  on vd_entities;
drop policy if exists "Managed ops agents write entities" on vd_entities;

-- Read: employee can see entities whose owner_id is in their managed supplier list
create policy "Managed ops agents read entities" on vd_entities
  for select using (
    owner_id is not null
    and is_managed_supplier(owner_id)
  );

-- Write (insert + update): employee needs manage_inventory or manage_content permission
create policy "Managed ops agents write entities" on vd_entities
  for insert with check (
    owner_id is not null
    and has_supplier_permission(owner_id, 'manage_inventory')
  );

create policy "Managed ops agents update entities" on vd_entities
  for update using (
    owner_id is not null
    and (
      has_supplier_permission(owner_id, 'manage_inventory')
      or has_supplier_permission(owner_id, 'manage_content')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Extend vd_order_lines RLS to allow managed-supplier access
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Managed ops agents read lines"   on vd_order_lines;
drop policy if exists "Managed ops agents update lines" on vd_order_lines;

create policy "Managed ops agents read lines" on vd_order_lines
  for select using (
    supplier_id is not null
    and is_managed_supplier(supplier_id)
    and has_supplier_permission(supplier_id, 'view_bookings')
  );

create policy "Managed ops agents update lines" on vd_order_lines
  for update using (
    supplier_id is not null
    and has_supplier_permission(supplier_id, 'manage_bookings')
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 11. Extend vd_message_threads RLS to allow managed-supplier access
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Managed ops agents access threads" on vd_message_threads;

create policy "Managed ops agents access threads" on vd_message_threads
  for all using (
    supplier_id is not null
    and has_supplier_permission(supplier_id, 'manage_customers')
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 12. Extend vd_bookings RLS to allow managed-supplier access
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Managed ops agents read bookings" on vd_bookings;
drop policy if exists "Managed ops agents update bookings" on vd_bookings;

create policy "Managed ops agents read bookings" on vd_bookings
  for select using (
    exists (
      select 1
      from unnest(supplier_ids) as s_id
      where is_managed_supplier(s_id)
        and has_supplier_permission(s_id, 'view_bookings')
    )
  );

create policy "Managed ops agents update bookings" on vd_bookings
  for update using (
    exists (
      select 1
      from unnest(supplier_ids) as s_id
      where has_supplier_permission(s_id, 'manage_bookings')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 13. Supplier management model extension — additive columns on vd_supplier_terms
--    management_model: 'supplier_managed' (default) | 'vd_managed'
--    management_status: 'active' | 'pending_agreement' | 'suspended' | 'terminated'
--    agreement_type: 'marketplace_agreement' | 'managed_asset_agreement'
--    management_fee: optional fixed fee (in addition to commission)
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_supplier_terms
  add column if not exists management_model   text not null default 'supplier_managed',
  add column if not exists management_status  text not null default 'active',
  add column if not exists agreement_type     text,
  add column if not exists management_fee     numeric,       -- fixed monthly/annual management fee
  add column if not exists agreement_effective_date date,
  add column if not exists agreement_expiry_date    date,
  add column if not exists agreement_reference text,         -- contract/document reference
  add column if not exists agreement_notes    text,
  add column if not exists updated_by         uuid references auth.users(id) on delete set null;

-- Validate management model values
do $$ begin
  alter table vd_supplier_terms add constraint vd_supplier_terms_management_model_check
    check (management_model in ('supplier_managed', 'vd_managed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table vd_supplier_terms add constraint vd_supplier_terms_management_status_check
    check (management_status in ('active', 'pending_agreement', 'suspended', 'terminated'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table vd_supplier_terms add constraint vd_supplier_terms_agreement_type_check
    check (agreement_type is null or agreement_type in (
      'marketplace_agreement', 'managed_asset_agreement'
    ));
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 14. Extend vd_audit_log with operator context columns
--    When a VD employee acts on behalf of a managed supplier, these fields
--    capture the full attribution chain: who, from what org, for which supplier.
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_audit_log
  add column if not exists managed_supplier_id uuid,    -- which supplier was being managed
  add column if not exists actor_organisation   text,   -- 'vd_operations' etc
  add column if not exists actor_ops_role       text;   -- the ops role at time of action

-- ────────────────────────────────────────────────────────────────────────────
-- 15. Enhanced vd_audit() — preserves existing signature (4 params), adds
--     operator context overload. The existing 4-param version now auto-
--     enriches with ops context when the actor is a managed employee.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_audit(
  p_action       text,
  p_entity       text,
  p_entity_id    text,
  p_details      jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_org  text;
  v_role text;
begin
  -- Enrich with ops context if the actor is a VD operations employee
  select organisation, ops_role
    into v_org, v_role
    from profiles
   where id = auth.uid();

  insert into vd_audit_log (actor_id, action, entity, entity_id, details, actor_organisation, actor_ops_role)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details, v_org, v_role);
end;
$$;
grant execute on function public.vd_audit(text, text, text, jsonb) to authenticated;

-- Extended version that also captures the managed supplier context
create or replace function public.vd_audit_ops(
  p_action       text,
  p_entity       text,
  p_entity_id    text,
  p_details      jsonb,
  p_supplier_id  uuid   -- the supplier being managed when this action occurred
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_org  text;
  v_role text;
begin
  select organisation, ops_role
    into v_org, v_role
    from profiles
   where id = auth.uid();

  insert into vd_audit_log (
    actor_id, action, entity, entity_id, details,
    managed_supplier_id, actor_organisation, actor_ops_role
  )
  values (
    auth.uid(), p_action, p_entity, p_entity_id, p_details,
    p_supplier_id, v_org, v_role
  );
end;
$$;
grant execute on function public.vd_audit_ops(text, text, text, jsonb, uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 16. View: vd_ops_assignment_details
--     Joins assignments with employee and supplier profile data for the
--     admin Operations UI. Avoids needing a complex client-side join.
-- ────────────────────────────────────────────────────────────────────────────
create or replace view vd_ops_assignment_details as
  select
    a.id,
    a.employee_id,
    ep.full_name   as employee_name,
    ep.email       as employee_email,
    ep.ops_role,
    ep.organisation,
    a.supplier_id,
    sp.full_name   as supplier_name,
    sp.email       as supplier_email,
    sp.supplier_type,
    sp.approval_status,
    a.permissions,
    a.started_at,
    a.ended_at,
    a.is_active,
    a.notes,
    a.assigned_by,
    a.created_at,
    a.updated_at,
    -- Management model from supplier terms (if set)
    st.management_model,
    st.management_status,
    st.agreement_type,
    st.commission_rate
  from vd_ops_assignments a
  join profiles ep on ep.id = a.employee_id
  join profiles sp on sp.id = a.supplier_id
  left join vd_supplier_terms st on st.supplier_id = a.supplier_id;

-- ────────────────────────────────────────────────────────────────────────────
-- 17. View: vd_managed_suppliers_summary
--     Used by the employee's operations dashboard to list their assigned suppliers.
--     Only returns rows for the currently authenticated employee.
-- ────────────────────────────────────────────────────────────────────────────
create or replace view vd_managed_suppliers_summary as
  select
    a.supplier_id,
    sp.full_name          as supplier_name,
    sp.email              as supplier_email,
    sp.supplier_type,
    sp.approval_status,
    a.permissions,
    a.is_active,
    a.started_at,
    a.ended_at,
    coalesce(st.management_model,   'supplier_managed')       as management_model,
    coalesce(st.management_status,  'active')                 as management_status,
    coalesce(st.agreement_type,     'marketplace_agreement')  as agreement_type,
    st.commission_rate,
    st.management_fee
  from vd_ops_assignments a
  join profiles sp on sp.id = a.supplier_id
  left join vd_supplier_terms st on st.supplier_id = a.supplier_id
  where a.employee_id = auth.uid()
    and a.is_active = true
    and (a.ended_at is null or a.ended_at >= current_date);

-- ────────────────────────────────────────────────────────────────────────────
-- 18. Update handle_new_user() to seed ops_role + organisation from invite metadata
--     Extends the existing trigger without changing existing behavior.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role      user_role := 'visitor';
  v_staff_role text     := null;
  v_ops_role  text      := null;
  v_org       text      := null;
begin
  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'visitor');
  exception when others then
    v_role := 'visitor';
  end;

  if new.raw_user_meta_data->>'staff_role' in ('finance', 'operations') then
    v_staff_role := new.raw_user_meta_data->>'staff_role';
  end if;

  -- Seed ops_role and organisation from invite metadata
  if new.raw_user_meta_data->>'ops_role' in (
    'reservation_agent', 'reservations_manager', 'asset_manager', 'ops_administrator'
  ) then
    v_ops_role  := new.raw_user_meta_data->>'ops_role';
    v_org       := coalesce(new.raw_user_meta_data->>'organisation', 'vd_operations');
    -- Ensure staff_role = 'operations' so existing middleware/RLS works
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

  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 19. vd_audit_log: extend RLS so ops employees can read audits of their suppliers
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Ops agents read managed supplier audits" on vd_audit_log;

create policy "Ops agents read managed supplier audits" on vd_audit_log
  for select using (
    managed_supplier_id is not null
    and is_managed_supplier(managed_supplier_id)
  );
