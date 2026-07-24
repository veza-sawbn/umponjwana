-- ============================================================================
-- Visit Drakensberg — Online Invoice Payments (iKhokha)
-- Run AFTER 20260718_guest_orders.sql.
--
-- Tracks each iKhokha "iK Pay" payment link created against an invoice, so
-- the webhook handler (which runs with no customer session — service role
-- only) can look a callback up by paylink_id and reconcile it exactly once.
-- Actually marking the invoice/order paid still goes through the existing
-- vd_record_order_payment RPC (20260716_order_management.sql), which already
-- treats a NULL auth.uid() (service-role / webhook context) as trusted.
-- ============================================================================

create table if not exists vd_payment_links (
  id                       text primary key,
  order_id                 text not null references vd_orders(id) on delete cascade,
  invoice_id               text references vd_invoices(id) on delete set null,
  user_id                  uuid references auth.users(id) on delete cascade,
  gateway                  text not null default 'ikhokha',
  mode                     text not null default 'test', -- test|live
  paylink_id               text,
  external_transaction_id  text not null,
  amount                   numeric not null check (amount > 0),
  currency                 text not null default 'ZAR',
  status                   text not null default 'pending', -- pending|paid|failed|cancelled|expired
  paylink_url              text,
  payment_id               text, -- vd_order_payments.id once reconciled
  raw_create_response      jsonb not null default '{}'::jsonb,
  raw_status_response      jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  paid_at                  timestamptz
);
create unique index if not exists vd_payment_links_ext_txn_idx on vd_payment_links (external_transaction_id);
create index if not exists vd_payment_links_order_idx   on vd_payment_links (order_id);
create index if not exists vd_payment_links_invoice_idx on vd_payment_links (invoice_id);
create index if not exists vd_payment_links_paylink_idx on vd_payment_links (paylink_id);

alter table vd_payment_links enable row level security;

drop policy if exists "Customers read own payment links" on vd_payment_links;
drop policy if exists "Ops read all payment links"       on vd_payment_links;
drop policy if exists "Admins manage payment links"       on vd_payment_links;
create policy "Customers read own payment links" on vd_payment_links
  for select using (user_id = auth.uid());
create policy "Ops read all payment links" on vd_payment_links
  for select using (is_ops());
create policy "Admins manage payment links" on vd_payment_links
  for all using (is_admin()) with check (is_admin());
-- No insert/update policy on purpose: every write goes through the API
-- routes' service-role client (app/api/payments/ikhokha/*), never directly
-- from a customer or supplier session.
