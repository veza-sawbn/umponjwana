-- ============================================================================
-- Visit Drakensberg — vd_entities owner_id backfill + integrity guard
--
-- Context: vd_entities.owner_id is the authoritative ownership column. Every
-- supplier-facing read now filters on it (lib/entities.ts listEntitiesByOwner).
-- The domain object also carries a `supplierId` copy inside value, and the two
-- could drift:
--
--   * the original blob migration set owner_id from value->>'supplierId' but
--     silently left it NULL when that string wasn't a valid uuid
--   * insertEntity() used to write owner_id = null when an item arrived with
--     no supplierId
--
-- A row with a NULL owner_id is invisible to every owner-scoped read yet still
-- publicly readable once its status is active — an orphan. This migration
-- reunites those rows with their owner and stops new ones appearing.
-- ============================================================================

-- ─── 1. Backfill owner_id from the value.supplierId copy ────────────────────
-- Only where the copy is a real uuid belonging to an existing user, so a
-- malformed or stale supplierId can't point a row at nobody (or at a
-- deleted account).
update vd_entities e
   set owner_id = (e.value->>'supplierId')::uuid
 where e.owner_id is null
   and e.value->>'supplierId' is not null
   and e.value->>'supplierId' <> ''
   and e.value->>'supplierId' ~ '^[0-9a-fA-F-]{36}$'
   and exists (
     select 1 from auth.users u where u.id = (e.value->>'supplierId')::uuid
   );

-- ─── 2. Keep the two representations in step from here on ───────────────────
-- Mirrors owner_id into value.supplierId on write, so the JSON copy can never
-- disagree with the column that authorisation actually keys on.
create or replace function public.vd_entities_sync_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Fall back to the JSON copy when a caller supplies only that.
  if new.owner_id is null
     and new.value->>'supplierId' ~ '^[0-9a-fA-F-]{36}$' then
    new.owner_id := (new.value->>'supplierId')::uuid;
  end if;

  -- owner_id wins: write it back into value so readers of either agree.
  if new.owner_id is not null then
    new.value := jsonb_set(
      coalesce(new.value, '{}'::jsonb),
      '{supplierId}',
      to_jsonb(new.owner_id::text),
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists vd_entities_sync_owner_trg on vd_entities;
create trigger vd_entities_sync_owner_trg
  before insert or update on vd_entities
  for each row execute function public.vd_entities_sync_owner();

-- ─── 3. What's left over ────────────────────────────────────────────────────
-- Run this after the migration. Any row it returns is an orphan whose owner
-- could not be determined — it belongs to no supplier portal, so decide per
-- row whether to assign an owner or delete it. Nothing is deleted here.
--
--   select id, kind, status, value->>'supplierId' as claimed_supplier, created_at
--     from vd_entities
--    where owner_id is null
--    order by kind, created_at;
