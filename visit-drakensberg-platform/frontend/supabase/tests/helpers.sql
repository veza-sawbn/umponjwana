-- ============================================================================
-- Shared helpers for the SQL security tests.
--
-- Loaded after the shim, schema.sql and every migration. Nothing here is ever
-- run against a real project.
-- ============================================================================

create schema if not exists vdtest;

-- A test that drops to `set local role authenticated` (least_privilege_test)
-- still needs act_as and the assertions.
grant usage on schema vdtest to anon, authenticated;

-- ── Acting as somebody ──────────────────────────────────────────────────────
-- The shim's auth.uid()/auth.role() read these GUCs. `false` (not `true`) so
-- the setting survives past the end of the current statement.

create or replace function vdtest.act_as(p_user uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('test.uid', coalesce(p_user::text, ''), false);
  perform set_config('test.role', coalesce(p_role, ''), false);
end $$;

/** The service role: no user JWT, so auth.uid() is NULL. */
create or replace function vdtest.act_as_service()
returns void language plpgsql as $$
begin
  perform set_config('test.uid', '', false);
  perform set_config('test.role', 'service_role', false);
end $$;

/** No JWT at all — the case 20260903_null_safe_admin_guards.sql is about. */
create or replace function vdtest.act_as_nobody()
returns void language plpgsql as $$
begin
  perform set_config('test.uid', '', false);
  perform set_config('test.role', '', false);
end $$;

-- ── Fixtures ────────────────────────────────────────────────────────────────

/** Create an auth user + profile at the given role, and return its id. */
create or replace function vdtest.make_user(
  p_email text,
  p_role text default 'visitor',
  p_staff_role text default null,
  p_approved boolean default false
) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_id, p_email);
  -- approval_status as well as is_approved: 20260815_approval_consistency.sql
  -- installs a trigger that, on INSERT, derives is_approved FROM
  -- approval_status whenever the latter is non-null — and the column has a
  -- NOT NULL default of 'pending', so it never is. Setting only is_approved
  -- silently produces an unapproved supplier.
  insert into profiles (id, role, email, full_name, staff_role, is_approved, approval_status)
  values (v_id, p_role::user_role, p_email, p_email, p_staff_role, p_approved,
          case when p_approved then 'approved' else 'pending' end)
  on conflict (id) do update
    set role = excluded.role, staff_role = excluded.staff_role,
        is_approved = excluded.is_approved, approval_status = excluded.approval_status;
  return v_id;
end $$;

/**
 * A minimal order + invoice owned by p_user, with one line worth p_total.
 * Written directly rather than through vd_create_order so a test can build one
 * while acting as nobody, and so the fixture never depends on the RPC under
 * test.
 */
create or replace function vdtest.make_order(p_user uuid, p_total numeric default 1000)
returns text language plpgsql as $$
declare
  v_order_id   text := 'vdo-' || gen_random_uuid();
  v_invoice_id text := 'inv-' || gen_random_uuid();
begin
  insert into vd_orders (
    id, order_number, user_id, customer_name, customer_email,
    total_value, amount_paid, outstanding_balance, refund_balance,
    payment_status, booking_status, currency
  ) values (
    v_order_id, vd_next_number('VDO'), p_user, 'Test Traveller', 'traveller@example.test',
    p_total, 0, p_total, 0, 'unpaid', 'confirmed', 'ZAR'
  );

  insert into vd_order_lines (
    id, order_id, order_number, user_id, category, title, quantity, unit_price,
    gross_amount, discount_amount, payment_status
  ) values (
    'line-' || gen_random_uuid(), v_order_id, vd_next_number('VDL'), p_user, 'activity',
    'Test activity', 1, p_total, p_total, 0, 'unpaid'
  );

  insert into vd_invoices (
    id, invoice_number, order_id, user_id, currency,
    subtotal, discount, service_fee, tax_amount, total, amount_paid, balance, status
  ) values (
    v_invoice_id, vd_next_number('INV'), v_order_id, p_user, 'ZAR',
    p_total, 0, 0, 0, p_total, 0, p_total, 'issued'
  );

  return v_order_id;
end $$;

-- ── Table grants ────────────────────────────────────────────────────────────
-- Supabase issues `grant all on all tables in schema public to anon,
-- authenticated, service_role` and relies on RLS as the actual gate. The shim
-- cannot do that up front (the tables do not exist yet), so it happens here,
-- after every migration has run — and deliberately NOT for UPDATE on profiles,
-- whose column-level grants 20260704 and 20260913 set precisely.
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables
     where schemaname = 'public' and tablename <> 'profiles'
  loop
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', r.tablename);
  end loop;
  grant select, insert, delete on public.profiles to anon, authenticated;
end $$;

grant execute on all functions in schema vdtest to anon, authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────

create or replace function vdtest.ok(p_condition boolean, p_what text)
returns void language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FAILED: %', p_what;
  end if;
  raise notice '  ok  %', p_what;
end $$;

create or replace function vdtest.eq(p_actual anyelement, p_expected anyelement, p_what text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED: % (expected %, got %)', p_what, p_expected, p_actual;
  end if;
  raise notice '  ok  % (= %)', p_what, p_expected;
end $$;

/**
 * Assert that running p_sql raises, and that the message matches p_pattern
 * (a POSIX regex, case-insensitive). A statement that does NOT raise is the
 * failure these tests exist to catch, so it gets a loud message.
 */
create or replace function vdtest.raises(p_sql text, p_pattern text, p_what text)
returns void language plpgsql as $$
declare v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    v_message := SQLERRM;
  end;

  if v_message is null then
    raise exception 'FAILED: % — the statement was ALLOWED, but must be refused: %', p_what, p_sql;
  end if;
  if v_message !~* p_pattern then
    raise exception 'FAILED: % — refused, but with the wrong error: %', p_what, v_message;
  end if;
  raise notice '  ok  % (refused: %)', p_what, v_message;
end $$;

/** Assert that running p_sql does NOT raise. */
create or replace function vdtest.allows(p_sql text, p_what text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise notice '  ok  % (allowed)', p_what;
exception when others then
  raise exception 'FAILED: % — the statement was refused but must be allowed: %', p_what, SQLERRM;
end $$;
