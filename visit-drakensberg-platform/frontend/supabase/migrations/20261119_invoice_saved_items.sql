-- ============================================================================
-- Visit Drakensberg — Saved invoice items and bundles
-- Run AFTER 20261109_departure_drafts.sql.
--
-- Staff raising a manual invoice in /admin/invoices type the same lines again
-- and again: the Sentinel shuttle, the Ezemvelo conservation levy, the
-- Northern Mini Traverse with its included return transfer. This adds a
-- shared library of those lines.
--
--   item     one saved line: title, description, category, unit label,
--            default quantity and price, and a default supplier.
--   bundle   several saved lines added together, e.g. a package and the
--            components it includes. A bundle's lines may carry a discount
--            (usually a 100% write-off "Included in package"), using the
--            same fields as the per-line discounts from
--            20261101_invoice_line_discounts.sql.
--
-- A saved item is only a template for the invoice form. Picking one COPIES its
-- values into the line, where everything (supplier included) can still be
-- changed for that one invoice. Nothing here is read by vd_create_order,
-- vd_update_order or the ledger, so editing or archiving an item never changes
-- an invoice or draft that already used it, and the server still prices,
-- validates and routes every line exactly as before.
--
-- Shared by all staff who can raise invoices (is_admin() or is_finance(), the
-- same people as vd_invoice_drafts). Customers and suppliers never see it.
-- ============================================================================
-- @rollback: additive — drop table vd_invoice_items; drop function vd_invoice_items_check(); drop function vd_record_invoice_item_use(text[])

create table if not exists vd_invoice_items (
  id            text primary key,
  kind          text not null default 'item' check (kind in ('item', 'bundle')),
  -- What staff search for. For an item it is the line's title.
  name          text not null,
  -- Internal only, never printed on an invoice.
  notes         text not null default '',
  -- [{title, description, category, quantity, unitLabel, unitPrice, supplierId,
  --   discountType?, discountValue?, discountReason?, discountFundedBy?}]
  -- An item holds exactly one line, a bundle two or more.
  lines         jsonb not null default '[]'::jsonb,
  use_count     integer not null default 0,
  last_used_at  timestamptz,
  archived      boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One live entry per name, so "Save as item" can offer to update the existing
-- one instead of quietly creating a near-duplicate.
create unique index if not exists vd_invoice_items_live_name_idx
  on vd_invoice_items (kind, lower(name)) where not archived;
create index if not exists vd_invoice_items_use_idx
  on vd_invoice_items (archived, use_count desc, last_used_at desc nulls last);

-- ────────────────────────────────────────────────────────────────────────────
-- Shape check. The form validates too; this keeps a bad row from ever being
-- offered to someone raising an invoice.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_invoice_items_check()
returns trigger language plpgsql set search_path = public as $$
declare
  v_line     jsonb;
  v_n        int;
  v_title    text;
  v_qty      numeric;
  v_price    numeric;
  v_dtype    text;
  v_dvalue   numeric;
  v_supplier text;
begin
  new.name := btrim(coalesce(new.name, ''));
  new.notes := btrim(coalesce(new.notes, ''));

  if jsonb_typeof(new.lines) is distinct from 'array' then
    raise exception 'a saved item needs its lines as a list';
  end if;
  v_n := jsonb_array_length(new.lines);
  if new.kind = 'item' and v_n <> 1 then
    raise exception 'a saved item has exactly one line';
  end if;
  if new.kind = 'bundle' and v_n < 2 then
    raise exception 'a bundle needs at least two lines';
  end if;
  if v_n > 50 then
    raise exception 'a bundle can hold at most 50 lines';
  end if;

  for v_line in select * from jsonb_array_elements(new.lines) loop
    if jsonb_typeof(v_line) is distinct from 'object' then
      raise exception 'each saved line must be an object';
    end if;
    v_title := btrim(coalesce(v_line->>'title', ''));
    if v_title = '' then raise exception 'every saved line needs a title'; end if;
    if length(v_title) > 200 then raise exception 'the title "%" is too long', left(v_title, 40); end if;
    if length(coalesce(v_line->>'description', '')) > 2000 then
      raise exception 'the description on "%" is too long', v_title;
    end if;

    begin
      v_qty   := coalesce(nullif(v_line->>'quantity', '')::numeric, 1);
      v_price := coalesce(nullif(v_line->>'unitPrice', '')::numeric, 0);
    exception when others then
      raise exception 'the quantity or price on "%" is not a number', v_title;
    end;
    if v_qty <= 0 then raise exception 'the quantity on "%" must be more than 0', v_title; end if;
    if v_price < 0 then raise exception 'the price on "%" cannot be negative', v_title; end if;

    v_supplier := coalesce(v_line->>'supplierId', '');
    if v_supplier <> '' and v_supplier !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'the supplier on "%" is not valid', v_title;
    end if;

    v_dtype := coalesce(v_line->>'discountType', '');
    if v_dtype <> '' then
      if v_dtype not in ('amount', 'percent') then
        raise exception 'the discount on "%" must be an amount or a percentage', v_title;
      end if;
      begin
        v_dvalue := coalesce(nullif(v_line->>'discountValue', '')::numeric, 0);
      exception when others then
        raise exception 'the discount on "%" is not a number', v_title;
      end;
      if v_dvalue < 0 then raise exception 'the discount on "%" cannot be negative', v_title; end if;
      if v_dtype = 'percent' and v_dvalue > 100 then
        raise exception 'the discount on "%" cannot be more than 100%%', v_title;
      end if;
      if v_dtype = 'amount' and v_price > 0 and v_dvalue > v_price * v_qty then
        raise exception 'the discount on "%" is more than its price', v_title;
      end if;
      if coalesce(v_line->>'discountFundedBy', 'supplier') not in ('supplier', 'platform') then
        raise exception 'the discount on "%" must be covered by the supplier or the platform', v_title;
      end if;
    end if;
  end loop;

  if new.kind = 'item' then
    -- An item is found by its line's title; keep the two the same.
    new.name := btrim(new.lines->0->>'title');
  end if;
  if new.name = '' then raise exception 'a bundle needs a name'; end if;
  if length(new.name) > 200 then raise exception 'that name is too long'; end if;

  if tg_op = 'UPDATE' then
    -- Counting a use is not an edit.
    if (new.kind, new.name, new.notes, new.lines, new.archived)
       is distinct from (old.kind, old.name, old.notes, old.lines, old.archived) then
      new.updated_at := now();
      new.updated_by := coalesce(auth.uid(), new.updated_by);
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists vd_invoice_items_check_trg on vd_invoice_items;
create trigger vd_invoice_items_check_trg
  before insert or update on vd_invoice_items
  for each row execute function vd_invoice_items_check();

alter table vd_invoice_items enable row level security;

drop policy if exists "Staff manage saved invoice items" on vd_invoice_items;
create policy "Staff manage saved invoice items" on vd_invoice_items
  for all using (is_admin() or is_finance()) with check (is_admin() or is_finance());

-- Supabase's default privileges already grant these; stated so a database
-- built without them (and the SQL test harness) matches production.
grant select, insert, update, delete on vd_invoice_items to authenticated;
revoke all on vd_invoice_items from anon;

-- ────────────────────────────────────────────────────────────────────────────
-- Count a use, so the most-used items are offered first. Runs as the caller:
-- RLS decides who may, and an id the caller cannot see is simply skipped.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_record_invoice_item_use(p_ids text[])
returns void language sql security invoker set search_path = public as $$
  update vd_invoice_items
     set use_count = use_count + 1, last_used_at = now()
   where id = any(coalesce(p_ids, '{}'));
$$;
revoke all on function public.vd_record_invoice_item_use(text[]) from public, anon;
grant execute on function public.vd_record_invoice_item_use(text[]) to authenticated;
