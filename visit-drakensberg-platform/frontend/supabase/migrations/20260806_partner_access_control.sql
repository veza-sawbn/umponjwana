-- Partner access control: organisations, establishment-scoped access, and a
-- permission matrix enforced in the database.
--
-- The platform already has listings (vd_entities), staff roles (profiles.role
-- / staff_role) and an audit log. What it cannot express is the partner model:
-- an establishment is owned by exactly one auth user, so there is no way to
-- give two people access to one lodge, to group lodges under a supplier
-- organisation, to grant "rates but not publishing", or to hand an
-- establishment over while Visit Drakensberg keeps publishing authority.
--
-- This adds that layer on top of vd_entities rather than forking the catalog
-- into a parallel establishments table — the public site, checkout and every
-- existing RLS policy keep reading the same rows.
--
-- The security rule that shapes everything here: a supplier's effective
-- permissions are the intersection of three independent limits —
--
--   role permissions  ∩  handover ceiling  ∩  hard supplier allowlist
--
-- then per-user overrides are applied and the result is clamped again. The
-- allowlist is why no combination of role, override or handover level can ever
-- yield listing.publish, commission.edit, supplier.delete or platform.settings.
-- Publishing authority and commercial terms stay with Visit Drakensberg.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Permission catalogue
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_permissions (
  key         text primary key,
  label       text not null,
  category    text not null default 'general',
  -- Platform permissions are Visit Drakensberg's alone. A supplier may never
  -- hold one, whatever their role or overrides say.
  platform_only boolean not null default false
);

insert into vd_permissions (key, label, category, platform_only) values
  ('listing.view',        'View listing',              'listing',      false),
  ('listing.edit',        'Edit listing',              'listing',      false),
  ('listing.suggest',     'Submit corrections',        'listing',      false),
  ('listing.publish',     'Publish listing',           'listing',      true),
  ('photos.upload',       'Upload photos',             'media',        false),
  ('photos.delete',       'Delete photos',             'media',        false),
  ('rates.view',          'View rates',                'commercial',   false),
  ('rates.edit',          'Edit rates',                'commercial',   false),
  ('availability.edit',   'Edit availability',         'commercial',   false),
  ('offers.manage',       'Manage special offers',     'commercial',   false),
  ('bookings.view',       'View bookings',             'bookings',     false),
  ('bookings.manage',     'Manage bookings',           'bookings',     false),
  ('enquiries.respond',   'Respond to enquiries',      'bookings',     false),
  ('payments.view',       'View payment status',       'finance',      false),
  ('reports.view',        'View reports',              'reports',      false),
  ('users.invite',        'Invite establishment users','team',         false),
  ('commission.edit',     'Edit commission terms',     'platform',     true),
  ('supplier.delete',     'Delete supplier',           'platform',     true),
  ('supplier.suspend',    'Suspend supplier access',   'platform',     true),
  ('platform.settings',   'Platform settings',         'platform',     true),
  ('approvals.manage',    'Approve supplier changes',  'platform',     true),
  ('establishment.create','Create establishments',     'platform',     true),
  ('users.manage',        'Manage platform users',     'platform',     true),
  ('seo.edit',            'Edit platform SEO',         'platform',     true),
  ('finance.view',        'Platform finance',          'platform',     true),
  ('impersonate',         'Preview a supplier account','platform',     true)
on conflict (key) do update set
  label = excluded.label, category = excluded.category, platform_only = excluded.platform_only;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Roles and the role → permission matrix
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_roles (
  key       text primary key,
  label     text not null,
  -- 'platform' roles belong to Visit Drakensberg staff; 'supplier' roles are
  -- assignable on an establishment.
  scope     text not null check (scope in ('platform', 'supplier')),
  rank      int  not null default 0
);

insert into vd_roles (key, label, scope, rank) values
  ('super_admin',         'Super Admin',          'platform', 100),
  ('platform_manager',    'Platform Manager',     'platform', 80),
  ('content_editor',      'Content Editor',       'platform', 60),
  ('bookings_officer',    'Bookings Officer',     'platform', 60),
  ('finance_manager',     'Finance Manager',      'platform', 60),
  ('support_agent',       'Support Agent',        'platform', 40),
  ('supplier_owner',      'Supplier Owner',       'supplier', 50),
  ('supplier_manager',    'Supplier Manager',     'supplier', 40),
  ('reservations_staff',  'Reservations Staff',   'supplier', 30),
  ('content_contributor', 'Content Contributor',  'supplier', 20),
  ('viewer',              'Viewer',               'supplier', 10)
on conflict (key) do update set label = excluded.label, scope = excluded.scope, rank = excluded.rank;

create table if not exists vd_role_permissions (
  role_key       text not null references vd_roles(key) on delete cascade,
  permission_key text not null references vd_permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

-- Supplier roles. Note what is absent everywhere: listing.publish.
insert into vd_role_permissions (role_key, permission_key)
select 'supplier_owner', k from unnest(array[
  'listing.view','listing.edit','listing.suggest','photos.upload','photos.delete',
  'rates.view','rates.edit','availability.edit','offers.manage',
  'bookings.view','bookings.manage','enquiries.respond',
  'payments.view','reports.view','users.invite']) k
on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'supplier_manager', k from unnest(array[
  'listing.view','listing.edit','listing.suggest','photos.upload','photos.delete',
  'rates.view','rates.edit','availability.edit','offers.manage',
  'bookings.view','bookings.manage','enquiries.respond','reports.view']) k
on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'reservations_staff', k from unnest(array[
  'listing.view','availability.edit','bookings.view','bookings.manage','enquiries.respond']) k
on conflict do nothing;

-- Contributors edit nothing directly: they suggest, and the change queues for
-- approval (see vd_listing_changes below).
insert into vd_role_permissions (role_key, permission_key)
select 'content_contributor', k from unnest(array[
  'listing.view','listing.suggest','photos.upload']) k
on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'viewer', k from unnest(array['listing.view','bookings.view','reports.view']) k
on conflict do nothing;

-- Platform roles.
insert into vd_role_permissions (role_key, permission_key)
select 'super_admin', key from vd_permissions on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'platform_manager', k from unnest(array[
  'listing.view','listing.edit','listing.publish','listing.suggest',
  'photos.upload','photos.delete','rates.view','rates.edit','availability.edit',
  'offers.manage','bookings.view','bookings.manage','enquiries.respond',
  'payments.view','reports.view','users.invite',
  'approvals.manage','establishment.create','supplier.suspend','seo.edit']) k
on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'content_editor', k from unnest(array[
  'listing.view','listing.edit','listing.publish','photos.upload','photos.delete',
  'approvals.manage','seo.edit']) k
on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'bookings_officer', k from unnest(array[
  'listing.view','bookings.view','bookings.manage','enquiries.respond','reports.view']) k
on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'finance_manager', k from unnest(array[
  'listing.view','rates.view','payments.view','reports.view','finance.view','commission.edit']) k
on conflict do nothing;

insert into vd_role_permissions (role_key, permission_key)
select 'support_agent', k from unnest(array[
  'listing.view','bookings.view','enquiries.respond','reports.view','impersonate']) k
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Supplier organisations
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_organisations (
  id                  text primary key,
  trading_name        text not null default '',
  legal_name          text not null default '',
  registration_number text not null default '',
  vat_number          text not null default '',
  contact_email       text not null default '',
  contact_phone       text not null default '',
  -- Banking and contract terms are commercial data: staff-only, never exposed
  -- through a partner-facing read (see the RLS split below).
  banking_details     jsonb not null default '{}'::jsonb,
  contract_status     text not null default 'pending'
                        check (contract_status in ('pending','active','expired','terminated')),
  verification_status text not null default 'unverified'
                        check (verification_status in ('unverified','in_review','verified','rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists vd_organisation_users (
  organisation_id text not null references vd_organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role_key        text not null references vd_roles(key),
  status          text not null default 'active' check (status in ('active','suspended')),
  created_at      timestamptz not null default now(),
  primary key (organisation_id, user_id)
);
create index if not exists vd_org_users_user_idx on vd_organisation_users (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Establishment access — the heart of the model
-- ────────────────────────────────────────────────────────────────────────────
-- An "establishment" is a vd_entities row (property, activity, tour, …). This
-- table is the only thing that grants a non-admin any authority over one.
create table if not exists vd_establishment_access (
  id                text primary key,
  establishment_id  text not null references vd_entities(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  organisation_id   text references vd_organisations(id) on delete set null,
  role_key          text not null references vd_roles(key),
  -- managed      → Visit Drakensberg still runs the listing; the partner can
  --                look, respond and suggest.
  -- self_managed → the partner runs day-to-day content, rates and availability.
  -- Publishing authority is NOT part of either level.
  handover_level    text not null default 'managed'
                      check (handover_level in ('managed','self_managed')),
  -- Optional per-user narrowing/widening, applied on top of the role and then
  -- re-clamped. Widening can never exceed the ceiling or the allowlist.
  granted_permissions text[] not null default '{}',
  revoked_permissions text[] not null default '{}',
  -- Whether this partner's edits publish directly or queue for review.
  auto_publish      boolean not null default false,
  access_status     text not null default 'active'
                      check (access_status in ('invited','active','suspended','revoked')),
  invited_by        uuid references auth.users(id) on delete set null,
  access_start_date date,
  access_end_date   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (establishment_id, user_id)
);
create index if not exists vd_est_access_user_idx on vd_establishment_access (user_id, access_status);
create index if not exists vd_est_access_est_idx  on vd_establishment_access (establishment_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Internal-only establishment data — a SEPARATE TABLE, deliberately
-- ────────────────────────────────────────────────────────────────────────────
-- Keeping this out of vd_entities is the point: no partner-facing query can
-- return a column it never selects from a table it cannot read. Hiding fields
-- in the UI, or stripping them in a serializer, both fail open when someone
-- later adds a column.
create table if not exists vd_establishment_internal (
  establishment_id     text primary key references vd_entities(id) on delete cascade,
  internal_notes       text not null default '',
  quality_rating       int,
  verification_status  text not null default 'unverified',
  contract_documents   jsonb not null default '[]'::jsonb,
  risk_status          text not null default 'normal',
  account_manager_id   uuid references auth.users(id) on delete set null,
  internal_price_adjustment numeric not null default 0,
  complaints           jsonb not null default '[]'::jsonb,
  updated_at           timestamptz not null default now()
);

-- Commission terms live apart from the establishment for the same reason.
create table if not exists vd_commission_agreements (
  id               text primary key,
  establishment_id text references vd_entities(id) on delete cascade,
  organisation_id  text references vd_organisations(id) on delete cascade,
  commission_rate  numeric not null default 0,
  platform_fee_rate numeric not null default 0,
  effective_from   date not null default current_date,
  effective_to     date,
  notes            text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists vd_commission_est_idx on vd_commission_agreements (establishment_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Handover invitations
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_establishment_invitations (
  id               text primary key,
  establishment_id text not null references vd_entities(id) on delete cascade,
  email            text not null,
  role_key         text not null references vd_roles(key),
  handover_level   text not null default 'managed'
                     check (handover_level in ('managed','self_managed')),
  organisation_id  text references vd_organisations(id) on delete set null,
  granted_permissions text[] not null default '{}',
  auto_publish     boolean not null default false,
  -- Random, single-use, and compared server-side inside a SECURITY DEFINER
  -- function — never selectable by the invitee.
  token            text not null unique,
  status           text not null default 'pending'
                     check (status in ('pending','accepted','expired','revoked')),
  invited_by       uuid references auth.users(id) on delete set null,
  expires_at       timestamptz not null default now() + interval '14 days',
  accepted_at      timestamptz,
  accepted_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists vd_est_invite_est_idx on vd_establishment_invitations (establishment_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Change queue for the approval workflow
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_listing_changes (
  id               text primary key,
  establishment_id text not null references vd_entities(id) on delete cascade,
  submitted_by     uuid references auth.users(id) on delete set null,
  -- Field-level before/after so the reviewer sees exactly what moved.
  previous_value   jsonb not null default '{}'::jsonb,
  proposed_value   jsonb not null default '{}'::jsonb,
  changed_fields   text[] not null default '{}',
  status           text not null default 'submitted'
                     check (status in ('draft','submitted','changes_requested','approved','published','rejected')),
  review_notes     text not null default '',
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists vd_listing_changes_est_idx    on vd_listing_changes (establishment_id);
create index if not exists vd_listing_changes_status_idx on vd_listing_changes (status);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. The permission engine
-- ────────────────────────────────────────────────────────────────────────────

-- Hard cap on what a supplier may EVER hold, independent of role, override or
-- handover level. Anything platform_only is excluded by construction, so a new
-- platform permission added to the catalogue later is automatically denied to
-- partners rather than accidentally granted.
create or replace function public.vd_supplier_allowlist()
returns text[] language sql stable set search_path = public as
$$ select coalesce(array_agg(key), '{}') from vd_permissions where not platform_only $$;

-- What each handover level can reach, before role and allowlist are applied.
create or replace function public.vd_handover_ceiling(p_level text)
returns text[] language sql immutable as
$$ select case p_level
     when 'self_managed' then array[
       'listing.view','listing.edit','listing.suggest','photos.upload','photos.delete',
       'rates.view','rates.edit','availability.edit','offers.manage',
       'bookings.view','bookings.manage','enquiries.respond',
       'payments.view','reports.view','users.invite']
     else array[
       'listing.view','listing.suggest','bookings.view','enquiries.respond','reports.view']
   end $$;

-- Effective permission set for one user on one establishment.
create or replace function public.vd_effective_permissions(p_user uuid, p_establishment text)
returns text[] language plpgsql stable set search_path = public as $$
declare
  v_access vd_establishment_access%rowtype;
  v_role   text[];
  v_result text[];
begin
  select * into v_access
    from vd_establishment_access
   where user_id = p_user and establishment_id = p_establishment
     and access_status = 'active'
     and (access_start_date is null or access_start_date <= current_date)
     and (access_end_date   is null or access_end_date   >= current_date);
  if not found then
    return '{}';
  end if;

  select coalesce(array_agg(permission_key), '{}') into v_role
    from vd_role_permissions where role_key = v_access.role_key;

  -- role ∩ ceiling ∩ allowlist
  select coalesce(array_agg(p), '{}') into v_result
    from unnest(v_role) p
   where p = any (vd_handover_ceiling(v_access.handover_level))
     and p = any (vd_supplier_allowlist());

  -- apply explicit grants, then re-clamp — a grant can widen within the
  -- ceiling but never past it, and never past the allowlist.
  select coalesce(array_agg(distinct p), '{}') into v_result
    from unnest(v_result || v_access.granted_permissions) p
   where p = any (vd_handover_ceiling(v_access.handover_level))
     and p = any (vd_supplier_allowlist());

  -- revocations always win
  select coalesce(array_agg(p), '{}') into v_result
    from unnest(v_result) p
   where not (p = any (v_access.revoked_permissions));

  return v_result;
end;
$$;

-- The check every policy and RPC calls. Staff short-circuit to true for the
-- permissions their platform role carries.
create or replace function public.vd_can(p_establishment text, p_permission text)
returns boolean language plpgsql stable set search_path = public as $$
declare
  v_staff_role text;
begin
  if auth.uid() is null then
    return false;
  end if;
  if is_admin() then
    return true;
  end if;

  -- Finance/operations collaborators map onto platform roles.
  select case
           when staff_role = 'finance'    then 'finance_manager'
           when staff_role = 'operations' then 'bookings_officer'
           else null end
    into v_staff_role
    from profiles where id = auth.uid();
  if v_staff_role is not null then
    return exists (select 1 from vd_role_permissions
                    where role_key = v_staff_role and permission_key = p_permission);
  end if;

  return p_permission = any (vd_effective_permissions(auth.uid(), p_establishment));
end;
$$;

-- Establishments the caller may see at all — the list the partner portal is
-- built from, and the guard that makes swapping an id in the URL useless.
create or replace function public.vd_my_establishments()
returns setof text language sql stable set search_path = public as
$$ select establishment_id from vd_establishment_access
    where user_id = auth.uid()
      and access_status = 'active'
      and (access_start_date is null or access_start_date <= current_date)
      and (access_end_date   is null or access_end_date   >= current_date) $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Row level security
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_permissions                enable row level security;
alter table vd_roles                      enable row level security;
alter table vd_role_permissions           enable row level security;
alter table vd_organisations              enable row level security;
alter table vd_organisation_users         enable row level security;
alter table vd_establishment_access       enable row level security;
alter table vd_establishment_internal     enable row level security;
alter table vd_commission_agreements      enable row level security;
alter table vd_establishment_invitations  enable row level security;
alter table vd_listing_changes            enable row level security;

-- The catalogue itself is readable by any signed-in user (the UI renders
-- permission names); it is written by migrations only.
drop policy if exists "Read permission catalogue" on vd_permissions;
create policy "Read permission catalogue" on vd_permissions for select using (auth.uid() is not null);
drop policy if exists "Read roles" on vd_roles;
create policy "Read roles" on vd_roles for select using (auth.uid() is not null);
drop policy if exists "Read role permissions" on vd_role_permissions;
create policy "Read role permissions" on vd_role_permissions for select using (auth.uid() is not null);

-- Organisations: staff manage; members read their own.
drop policy if exists "Staff manage organisations" on vd_organisations;
create policy "Staff manage organisations" on vd_organisations
  for all using (is_admin() or is_finance()) with check (is_admin() or is_finance());
drop policy if exists "Members read own organisation" on vd_organisations;
create policy "Members read own organisation" on vd_organisations
  for select using (exists (
    select 1 from vd_organisation_users ou
     where ou.organisation_id = vd_organisations.id
       and ou.user_id = auth.uid() and ou.status = 'active'));

drop policy if exists "Staff manage organisation users" on vd_organisation_users;
create policy "Staff manage organisation users" on vd_organisation_users
  for all using (is_admin()) with check (is_admin());
drop policy if exists "Read own organisation membership" on vd_organisation_users;
create policy "Read own organisation membership" on vd_organisation_users
  for select using (user_id = auth.uid());

-- Access rows: staff manage; a partner may read only their OWN row, never the
-- other people attached to an establishment.
drop policy if exists "Staff manage establishment access" on vd_establishment_access;
create policy "Staff manage establishment access" on vd_establishment_access
  for all using (is_admin()) with check (is_admin());
drop policy if exists "Read own establishment access" on vd_establishment_access;
create policy "Read own establishment access" on vd_establishment_access
  for select using (user_id = auth.uid());

-- Internal data and commission terms: staff only, full stop. There is no
-- partner-facing policy at all, so a partner's select returns zero rows.
drop policy if exists "Staff only internal data" on vd_establishment_internal;
create policy "Staff only internal data" on vd_establishment_internal
  for all using (is_admin() or is_ops() or is_finance())
  with check (is_admin() or is_ops() or is_finance());

drop policy if exists "Staff only commission" on vd_commission_agreements;
create policy "Staff only commission" on vd_commission_agreements
  for all using (is_admin() or is_finance()) with check (is_admin() or is_finance());

-- Invitations are staff-managed. Acceptance goes through a SECURITY DEFINER
-- function, so the invitee never needs to read the token row.
drop policy if exists "Staff manage invitations" on vd_establishment_invitations;
create policy "Staff manage invitations" on vd_establishment_invitations
  for all using (is_admin()) with check (is_admin());

-- Change queue: staff see everything; a partner sees only submissions for
-- establishments they hold access to.
drop policy if exists "Staff manage listing changes" on vd_listing_changes;
create policy "Staff manage listing changes" on vd_listing_changes
  for all using (is_admin() or is_ops()) with check (is_admin() or is_ops());
drop policy if exists "Partners read own listing changes" on vd_listing_changes;
create policy "Partners read own listing changes" on vd_listing_changes
  for select using (establishment_id in (select vd_my_establishments()));
drop policy if exists "Partners submit listing changes" on vd_listing_changes;
create policy "Partners submit listing changes" on vd_listing_changes
  for insert with check (
    submitted_by = auth.uid()
    and vd_can(establishment_id, 'listing.suggest')
    and status in ('draft','submitted'));

-- vd_entities gains partner access ALONGSIDE the existing owner rules, so
-- nothing that works today changes. Reads require listing.view; writes require
-- listing.edit — which the ceiling withholds under managed access.
drop policy if exists "Partners read assigned establishments" on vd_entities;
create policy "Partners read assigned establishments" on vd_entities
  for select using (id in (select vd_my_establishments()));

drop policy if exists "Partners edit assigned establishments" on vd_entities;
create policy "Partners edit assigned establishments" on vd_entities
  for update using (vd_can(id, 'listing.edit')) with check (vd_can(id, 'listing.edit'));

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Handover operations
-- ────────────────────────────────────────────────────────────────────────────

-- Invite a partner onto an establishment. Returns the invitation id and token
-- so the console can render the acceptance link (email delivery is separate).
create or replace function public.vd_invite_establishment_user(
  p_establishment text,
  p_email         text,
  p_role          text,
  p_handover      text default 'managed',
  p_permissions   text[] default '{}',
  p_auto_publish  boolean default false,
  p_organisation  text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id text := 'inv-' || gen_random_uuid();
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_scope text;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from vd_entities where id = p_establishment) then
    raise exception 'establishment not found';
  end if;
  select scope into v_scope from vd_roles where key = p_role;
  if v_scope is distinct from 'supplier' then
    raise exception 'role % is not assignable to a partner', p_role;
  end if;

  insert into vd_establishment_invitations (
    id, establishment_id, email, role_key, handover_level, organisation_id,
    granted_permissions, auto_publish, token, invited_by)
  values (v_id, p_establishment, lower(trim(p_email)), p_role, p_handover, p_organisation,
          coalesce(p_permissions, '{}'), p_auto_publish, v_token, auth.uid());

  perform vd_audit('establishment.invited', 'establishment', p_establishment,
    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role, 'handover', p_handover));

  return jsonb_build_object('invitationId', v_id, 'token', v_token);
end;
$$;

-- Accept an invitation. Runs as the invitee: the token is matched inside the
-- function, so the row is never exposed to them.
create or replace function public.vd_accept_establishment_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv vd_establishment_invitations%rowtype;
  v_id  text := 'acc-' || gen_random_uuid();
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  select * into v_inv from vd_establishment_invitations
   where token = p_token and status = 'pending' for update;
  if not found then
    raise exception 'invitation not found or already used';
  end if;
  if v_inv.expires_at < now() then
    update vd_establishment_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation has expired';
  end if;

  -- The invitation is addressed to an email; only that account may take it up.
  select email into v_email from auth.users where id = auth.uid();
  if lower(coalesce(v_email, '')) <> v_inv.email then
    raise exception 'this invitation was issued to a different email address';
  end if;

  insert into vd_establishment_access (
    id, establishment_id, user_id, organisation_id, role_key, handover_level,
    granted_permissions, auto_publish, access_status, invited_by, access_start_date)
  values (v_id, v_inv.establishment_id, auth.uid(), v_inv.organisation_id, v_inv.role_key,
          v_inv.handover_level, v_inv.granted_permissions, v_inv.auto_publish,
          'active', v_inv.invited_by, current_date)
  on conflict (establishment_id, user_id) do update set
    role_key = excluded.role_key,
    handover_level = excluded.handover_level,
    granted_permissions = excluded.granted_permissions,
    auto_publish = excluded.auto_publish,
    access_status = 'active',
    updated_at = now();

  update vd_establishment_invitations
     set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   where id = v_inv.id;

  perform vd_audit('establishment.access_accepted', 'establishment', v_inv.establishment_id,
    jsonb_build_object('role', v_inv.role_key, 'handover', v_inv.handover_level));

  return jsonb_build_object('establishmentId', v_inv.establishment_id, 'role', v_inv.role_key);
end;
$$;

-- Revoke access without touching the listing — the establishment and all its
-- content stay exactly where they are, under Visit Drakensberg.
create or replace function public.vd_revoke_establishment_access(p_access_id text, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row vd_establishment_access%rowtype;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  select * into v_row from vd_establishment_access where id = p_access_id;
  if not found then return; end if;

  update vd_establishment_access
     set access_status = 'revoked', access_end_date = current_date, updated_at = now()
   where id = p_access_id;

  perform vd_audit('establishment.access_revoked', 'establishment', v_row.establishment_id,
    jsonb_build_object('userId', v_row.user_id, 'reason', p_reason));
end;
$$;

-- Change a partner's handover level or role in place.
create or replace function public.vd_set_establishment_access(
  p_access_id text,
  p_role      text default null,
  p_handover  text default null,
  p_granted   text[] default null,
  p_revoked   text[] default null,
  p_auto_publish boolean default null,
  p_status    text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_row vd_establishment_access%rowtype;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  select * into v_row from vd_establishment_access where id = p_access_id;
  if not found then raise exception 'access record not found'; end if;

  if p_role is not null and (select scope from vd_roles where key = p_role) is distinct from 'supplier' then
    raise exception 'role % is not assignable to a partner', p_role;
  end if;

  update vd_establishment_access set
    role_key            = coalesce(p_role, role_key),
    handover_level      = coalesce(p_handover, handover_level),
    granted_permissions = coalesce(p_granted, granted_permissions),
    revoked_permissions = coalesce(p_revoked, revoked_permissions),
    auto_publish        = coalesce(p_auto_publish, auto_publish),
    access_status       = coalesce(p_status, access_status),
    updated_at          = now()
  where id = p_access_id;

  perform vd_audit('establishment.access_changed', 'establishment', v_row.establishment_id,
    jsonb_build_object('userId', v_row.user_id, 'role', p_role, 'handover', p_handover,
                       'status', p_status));
end;
$$;

grant execute on function public.vd_can(text, text) to authenticated;
grant execute on function public.vd_my_establishments() to authenticated;
grant execute on function public.vd_effective_permissions(uuid, text) to authenticated;
grant execute on function public.vd_supplier_allowlist() to authenticated;
grant execute on function public.vd_handover_ceiling(text) to authenticated;
grant execute on function public.vd_invite_establishment_user(text, text, text, text, text[], boolean, text) to authenticated;
grant execute on function public.vd_accept_establishment_invitation(text) to authenticated;
grant execute on function public.vd_revoke_establishment_access(text, text) to authenticated;
grant execute on function public.vd_set_establishment_access(text, text, text, text[], text[], boolean, text) to authenticated;
