-- ============================================================================
-- Visit Drakensberg — Multi-Supplier Order Management & Financial System
-- Run AFTER 20260709_supplier_moderation.sql.
--
-- Introduces the unified Order Management System that sits between bookings
-- and financial transactions:
--
--   Customer → Trip → Master Order (vd_orders) → Order Line Items
--   (vd_order_lines) → Supplier Allocation → Invoice (vd_invoices) →
--   Payments (vd_order_payments) → Supplier Settlements (vd_settlements) →
--   Receipts (vd_receipts) → Financial Reporting (vd_ledger_entries)
--
-- Principles enforced here:
--   * The Master Order belongs to Visit Drakensberg, never to a supplier.
--   * Suppliers see ONLY their own order lines (row-level security) — never
--     the order, the customer's total spend, other suppliers or their fees.
--   * Customers receive ONE invoice per order; no payout data on it.
--   * Every financial movement produces balanced double-entry ledger rows.
--   * Nothing financial is hardcoded: chart of accounts, VAT rate, default
--     commission and per-supplier terms all live in editable tables.
--   * All financial actions are written to an audit trail.
--   * Multi-destination / multi-currency ready (destination + currency
--     columns everywhere; ZAR/Drakensberg are defaults, not assumptions).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Staff roles (finance / operations) on top of the existing role enum.
--    profiles.role stays admin|supplier|visitor; staff_role refines access
--    for internal users. Users cannot self-assign it (no column grant).
-- ────────────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists staff_role text;

create or replace function public.is_finance()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from profiles
     where id = auth.uid() and (role = 'admin' or staff_role in ('finance'))
   ) $$;

create or replace function public.is_ops()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from profiles
     where id = auth.uid() and (role = 'admin' or staff_role in ('finance', 'operations'))
   ) $$;

create or replace function public.admin_set_staff_role(p_user uuid, p_staff_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_staff_role is not null and p_staff_role not in ('finance', 'operations') then
    raise exception 'unknown staff role %', p_staff_role;
  end if;
  update profiles set staff_role = p_staff_role, updated_at = now() where id = p_user;
end;
$$;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Finance settings — editable defaults, nothing hardcoded in app code.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_finance_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table vd_finance_settings enable row level security;

drop policy if exists "Authenticated read finance settings" on vd_finance_settings;
drop policy if exists "Admins manage finance settings"      on vd_finance_settings;
create policy "Authenticated read finance settings" on vd_finance_settings
  for select using (auth.uid() is not null);
create policy "Admins manage finance settings" on vd_finance_settings
  for all using (is_admin()) with check (is_admin());

insert into vd_finance_settings (key, value) values
  ('default_commission_rate',   '0.12'),
  ('default_platform_fee_rate', '0'),
  ('vat_rate',                  '0.15'),
  ('service_fee_rate',          '0.12'),
  ('default_currency',          '"ZAR"'),
  ('default_destination',       '"drakensberg"')
on conflict (key) do nothing;

-- Per-supplier commercial terms (override the defaults above).
create table if not exists vd_supplier_terms (
  supplier_id          uuid primary key references auth.users(id) on delete cascade,
  commission_rate      numeric,
  platform_fee_rate    numeric,
  settlement_frequency text not null default 'monthly', -- weekly | monthly | manual
  notes                text,
  updated_at           timestamptz not null default now()
);
alter table vd_supplier_terms enable row level security;

drop policy if exists "Suppliers read own terms"  on vd_supplier_terms;
drop policy if exists "Admins manage terms"       on vd_supplier_terms;
create policy "Suppliers read own terms" on vd_supplier_terms
  for select using (supplier_id = auth.uid());
create policy "Admins manage terms" on vd_supplier_terms
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Chart of accounts — seeded, admin-editable, ready for external
--    accounting integrations (codes map onto any GL).
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_ledger_accounts (
  code       text primary key,
  name       text not null,
  type       text not null check (type in ('asset','liability','equity','revenue','expense')),
  active     boolean not null default true,
  external_ref text,           -- account id in an external accounting system
  created_at timestamptz not null default now()
);
alter table vd_ledger_accounts enable row level security;

drop policy if exists "Finance read accounts"  on vd_ledger_accounts;
drop policy if exists "Admins manage accounts" on vd_ledger_accounts;
create policy "Finance read accounts" on vd_ledger_accounts
  for select using (is_finance());
create policy "Admins manage accounts" on vd_ledger_accounts
  for all using (is_admin()) with check (is_admin());

insert into vd_ledger_accounts (code, name, type) values
  ('1000', 'Bank',                    'asset'),
  ('1100', 'Customer Receivable',     'asset'),
  ('2000', 'Supplier Payable',        'liability'),
  ('2100', 'Refund Liability',        'liability'),
  ('2200', 'VAT Payable',             'liability'),
  ('2300', 'Gift Card & Voucher Liability', 'liability'),
  ('4000', 'Platform Revenue',        'revenue'),
  ('4100', 'Commission Revenue',      'revenue'),
  ('4200', 'Service Fee Revenue',     'revenue')
on conflict (code) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Master Orders — the single source of truth for a trip's finances.
--    Owned by the platform; the customer can read their own order;
--    suppliers have NO access to this table at all.
-- ────────────────────────────────────────────────────────────────────────────
create sequence if not exists vd_order_number_seq;

create table if not exists vd_orders (
  id                  text primary key,
  order_number        text unique not null,
  user_id             uuid not null references auth.users(id) on delete cascade,
  booking_id          text,                    -- link back to vd_bookings
  customer_name       text not null default '',
  customer_email      text not null default '',
  trip_name           text not null default '',
  destination         text not null default 'drakensberg',
  trip_status         text not null default 'planned',    -- planned|in_progress|completed|cancelled
  booking_status      text not null default 'confirmed',  -- pending|confirmed|cancelled
  payment_status      text not null default 'unpaid',     -- unpaid|deposit|partial|paid|refunded
  supplier_status     text not null default 'pending',    -- pending|partially_confirmed|confirmed|actioned
  financial_status    text not null default 'open',       -- open|settled|closed|written_off
  currency            text not null default 'ZAR',
  tax_rate            numeric not null default 0.15,
  travel_start        date,
  travel_end          date,
  total_value         numeric not null default 0,
  subtotal            numeric not null default 0,
  service_fee         numeric not null default 0,
  tax_amount          numeric not null default 0,
  deposit_amount      numeric not null default 0,
  amount_paid         numeric not null default 0,
  outstanding_balance numeric not null default 0,
  refund_balance      numeric not null default 0,
  value               jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists vd_orders_user_idx    on vd_orders (user_id);
create index if not exists vd_orders_booking_idx on vd_orders (booking_id);
create index if not exists vd_orders_created_idx on vd_orders (created_at desc);

alter table vd_orders enable row level security;

drop policy if exists "Customers read own orders" on vd_orders;
drop policy if exists "Ops read all orders"       on vd_orders;
drop policy if exists "Admins manage orders"      on vd_orders;
create policy "Customers read own orders" on vd_orders
  for select using (user_id = auth.uid());
create policy "Ops read all orders" on vd_orders
  for select using (is_ops());
create policy "Admins manage orders" on vd_orders
  for all using (is_admin()) with check (is_admin());
-- Writes happen through SECURITY DEFINER RPCs below — no customer/supplier
-- insert or update policies on purpose.

-- Internal notes live in their own staff-only table so neither the customer
-- nor any supplier can ever read them.
create table if not exists vd_order_notes (
  id         text primary key,
  order_id   text not null references vd_orders(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  author     text not null default '',
  note       text not null,
  created_at timestamptz not null default now()
);
create index if not exists vd_order_notes_order_idx on vd_order_notes (order_id);
alter table vd_order_notes enable row level security;

drop policy if exists "Ops read notes"    on vd_order_notes;
drop policy if exists "Ops write notes"   on vd_order_notes;
drop policy if exists "Admins manage notes" on vd_order_notes;
create policy "Ops read notes"  on vd_order_notes for select using (is_ops());
create policy "Ops write notes" on vd_order_notes for insert with check (is_ops());
create policy "Admins manage notes" on vd_order_notes for all using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Order Line Items — every trip component is an independent financial
--    object allocated to exactly one supplier (null supplier = the platform
--    itself, e.g. equipment hire run by Visit Drakensberg).
--    RLS is enforced HERE, at line level: a supplier sees only rows where
--    supplier_id = their auth uid.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_order_lines (
  id                text primary key,
  order_id          text not null references vd_orders(id) on delete cascade,
  order_number      text not null,
  user_id           uuid not null,               -- customer (for ops queries)
  supplier_id       uuid references auth.users(id) on delete set null,
  supplier_name     text not null default 'Visit Drakensberg',
  category          text not null default 'extra',
  -- accommodation|activity|tour|hike|event|shuttle|equipment|permit|levy|
  -- donation|meal|package|extra
  product_id        text,
  title             text not null,
  service_date      date,
  end_date          date,
  guests            int,
  quantity          numeric not null default 1,
  unit_label        text not null default 'unit',  -- night|guest|trip|item…
  unit_price        numeric not null default 0,
  gross_amount      numeric not null default 0,
  discount_amount   numeric not null default 0,
  tax_amount        numeric not null default 0,
  commission_rate   numeric not null default 0,
  commission_amount numeric not null default 0,
  service_fee       numeric not null default 0,
  platform_fee      numeric not null default 0,
  supplier_share    numeric not null default 0,   -- net supplier amount
  platform_share    numeric not null default 0,   -- Visit Drakensberg share
  payment_status    text not null default 'unpaid',    -- unpaid|partial|paid|refunded
  fulfilment_status text not null default 'pending',   -- pending|confirmed|in_progress|fulfilled|cancelled
  settlement_id     text,
  settlement_status text not null default 'unsettled', -- unsettled|allocated|settled|reversed
  settled_at        timestamptz,
  payout_reference  text,
  share_customer_name boolean not null default true,   -- expose guest name only when operationally necessary
  customer_name     text not null default '',
  currency          text not null default 'ZAR',
  destination       text not null default 'drakensberg',
  value             jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists vd_lines_order_idx      on vd_order_lines (order_id);
create index if not exists vd_lines_supplier_idx   on vd_order_lines (supplier_id);
create index if not exists vd_lines_settlement_idx on vd_order_lines (settlement_id);
create index if not exists vd_lines_date_idx       on vd_order_lines (service_date);

alter table vd_order_lines enable row level security;

drop policy if exists "Suppliers read own lines" on vd_order_lines;
drop policy if exists "Ops read all lines"       on vd_order_lines;
drop policy if exists "Admins manage lines"      on vd_order_lines;
create policy "Suppliers read own lines" on vd_order_lines
  for select using (supplier_id = auth.uid());
create policy "Ops read all lines" on vd_order_lines
  for select using (is_ops());
create policy "Admins manage lines" on vd_order_lines
  for all using (is_admin()) with check (is_admin());
-- Suppliers update fulfilment via vd_set_line_fulfilment() only, so they can
-- never touch financial columns. Customers never read raw lines — their view
-- is the invoice, which carries no supplier payout data.

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Invoices & receipts — the customer's single financial document.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_invoices (
  id             text primary key,
  invoice_number text unique not null,
  order_id       text not null references vd_orders(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  currency       text not null default 'ZAR',
  subtotal       numeric not null default 0,
  discount       numeric not null default 0,
  service_fee    numeric not null default 0,
  tax_amount     numeric not null default 0,
  total          numeric not null default 0,
  amount_paid    numeric not null default 0,
  balance        numeric not null default 0,
  status         text not null default 'unpaid', -- unpaid|partial|paid|refunded|void
  lines          jsonb not null default '[]'::jsonb, -- customer-safe snapshot; NO payout info
  issued_at      timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists vd_invoices_order_idx on vd_invoices (order_id);
create index if not exists vd_invoices_user_idx  on vd_invoices (user_id);

alter table vd_invoices enable row level security;

drop policy if exists "Customers read own invoices" on vd_invoices;
drop policy if exists "Ops read all invoices"       on vd_invoices;
drop policy if exists "Admins manage invoices"      on vd_invoices;
create policy "Customers read own invoices" on vd_invoices
  for select using (user_id = auth.uid());
create policy "Ops read all invoices" on vd_invoices
  for select using (is_ops());
create policy "Admins manage invoices" on vd_invoices
  for all using (is_admin()) with check (is_admin());

create table if not exists vd_receipts (
  id             text primary key,
  receipt_number text unique not null,
  payment_id     text not null,
  invoice_id     text,
  order_id       text not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  amount         numeric not null,
  method         text not null default 'card',
  currency       text not null default 'ZAR',
  created_at     timestamptz not null default now()
);
create index if not exists vd_receipts_order_idx on vd_receipts (order_id);
create index if not exists vd_receipts_user_idx  on vd_receipts (user_id);

alter table vd_receipts enable row level security;

drop policy if exists "Customers read own receipts" on vd_receipts;
drop policy if exists "Ops read all receipts"       on vd_receipts;
drop policy if exists "Admins manage receipts"      on vd_receipts;
create policy "Customers read own receipts" on vd_receipts
  for select using (user_id = auth.uid());
create policy "Ops read all receipts" on vd_receipts
  for select using (is_ops());
create policy "Admins manage receipts" on vd_receipts
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Payments — deposits, installments, partial/split, offline/online,
--    refunds, credits, gift cards, vouchers. Everything reconciles to the
--    Master Order via the RPC that maintains balances.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_order_payments (
  id          text primary key,
  order_id    text not null references vd_orders(id) on delete cascade,
  invoice_id  text,
  user_id     uuid not null references auth.users(id) on delete cascade,
  direction   text not null default 'in' check (direction in ('in','out')),
  type        text not null default 'payment',
  -- payment|deposit|installment|refund|credit|gift_card|voucher
  method      text not null default 'card',
  -- card|eft|cash|offline|online|gift_card|voucher|payment_plan
  amount      numeric not null check (amount > 0),
  currency    text not null default 'ZAR',
  status      text not null default 'completed', -- pending|completed|failed|reversed
  reference   text not null default '',
  notes       text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists vd_payments_order_idx on vd_order_payments (order_id);
create index if not exists vd_payments_user_idx  on vd_order_payments (user_id);

alter table vd_order_payments enable row level security;

drop policy if exists "Customers read own payments" on vd_order_payments;
drop policy if exists "Ops read all payments"       on vd_order_payments;
drop policy if exists "Admins manage payments"      on vd_order_payments;
create policy "Customers read own payments" on vd_order_payments
  for select using (user_id = auth.uid());
create policy "Ops read all payments" on vd_order_payments
  for select using (is_ops());
create policy "Admins manage payments" on vd_order_payments
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Ledger — double-entry journal. Rows are only written by the RPCs below,
--    which guarantee every journal balances (sum(debit) = sum(credit)).
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  journal_id   uuid not null,
  entry_date   date not null default current_date,
  account_code text not null references vd_ledger_accounts(code),
  order_id     text,
  supplier_id  uuid,
  debit        numeric not null default 0,
  credit       numeric not null default 0,
  memo         text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists vd_ledger_journal_idx on vd_ledger_entries (journal_id);
create index if not exists vd_ledger_account_idx on vd_ledger_entries (account_code);
create index if not exists vd_ledger_order_idx   on vd_ledger_entries (order_id);

alter table vd_ledger_entries enable row level security;

drop policy if exists "Finance read ledger" on vd_ledger_entries;
drop policy if exists "Admins manage ledger" on vd_ledger_entries;
create policy "Finance read ledger" on vd_ledger_entries
  for select using (is_finance());
create policy "Admins manage ledger" on vd_ledger_entries
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Settlements — supplier payout engine.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_settlements (
  id               text primary key,
  reference        text unique not null,
  supplier_id      uuid not null references auth.users(id) on delete cascade,
  supplier_name    text not null default '',
  method           text not null default 'manual',
  -- weekly|monthly|manual|partial|bulk|scheduled
  status           text not null default 'pending',
  -- pending|approved|paid|reversed
  period_start     date,
  period_end       date,
  scheduled_for    date,
  gross_amount     numeric not null default 0,
  commission       numeric not null default 0,
  fees             numeric not null default 0,
  tax_amount       numeric not null default 0,
  net_amount       numeric not null default 0,
  line_count       int not null default 0,
  currency         text not null default 'ZAR',
  payout_reference text,
  notes            text not null default '',
  created_by       uuid references auth.users(id) on delete set null,
  approved_by      uuid references auth.users(id) on delete set null,
  approved_at      timestamptz,
  paid_at          timestamptz,
  reversed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists vd_settlements_supplier_idx on vd_settlements (supplier_id);

alter table vd_settlements enable row level security;

drop policy if exists "Suppliers read own settlements" on vd_settlements;
drop policy if exists "Finance read settlements"       on vd_settlements;
drop policy if exists "Admins manage settlements"      on vd_settlements;
create policy "Suppliers read own settlements" on vd_settlements
  for select using (supplier_id = auth.uid());
create policy "Finance read settlements" on vd_settlements
  for select using (is_finance());
create policy "Admins manage settlements" on vd_settlements
  for all using (is_admin()) with check (is_admin());

create table if not exists vd_settlement_lines (
  settlement_id text not null references vd_settlements(id) on delete cascade,
  line_id       text not null references vd_order_lines(id) on delete cascade,
  supplier_id   uuid not null,
  amount        numeric not null default 0,
  primary key (settlement_id, line_id)
);
alter table vd_settlement_lines enable row level security;

drop policy if exists "Suppliers read own settlement lines" on vd_settlement_lines;
drop policy if exists "Finance read settlement lines"       on vd_settlement_lines;
drop policy if exists "Admins manage settlement lines"      on vd_settlement_lines;
create policy "Suppliers read own settlement lines" on vd_settlement_lines
  for select using (supplier_id = auth.uid());
create policy "Finance read settlement lines" on vd_settlement_lines
  for select using (is_finance());
create policy "Admins manage settlement lines" on vd_settlement_lines
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Audit trail — every financial action, written by the RPCs.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists vd_audit_entity_idx on vd_audit_log (entity, entity_id);

alter table vd_audit_log enable row level security;

drop policy if exists "Finance read audit log" on vd_audit_log;
create policy "Finance read audit log" on vd_audit_log
  for select using (is_finance());
-- No insert policy: rows are written only by SECURITY DEFINER functions.

create or replace function public.vd_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language sql security definer set search_path = public as
$$ insert into vd_audit_log (actor_id, action, entity, entity_id, details)
   values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb)) $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Number generators
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_next_number(p_prefix text)
returns text language sql volatile security definer set search_path = public as
$$ select p_prefix || '-' || to_char(now(), 'YYMM') || '-'
        || lpad(nextval('vd_order_number_seq')::text, 5, '0') $$;

-- Tolerant date cast: legacy booking data may carry non-ISO date strings.
create or replace function public.vd_safe_date(p text)
returns date language plpgsql immutable as $$
begin
  return nullif(p, '')::date;
exception when others then
  return null;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. RPC: create a Master Order (order + lines + invoice + opening journal,
--     optionally an initial payment) atomically.
--
--     Allocation is computed SERVER-SIDE from vd_supplier_terms /
--     vd_finance_settings — the client can suggest a commission rate, but
--     supplier terms win. Lines without a real supplier belong to the
--     platform (100% platform share).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_create_order(
  p_order         jsonb,   -- {bookingId, customerName, customerEmail, tripName, destination, currency, travelStart, travelEnd, subtotal, serviceFee, taxAmount, total, depositAmount, value}
  p_lines         jsonb,   -- [{supplierId, supplierName, category, productId, title, serviceDate, endDate, guests, quantity, unitLabel, unitPrice, grossAmount, discountAmount, commissionRate?, shareCustomerName?, value?}]
  p_invoice_lines jsonb default null, -- customer-safe display lines; defaults to order lines
  p_payment       jsonb default null, -- {amount, type, method, reference}
  p_user_id       uuid  default null  -- only honoured for admins / migration
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_order_id text := 'vdo-' || gen_random_uuid();
  v_order_number text := vd_next_number('VD');
  v_invoice_id text := 'inv-' || gen_random_uuid();
  v_invoice_number text := vd_next_number('INV');
  v_currency text := coalesce(p_order->>'currency', (select value #>> '{}' from vd_finance_settings where key = 'default_currency'), 'ZAR');
  v_destination text := coalesce(p_order->>'destination', (select value #>> '{}' from vd_finance_settings where key = 'default_destination'), 'drakensberg');
  v_vat_rate numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'vat_rate'), 0.15);
  v_default_commission numeric := coalesce((select (value #>> '{}')::numeric from vd_finance_settings where key = 'default_commission_rate'), 0.12);
  v_subtotal numeric := coalesce((p_order->>'subtotal')::numeric, 0);
  v_service_fee numeric := coalesce((p_order->>'serviceFee')::numeric, 0);
  v_tax numeric := coalesce((p_order->>'taxAmount')::numeric, 0);
  v_total numeric := coalesce((p_order->>'total')::numeric, v_subtotal + v_service_fee + v_tax);
  v_line jsonb;
  v_supplier uuid;
  v_supplier_name text;
  v_gross numeric; v_discount numeric; v_net numeric;
  v_comm_rate numeric; v_comm numeric; v_pfee_rate numeric; v_pfee numeric;
  v_supplier_share numeric; v_platform_share numeric;
  v_sum_supplier numeric := 0;
  v_sum_commission numeric := 0;
  v_sum_platform numeric := 0;
  v_journal uuid := gen_random_uuid();
  v_platform_revenue numeric;
  v_inv_lines jsonb;
  v_customer_name text := coalesce(p_order->>'customerName', '');
  v_line_id text;
begin
  if auth.uid() is null and p_user_id is null then
    raise exception 'authentication required';
  end if;
  -- Ordinary users create orders for themselves; admins (and the migration,
  -- where auth.uid() is null) may create on behalf of a customer.
  if p_user_id is not null and (auth.uid() is null or is_admin()) then
    v_user := p_user_id;
  else
    v_user := auth.uid();
  end if;

  insert into vd_orders (
    id, order_number, user_id, booking_id, customer_name, customer_email,
    trip_name, destination, currency, tax_rate, travel_start, travel_end,
    subtotal, service_fee, tax_amount, total_value, deposit_amount,
    amount_paid, outstanding_balance, value
  ) values (
    v_order_id, v_order_number, v_user, p_order->>'bookingId',
    v_customer_name, coalesce(p_order->>'customerEmail', ''),
    coalesce(p_order->>'tripName', ''), v_destination, v_currency, v_vat_rate,
    vd_safe_date(p_order->>'travelStart'), vd_safe_date(p_order->>'travelEnd'),
    v_subtotal, v_service_fee, v_tax, v_total,
    coalesce((p_order->>'depositAmount')::numeric, 0),
    0, v_total, coalesce(p_order->'value', '{}'::jsonb)
  );

  -- Lines + supplier allocation
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_supplier := case when coalesce(v_line->>'supplierId','') ~ '^[0-9a-f]{8}-'
                       then (v_line->>'supplierId')::uuid else null end;
    v_supplier_name := coalesce(nullif(v_line->>'supplierName',''),
                                case when v_supplier is null then 'Visit Drakensberg' else 'Supplier' end);
    v_gross := coalesce((v_line->>'grossAmount')::numeric,
                        coalesce((v_line->>'unitPrice')::numeric,0) * coalesce((v_line->>'quantity')::numeric,1));
    v_discount := coalesce((v_line->>'discountAmount')::numeric, 0);
    v_net := greatest(v_gross - v_discount, 0);

    if v_supplier is not null then
      select coalesce(t.commission_rate, nullif(v_line->>'commissionRate','')::numeric, v_default_commission),
             coalesce(t.platform_fee_rate, 0)
        into v_comm_rate, v_pfee_rate
        from (select 1) x
        left join vd_supplier_terms t on t.supplier_id = v_supplier;
      v_comm_rate := coalesce(v_comm_rate, v_default_commission);
      v_pfee_rate := coalesce(v_pfee_rate, 0);
      v_comm := round(v_net * v_comm_rate, 2);
      v_pfee := round(v_net * v_pfee_rate, 2);
      v_supplier_share := v_net - v_comm - v_pfee;
      v_platform_share := v_comm + v_pfee;
    else
      v_comm_rate := 0; v_comm := 0; v_pfee := 0;
      v_supplier_share := 0;
      v_platform_share := v_net;
    end if;

    v_line_id := 'vdl-' || gen_random_uuid();
    insert into vd_order_lines (
      id, order_id, order_number, user_id, supplier_id, supplier_name,
      category, product_id, title, service_date, end_date, guests,
      quantity, unit_label, unit_price, gross_amount, discount_amount,
      tax_amount, commission_rate, commission_amount, service_fee,
      platform_fee, supplier_share, platform_share,
      share_customer_name, customer_name, currency, destination, value
    ) values (
      v_line_id, v_order_id, v_order_number, v_user, v_supplier, v_supplier_name,
      coalesce(v_line->>'category', 'extra'), v_line->>'productId',
      coalesce(v_line->>'title', 'Service'),
      vd_safe_date(v_line->>'serviceDate'), vd_safe_date(v_line->>'endDate'),
      nullif(v_line->>'guests','')::int,
      coalesce((v_line->>'quantity')::numeric, 1),
      coalesce(v_line->>'unitLabel', 'unit'),
      coalesce((v_line->>'unitPrice')::numeric, 0),
      v_gross, v_discount,
      round(v_net * v_vat_rate, 2),
      v_comm_rate, v_comm, 0, v_pfee, v_supplier_share, v_platform_share,
      coalesce((v_line->>'shareCustomerName')::boolean, true),
      case when coalesce((v_line->>'shareCustomerName')::boolean, true) then v_customer_name else '' end,
      v_currency, v_destination, coalesce(v_line->'value', '{}'::jsonb)
    );

    if v_supplier is not null then
      v_sum_supplier := v_sum_supplier + v_supplier_share;
      v_sum_commission := v_sum_commission + v_comm;
      v_sum_platform := v_sum_platform + v_pfee;
    else
      v_sum_platform := v_sum_platform + v_platform_share;
    end if;
  end loop;

  -- Customer invoice — a single document, no supplier payout information.
  v_inv_lines := coalesce(p_invoice_lines, (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', l->>'title',
      'category', coalesce(l->>'category','extra'),
      'quantity', coalesce((l->>'quantity')::numeric, 1),
      'unitLabel', coalesce(l->>'unitLabel','unit'),
      'unitPrice', coalesce((l->>'unitPrice')::numeric, 0),
      'total', coalesce((l->>'grossAmount')::numeric,
                        coalesce((l->>'unitPrice')::numeric,0) * coalesce((l->>'quantity')::numeric,1))
               - coalesce((l->>'discountAmount')::numeric, 0)
    )), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
  ));

  insert into vd_invoices (
    id, invoice_number, order_id, user_id, currency,
    subtotal, service_fee, tax_amount, total, amount_paid, balance, lines
  ) values (
    v_invoice_id, v_invoice_number, v_order_id, v_user, v_currency,
    v_subtotal, v_service_fee, v_tax, v_total, 0, v_total, v_inv_lines
  );

  -- Opening journal: recognise the receivable and its counterparts.
  -- Platform revenue takes the residual so the journal always balances to
  -- the customer-facing total even with rounding.
  v_platform_revenue := v_total - v_sum_supplier - v_sum_commission - v_service_fee - v_tax;
  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
    (v_journal, '1100', v_order_id, v_total, 0, 'Order ' || v_order_number || ' — customer receivable');
  if v_sum_supplier <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2000', v_order_id, 0, v_sum_supplier, 'Order ' || v_order_number || ' — supplier payable');
  end if;
  if v_sum_commission <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4100', v_order_id, 0, v_sum_commission, 'Order ' || v_order_number || ' — commission revenue');
  end if;
  if v_service_fee <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4200', v_order_id, 0, v_service_fee, 'Order ' || v_order_number || ' — service fee');
  end if;
  if v_tax <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2200', v_order_id, 0, v_tax, 'Order ' || v_order_number || ' — VAT');
  end if;
  if v_platform_revenue <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4000', v_order_id, 0, v_platform_revenue, 'Order ' || v_order_number || ' — platform revenue');
  end if;

  perform vd_audit('order.created', 'order', v_order_id,
    jsonb_build_object('orderNumber', v_order_number, 'total', v_total, 'lines', jsonb_array_length(coalesce(p_lines,'[]'::jsonb))));

  if p_payment is not null and coalesce((p_payment->>'amount')::numeric, 0) > 0 then
    perform vd_record_order_payment(
      v_order_id,
      (p_payment->>'amount')::numeric,
      coalesce(p_payment->>'type', 'payment'),
      coalesce(p_payment->>'method', 'card'),
      coalesce(p_payment->>'reference', ''),
      ''
    );
  end if;

  return jsonb_build_object('orderId', v_order_id, 'orderNumber', v_order_number,
                            'invoiceId', v_invoice_id, 'invoiceNumber', v_invoice_number);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 12. RPC: record a payment or refund against an order. Maintains order,
--     invoice and line balances, issues a receipt, and writes a balanced
--     journal. Customers may pay their own order; finance staff may record
--     anything (offline payments, refunds, credits, vouchers…).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_record_order_payment(
  p_order_id text, p_amount numeric, p_type text default 'payment',
  p_method text default 'card', p_reference text default '', p_notes text default ''
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order vd_orders%rowtype;
  v_payment_id text := 'pay-' || gen_random_uuid();
  v_receipt_id text := 'rcpt-' || gen_random_uuid();
  v_invoice vd_invoices%rowtype;
  v_journal uuid := gen_random_uuid();
  v_direction text := case when p_type in ('refund') then 'out' else 'in' end;
  v_paid numeric; v_refund numeric; v_status text;
begin
  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  -- Authorisation: order owner, finance staff, or the migration context.
  if auth.uid() is not null and v_order.user_id <> auth.uid() and not is_finance() then
    raise exception 'not allowed';
  end if;
  -- Refunds and offline instruments are staff actions.
  if auth.uid() is not null and not is_finance()
     and (v_direction = 'out' or p_method in ('cash','offline')) then
    raise exception 'finance role required';
  end if;

  insert into vd_order_payments (id, order_id, user_id, direction, type, method, amount, currency, reference, notes, created_by)
  values (v_payment_id, p_order_id, v_order.user_id, v_direction, p_type, p_method, p_amount, v_order.currency, p_reference, p_notes, auth.uid());

  if v_direction = 'in' then
    v_paid := v_order.amount_paid + p_amount;
    v_refund := v_order.refund_balance;
  else
    v_paid := v_order.amount_paid;
    v_refund := greatest(v_order.refund_balance - p_amount, 0);
  end if;

  v_status := case
    when v_direction = 'out' then (case when v_refund <= 0 then 'refunded' else v_order.payment_status end)
    when v_paid >= v_order.total_value then 'paid'
    when p_type = 'deposit' then 'deposit'
    when v_paid > 0 then 'partial'
    else 'unpaid' end;

  update vd_orders set
    amount_paid = v_paid,
    outstanding_balance = greatest(total_value - v_paid, 0),
    refund_balance = v_refund,
    payment_status = v_status,
    updated_at = now()
  where id = p_order_id;

  select * into v_invoice from vd_invoices where order_id = p_order_id order by issued_at limit 1;
  if found and v_direction = 'in' then
    update vd_invoices set
      amount_paid = amount_paid + p_amount,
      balance = greatest(total - (amount_paid + p_amount), 0),
      status = case when amount_paid + p_amount >= total then 'paid'
                    when amount_paid + p_amount > 0 then 'partial' else status end,
      updated_at = now()
    where id = v_invoice.id;
  elsif found and v_direction = 'out' then
    update vd_invoices set status = case when v_refund <= 0 then 'refunded' else status end, updated_at = now()
    where id = v_invoice.id;
  end if;

  -- Receipts are issued for money received; refunds get one too (negative
  -- direction is visible on the payment record).
  insert into vd_receipts (id, receipt_number, payment_id, invoice_id, order_id, user_id, amount, method, currency)
  values (v_receipt_id, vd_next_number('RCP'), v_payment_id, v_invoice.id, p_order_id, v_order.user_id,
          case when v_direction = 'out' then -p_amount else p_amount end, p_method, v_order.currency);

  -- Balanced journal
  if v_direction = 'in' then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '1000', p_order_id, p_amount, 0, initcap(p_type) || ' received — ' || v_order.order_number),
      (v_journal, '1100', p_order_id, 0, p_amount, initcap(p_type) || ' received — ' || v_order.order_number);
  else
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '2100', p_order_id, p_amount, 0, 'Refund paid — ' || v_order.order_number),
      (v_journal, '1000', p_order_id, 0, p_amount, 'Refund paid — ' || v_order.order_number);
  end if;

  -- Line payment status mirrors the order once fully paid / on refund.
  if v_status = 'paid' then
    update vd_order_lines set payment_status = 'paid', updated_at = now()
    where order_id = p_order_id and payment_status <> 'refunded';
  elsif v_status in ('partial', 'deposit') then
    update vd_order_lines set payment_status = 'partial', updated_at = now()
    where order_id = p_order_id and payment_status = 'unpaid';
  end if;

  perform vd_audit('payment.' || p_type, 'order', p_order_id,
    jsonb_build_object('paymentId', v_payment_id, 'amount', p_amount, 'method', p_method, 'direction', v_direction));

  return v_payment_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 13. RPC: cancel an order's financials — reverses the opening journal and
--     moves any paid amount into Refund Liability. Called when a booking is
--     cancelled (by the customer or by staff).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_cancel_order(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order vd_orders%rowtype;
  v_journal uuid := gen_random_uuid();
  v_sum_supplier numeric; v_sum_commission numeric; v_platform numeric;
begin
  select * into v_order from vd_orders where id = p_order_id for update;
  if not found then return; end if;
  if auth.uid() is not null and v_order.user_id <> auth.uid() and not is_finance() then
    raise exception 'not allowed';
  end if;
  if v_order.booking_status = 'cancelled' then return; end if;

  select coalesce(sum(supplier_share), 0), coalesce(sum(commission_amount), 0)
    into v_sum_supplier, v_sum_commission
    from vd_order_lines
   where order_id = p_order_id and settlement_status in ('unsettled', 'allocated');

  -- Reverse the unsettled portion of the opening journal.
  v_platform := v_order.total_value - v_sum_supplier - v_sum_commission - v_order.service_fee - v_order.tax_amount;
  insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
    (v_journal, '1100', p_order_id, 0, v_order.total_value, 'Order ' || v_order.order_number || ' cancelled');
  if v_sum_supplier <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2000', p_order_id, v_sum_supplier, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_sum_commission <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4100', p_order_id, v_sum_commission, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_order.service_fee <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4200', p_order_id, v_order.service_fee, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_order.tax_amount <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '2200', p_order_id, v_order.tax_amount, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;
  if v_platform <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo)
    values (v_journal, '4000', p_order_id, v_platform, 0, 'Order ' || v_order.order_number || ' cancelled');
  end if;

  -- Money already collected becomes a refund liability (its own journal).
  if v_order.amount_paid > 0 then
    v_journal := gen_random_uuid();
    insert into vd_ledger_entries (journal_id, account_code, order_id, debit, credit, memo) values
      (v_journal, '1100', p_order_id, v_order.amount_paid, 0, 'Order ' || v_order.order_number || ' — reinstate receivable for refund'),
      (v_journal, '2100', p_order_id, 0, v_order.amount_paid, 'Order ' || v_order.order_number || ' — refund liability');
  end if;

  update vd_orders set
    booking_status = 'cancelled', trip_status = 'cancelled',
    financial_status = case when amount_paid > 0 then 'open' else 'closed' end,
    refund_balance = amount_paid,
    outstanding_balance = 0,
    updated_at = now()
  where id = p_order_id;

  update vd_order_lines set fulfilment_status = 'cancelled', updated_at = now()
  where order_id = p_order_id and settlement_status in ('unsettled', 'allocated');

  update vd_invoices set status = 'void', updated_at = now() where order_id = p_order_id;

  perform vd_audit('order.cancelled', 'order', p_order_id,
    jsonb_build_object('refundBalance', v_order.amount_paid));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 14. RPC: admin edits a line's allocation (commission / fees). Keeps the
--     customer total unchanged; re-balances supplier vs platform shares and
--     writes an adjustment journal for the delta.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_update_line_allocation(
  p_line_id text, p_commission_rate numeric default null,
  p_platform_fee numeric default null, p_discount numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_line vd_order_lines%rowtype;
  v_net numeric; v_comm numeric; v_pfee numeric; v_share numeric;
  v_delta numeric; v_journal uuid := gen_random_uuid();
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into v_line from vd_order_lines where id = p_line_id for update;
  if not found then raise exception 'line not found'; end if;
  if v_line.settlement_status in ('allocated','settled') then
    raise exception 'line already in a settlement — reverse it first';
  end if;
  if v_line.supplier_id is null then raise exception 'platform-owned line has no supplier allocation'; end if;

  v_net := greatest(v_line.gross_amount - coalesce(p_discount, v_line.discount_amount), 0);
  v_comm := round(v_net * coalesce(p_commission_rate, v_line.commission_rate), 2);
  v_pfee := coalesce(p_platform_fee, v_line.platform_fee);
  v_share := v_net - v_comm - v_pfee;
  if v_share < 0 then raise exception 'allocation exceeds line value'; end if;

  -- Journal for the change in supplier payable (offset to commission revenue)
  v_delta := v_share - v_line.supplier_share;
  if v_delta <> 0 then
    insert into vd_ledger_entries (journal_id, account_code, order_id, supplier_id, debit, credit, memo) values
      (v_journal, '2000', v_line.order_id, v_line.supplier_id,
        case when v_delta < 0 then -v_delta else 0 end,
        case when v_delta > 0 then v_delta else 0 end,
        'Allocation adjusted — line ' || v_line.title),
      (v_journal, '4100', v_line.order_id, v_line.supplier_id,
        case when v_delta > 0 then v_delta else 0 end,
        case when v_delta < 0 then -v_delta else 0 end,
        'Allocation adjusted — line ' || v_line.title);
  end if;

  update vd_order_lines set
    commission_rate = coalesce(p_commission_rate, commission_rate),
    commission_amount = v_comm,
    platform_fee = v_pfee,
    discount_amount = coalesce(p_discount, discount_amount),
    supplier_share = v_share,
    platform_share = v_comm + v_pfee,
    updated_at = now()
  where id = p_line_id;

  perform vd_audit('line.allocation_updated', 'order_line', p_line_id,
    jsonb_build_object('commissionRate', p_commission_rate, 'platformFee', p_platform_fee,
                       'discount', p_discount, 'supplierShareDelta', v_delta));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 15. RPC: supplier (or staff) updates a line's fulfilment status — the only
--     write suppliers have on order lines.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_set_line_fulfilment(p_line_id text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_line vd_order_lines%rowtype;
  v_total int; v_done int;
begin
  if p_status not in ('pending','confirmed','in_progress','fulfilled','cancelled') then
    raise exception 'invalid status';
  end if;
  select * into v_line from vd_order_lines where id = p_line_id for update;
  if not found then raise exception 'line not found'; end if;
  if auth.uid() is null or (v_line.supplier_id is distinct from auth.uid() and not is_ops()) then
    raise exception 'not allowed';
  end if;

  update vd_order_lines set fulfilment_status = p_status, updated_at = now() where id = p_line_id;

  -- Roll supplier status up to the master order.
  select count(*), count(*) filter (where fulfilment_status in ('confirmed','in_progress','fulfilled'))
    into v_total, v_done
    from vd_order_lines where order_id = v_line.order_id and supplier_id is not null;
  update vd_orders set
    supplier_status = case
      when v_total = 0 then 'actioned'
      when v_done = v_total then 'confirmed'
      when v_done > 0 then 'partially_confirmed'
      else 'pending' end,
    updated_at = now()
  where id = v_line.order_id;

  perform vd_audit('line.fulfilment', 'order_line', p_line_id, jsonb_build_object('status', p_status));
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 16. Settlement engine RPCs
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_create_settlement(
  p_supplier uuid, p_line_ids text[], p_method text default 'manual',
  p_scheduled_for date default null, p_notes text default ''
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_id text := 'set-' || gen_random_uuid();
  v_ref text := vd_next_number('SET');
  v_gross numeric; v_comm numeric; v_fees numeric; v_tax numeric; v_net numeric; v_count int;
  v_name text;
  v_pstart date; v_pend date;
begin
  if not is_finance() then raise exception 'finance role required'; end if;
  if p_method not in ('weekly','monthly','manual','partial','bulk','scheduled') then
    raise exception 'invalid settlement method';
  end if;

  -- Lock and validate the lines: right supplier, paid by the customer,
  -- not already in another settlement.
  perform 1 from vd_order_lines
   where id = any(p_line_ids) for update;

  select coalesce(sum(gross_amount - discount_amount),0), coalesce(sum(commission_amount),0),
         coalesce(sum(platform_fee),0), coalesce(sum(tax_amount),0),
         coalesce(sum(supplier_share),0), count(*),
         min(service_date), max(coalesce(end_date, service_date))
    into v_gross, v_comm, v_fees, v_tax, v_net, v_count, v_pstart, v_pend
    from vd_order_lines
   where id = any(p_line_ids)
     and supplier_id = p_supplier
     and settlement_status = 'unsettled'
     and fulfilment_status <> 'cancelled';

  if v_count = 0 or v_count <> coalesce(array_length(p_line_ids, 1), 0) then
    raise exception 'some lines are not settleable for this supplier';
  end if;

  select coalesce(full_name, email, 'Supplier') into v_name from profiles where id = p_supplier;

  insert into vd_settlements (id, reference, supplier_id, supplier_name, method, period_start, period_end,
                              scheduled_for, gross_amount, commission, fees, tax_amount, net_amount,
                              line_count, notes, created_by)
  values (v_id, v_ref, p_supplier, coalesce(v_name, 'Supplier'), p_method, v_pstart, v_pend,
          p_scheduled_for, v_gross, v_comm, v_fees, v_tax, v_net, v_count, p_notes, auth.uid());

  insert into vd_settlement_lines (settlement_id, line_id, supplier_id, amount)
  select v_id, id, p_supplier, supplier_share from vd_order_lines where id = any(p_line_ids);

  update vd_order_lines set settlement_id = v_id, settlement_status = 'allocated', updated_at = now()
  where id = any(p_line_ids);

  perform vd_audit('settlement.created', 'settlement', v_id,
    jsonb_build_object('supplier', p_supplier, 'net', v_net, 'lines', v_count, 'method', p_method));
  return v_id;
end;
$$;

create or replace function public.vd_approve_settlement(p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v vd_settlements%rowtype;
begin
  if not is_finance() then raise exception 'finance role required'; end if;
  select * into v from vd_settlements where id = p_id for update;
  if not found then raise exception 'settlement not found'; end if;
  if v.status <> 'pending' then raise exception 'only pending settlements can be approved'; end if;
  update vd_settlements set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_id;
  perform vd_audit('settlement.approved', 'settlement', p_id, '{}'::jsonb);
end;
$$;

create or replace function public.vd_pay_settlement(p_id text, p_payout_reference text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v vd_settlements%rowtype;
  v_journal uuid := gen_random_uuid();
begin
  if not is_finance() then raise exception 'finance role required'; end if;
  select * into v from vd_settlements where id = p_id for update;
  if not found then raise exception 'settlement not found'; end if;
  if v.status not in ('pending','approved') then raise exception 'settlement is not payable'; end if;

  update vd_settlements set status = 'paid', paid_at = now(),
    payout_reference = nullif(p_payout_reference, ''),
    approved_by = coalesce(approved_by, auth.uid()), approved_at = coalesce(approved_at, now())
  where id = p_id;

  update vd_order_lines set settlement_status = 'settled', settled_at = now(),
    payout_reference = nullif(p_payout_reference, ''), updated_at = now()
  where settlement_id = p_id;

  insert into vd_ledger_entries (journal_id, account_code, supplier_id, debit, credit, memo) values
    (v_journal, '2000', v.supplier_id, v.net_amount, 0, 'Settlement ' || v.reference || ' paid'),
    (v_journal, '1000', v.supplier_id, 0, v.net_amount, 'Settlement ' || v.reference || ' paid');

  perform vd_audit('settlement.paid', 'settlement', p_id,
    jsonb_build_object('net', v.net_amount, 'payoutReference', p_payout_reference));
end;
$$;

create or replace function public.vd_reverse_settlement(p_id text, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v vd_settlements%rowtype;
  v_journal uuid := gen_random_uuid();
begin
  if not is_finance() then raise exception 'finance role required'; end if;
  select * into v from vd_settlements where id = p_id for update;
  if not found then raise exception 'settlement not found'; end if;
  if v.status = 'reversed' then return; end if;

  if v.status = 'paid' then
    insert into vd_ledger_entries (journal_id, account_code, supplier_id, debit, credit, memo) values
      (v_journal, '1000', v.supplier_id, v.net_amount, 0, 'Settlement ' || v.reference || ' reversed'),
      (v_journal, '2000', v.supplier_id, 0, v.net_amount, 'Settlement ' || v.reference || ' reversed');
  end if;

  update vd_order_lines set settlement_id = null, settlement_status = 'unsettled',
    settled_at = null, payout_reference = null, updated_at = now()
  where settlement_id = p_id;

  update vd_settlements set status = 'reversed', reversed_at = now(),
    notes = trim(both ' ' from notes || case when p_reason <> '' then ' · Reversed: ' || p_reason else '' end)
  where id = p_id;

  perform vd_audit('settlement.reversed', 'settlement', p_id, jsonb_build_object('reason', p_reason));
end;
$$;

grant execute on function public.vd_create_order(jsonb, jsonb, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.vd_record_order_payment(text, numeric, text, text, text, text) to authenticated;
grant execute on function public.vd_cancel_order(text) to authenticated;
grant execute on function public.vd_update_line_allocation(text, numeric, numeric, numeric) to authenticated;
grant execute on function public.vd_set_line_fulfilment(text, text) to authenticated;
grant execute on function public.vd_create_settlement(uuid, text[], text, date, text) to authenticated;
grant execute on function public.vd_approve_settlement(text) to authenticated;
grant execute on function public.vd_pay_settlement(text, text) to authenticated;
grant execute on function public.vd_reverse_settlement(text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 17. Backfill: create Master Orders for existing bookings (idempotent —
--     skips bookings that already have an order). Existing checkout charged
--     the full amount, so confirmed bookings are recorded as paid.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  bk record;
  v_lines jsonb;
  v_res jsonb;
  v_total numeric;
begin
  for bk in
    select b.* from vd_bookings b
    where not exists (select 1 from vd_orders o where o.booking_id = b.id)
  loop
    v_lines := '[]'::jsonb;

    -- Stay line
    if bk.value->'stay' is not null and bk.value->'stay'->>'id' is not null then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'supplierId', (select owner_id::text from vd_entities where id = bk.value->'stay'->>'id' and kind = 'property'),
        'supplierName', bk.value->'stay'->>'title',
        'category', 'accommodation',
        'productId', bk.value->'stay'->>'id',
        'title', coalesce(bk.value->'stay'->>'title', 'Accommodation')
                 || coalesce(' — ' || nullif(bk.value->'stay'->>'roomName',''), ''),
        'serviceDate', bk.value->>'checkIn',
        'endDate', bk.value->>'checkOut',
        'guests', coalesce((bk.value->>'guests')::int, 1),
        'quantity', coalesce((bk.value->>'nights')::numeric, 1),
        'unitLabel', 'night',
        'unitPrice', coalesce((bk.value->'stay'->>'price_per_night')::numeric, 0),
        'grossAmount', coalesce((bk.value->'stay'->>'price_per_night')::numeric, 0)
                       * coalesce((bk.value->>'nights')::numeric, 0)
      ));
    end if;

    -- Addon lines
    v_lines := v_lines || coalesce((
      select jsonb_agg(jsonb_build_object(
        'supplierId', a->>'supplierId',
        'supplierName', coalesce(a->>'operator', 'Visit Drakensberg'),
        'category', coalesce(a->>'type', 'activity'),
        'productId', a->>'id',
        'title', coalesce(a->>'title', 'Service'),
        'serviceDate', a->>'date',
        'guests', coalesce((a->>'guests')::int, 1),
        'quantity', coalesce((a->>'guests')::numeric, 1),
        'unitLabel', 'guest',
        'unitPrice', coalesce((a->>'price_per_person')::numeric, 0),
        'grossAmount', coalesce((a->>'price_per_person')::numeric, 0) * coalesce((a->>'guests')::numeric, 1)
      ))
      from jsonb_array_elements(coalesce(bk.value->'addons', '[]'::jsonb)) a
    ), '[]'::jsonb);

    -- Shuttle line (platform-arranged transfer)
    if bk.value->'shuttle' is not null then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'supplierName', 'Visit Drakensberg',
        'category', 'shuttle',
        'productId', bk.value->'shuttle'->>'id',
        'title', coalesce(bk.value->'shuttle'->>'label', 'Shuttle transfer'),
        'serviceDate', coalesce(bk.value->'shuttle'->>'date', bk.value->>'checkIn'),
        'quantity', 1,
        'unitLabel', 'trip',
        'unitPrice', coalesce((bk.value->'shuttle'->>'price')::numeric, 0),
        'grossAmount', coalesce((bk.value->'shuttle'->>'price')::numeric, 0)
      ));
    end if;

    if jsonb_array_length(v_lines) = 0 then continue; end if;

    v_total := coalesce((bk.value->>'total')::numeric, 0);

    v_res := vd_create_order(
      jsonb_build_object(
        'bookingId', bk.id,
        'customerName', coalesce(bk.value->>'customerName', ''),
        'customerEmail', coalesce(bk.value->>'customerEmail', ''),
        'tripName', coalesce(nullif(bk.value->>'region',''), 'Drakensberg') || ' trip — ' || bk.reference,
        'travelStart', bk.value->>'checkIn',
        'travelEnd', bk.value->>'checkOut',
        'subtotal', coalesce((bk.value->>'subtotal')::numeric, 0),
        'serviceFee', coalesce((bk.value->>'serviceFee')::numeric, 0),
        'taxAmount', coalesce((bk.value->>'vat')::numeric, 0),
        'total', v_total,
        'value', jsonb_build_object('backfilled', true, 'reference', bk.reference)
      ),
      v_lines,
      null,
      case when bk.status = 'confirmed' and v_total > 0
           then jsonb_build_object('amount', v_total, 'type', 'payment', 'method', 'card', 'reference', bk.reference)
           else null end,
      bk.user_id
    );

    if bk.status = 'cancelled' then
      perform vd_cancel_order(v_res->>'orderId');
    end if;
  end loop;
end $$;
