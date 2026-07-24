-- ============================================================================
-- Visit Drakensberg — Quotes, Role Management & Collaborator Invites
-- Run AFTER 20260724_ikhokha_payments.sql.
--
-- Three additions:
--   1. handle_new_user() also seeds staff_role from signup metadata, so an
--      admin invite (auth.admin.inviteUserByEmail with data.staff_role) can
--      land a finance/operations collaborator without a follow-up RPC call
--      (which would fail: the invite runs under the service role, and
--      admin_set_staff_role's is_admin() check needs a real admin session).
--   2. admin_set_role(): the role-enum sibling of the existing
--      admin_set_staff_role() — profiles.role has no direct UPDATE grant
--      (see 20260704_secure_data_layer.sql), so promoting/demoting
--      admin|supplier|visitor needs the same SECURITY DEFINER pattern.
--   3. vd_quotes + vd_accept_quote/vd_decline_quote: a sales quote a
--      customer (or an anonymous prospect holding the emailed link) can
--      accept, converting it into a real Master Order + Invoice via the
--      existing vd_create_order RPC — the exact same path a normal booking
--      uses, so the resulting invoice is payable online immediately.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. handle_new_user(): seed staff_role from invite metadata.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := 'visitor';
  v_staff_role text := null;
begin
  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'visitor');
  exception when others then
    v_role := 'visitor';
  end;
  if new.raw_user_meta_data->>'staff_role' in ('finance', 'operations') then
    v_staff_role := new.raw_user_meta_data->>'staff_role';
  end if;
  insert into profiles (id, full_name, email, role, staff_role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, v_role, v_staff_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. admin_set_role(): promote/demote a collaborator's base role.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_user = auth.uid() then raise exception 'cannot change your own role'; end if;
  if p_role not in ('admin', 'supplier', 'visitor') then
    raise exception 'unknown role %', p_role;
  end if;
  update profiles set role = p_role::user_role, updated_at = now() where id = p_user;
end;
$$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Quotes.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_quotes (
  id             text primary key,
  quote_number   text unique not null,
  user_id        uuid references auth.users(id) on delete cascade, -- null = guest/prospect, no account yet
  customer_name  text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  trip_name      text not null default '',
  destination    text not null default 'drakensberg',
  currency       text not null default 'ZAR',
  subtotal       numeric not null default 0,
  discount       numeric not null default 0,
  service_fee    numeric not null default 0,
  tax_amount     numeric not null default 0,
  total          numeric not null default 0,
  status         text not null default 'draft', -- draft|sent|converted|declined|expired
  lines          jsonb not null default '[]'::jsonb, -- [{title,category,quantity,unitLabel,unitPrice,total}]
  notes          text not null default '',
  valid_until    date,
  order_id       text references vd_orders(id) on delete set null,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  sent_at        timestamptz,
  accepted_at    timestamptz
);
create index if not exists vd_quotes_user_idx   on vd_quotes (user_id);
create index if not exists vd_quotes_status_idx on vd_quotes (status);

alter table vd_quotes enable row level security;

drop policy if exists "Customers read own quotes"      on vd_quotes;
drop policy if exists "Public read sent guest quotes"  on vd_quotes;
drop policy if exists "Admins manage quotes"            on vd_quotes;
create policy "Customers read own quotes" on vd_quotes
  for select using (user_id = auth.uid());
-- A guest quote (no account) is reachable by whoever holds the emailed link —
-- the unguessable id IS the credential, same trust model as sharing an
-- invoice PDF. Only while status = 'sent'; once converted/declined/expired
-- it stops being publicly readable.
create policy "Public read sent guest quotes" on vd_quotes
  for select using (user_id is null and status = 'sent');
create policy "Admins manage quotes" on vd_quotes
  for all using (is_admin()) with check (is_admin());
-- No customer update policy: sending stays admin-only; acceptance/decline
-- happen only through the SECURITY DEFINER RPCs below.

create or replace function public.vd_accept_quote(p_quote_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quote vd_quotes%rowtype;
  v_result jsonb;
  v_order_lines jsonb;
begin
  select * into v_quote from vd_quotes where id = p_quote_id for update;
  if not found then raise exception 'quote not found'; end if;

  if v_quote.user_id is not null then
    if auth.uid() is null or (auth.uid() <> v_quote.user_id and not is_admin()) then
      raise exception 'not allowed';
    end if;
  end if;
  -- guest quotes (user_id is null): the link itself is the credential —
  -- deliberately permissive, matching how a one-time emailed quote works.

  if v_quote.status <> 'sent' then
    raise exception 'this quote is no longer open (status: %)', v_quote.status;
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    update vd_quotes set status = 'expired', updated_at = now() where id = p_quote_id;
    raise exception 'this quote has expired';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'category', l->>'category', 'title', l->>'title',
      'quantity', l->>'quantity', 'unitLabel', l->>'unitLabel',
      'unitPrice', l->>'unitPrice', 'grossAmount', l->>'total'
    )), '[]'::jsonb)
  into v_order_lines
  from jsonb_array_elements(coalesce(v_quote.lines, '[]'::jsonb)) l;

  v_result := vd_create_order(
    jsonb_build_object(
      'customerName', v_quote.customer_name,
      'customerEmail', v_quote.customer_email,
      'tripName', v_quote.trip_name,
      'destination', v_quote.destination,
      'currency', v_quote.currency,
      'subtotal', v_quote.subtotal,
      'serviceFee', v_quote.service_fee,
      'taxAmount', v_quote.tax_amount,
      'total', v_quote.total,
      'guest', v_quote.user_id is null
    ),
    v_order_lines,
    coalesce(v_quote.lines, '[]'::jsonb), -- invoice lines: quote lines already carry the same shape
    null,
    v_quote.user_id
  );

  update vd_quotes set
    status = 'converted', order_id = v_result->>'orderId', accepted_at = now(), updated_at = now()
  where id = p_quote_id;

  perform vd_audit('quote.accepted', 'quote', p_quote_id, jsonb_build_object('orderId', v_result->>'orderId'));

  return v_result;
end;
$$;
grant execute on function public.vd_accept_quote(text) to authenticated, anon;

create or replace function public.vd_decline_quote(p_quote_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_quote vd_quotes%rowtype;
begin
  select * into v_quote from vd_quotes where id = p_quote_id for update;
  if not found then raise exception 'quote not found'; end if;

  if v_quote.user_id is not null then
    if auth.uid() is null or (auth.uid() <> v_quote.user_id and not is_admin()) then
      raise exception 'not allowed';
    end if;
  end if;

  if v_quote.status <> 'sent' then
    raise exception 'this quote is no longer open (status: %)', v_quote.status;
  end if;

  update vd_quotes set status = 'declined', updated_at = now() where id = p_quote_id;
  perform vd_audit('quote.declined', 'quote', p_quote_id, '{}'::jsonb);
end;
$$;
grant execute on function public.vd_decline_quote(text) to authenticated, anon;
