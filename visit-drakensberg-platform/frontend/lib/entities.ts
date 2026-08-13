import { supabase } from './auth'

// Core data access for catalog entities stored one-row-per-item in the
// `vd_entities` table (see supabase/migrations/20260704_secure_data_layer.sql).
// Row shape: { id, kind, owner_id, status, value(jsonb), created_at, updated_at }
// The full domain object lives in `value`; id/status are mirrored into columns
// so RLS and queries can use them. Domain libs (properties, rooms, …) wrap
// this module and keep their public signatures unchanged.

type EntityRow = {
  id: string
  kind: string
  owner_id: string | null
  status: string
  value: Record<string, unknown>
  created_at: string
  updated_at: string
}

function rowToItem<T>(row: EntityRow): T {
  return {
    ...(row.value as object),
    id: row.id,
    status: row.status,
  } as T
}

export function newEntityId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${uuid}`
}

/**
 * Reads every visible row of `kind`.
 *
 * IMPORTANT — this is the *public catalog* read. RLS on vd_entities grants
 * "Public entities are readable" for any row whose status is active/open/
 * confirmed/full, and Postgres OR-combines permissive policies, so this
 * returns other suppliers' live listings by design. That is correct for
 * anonymous browsing (/stays, /tours) and wrong for anything inside the
 * supplier portal.
 *
 * Supplier-facing screens must use listEntitiesByOwner() instead — RLS will
 * not scope the rows for you.
 */
export async function listEntities<T>(kind: string): Promise<T[]> {
  try {
    const { data } = await supabase
      .from('vd_entities')
      .select('*')
      .eq('kind', kind)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as EntityRow[]).map(r => rowToItem<T>(r))
  } catch {}
  return []
}

/**
 * Reads only the rows owned by `ownerId` — the correct read for the supplier
 * portal and for operations staff acting on a managed supplier's behalf.
 *
 * Filtering on owner_id here is the actual tenant boundary for reads: the
 * "Owners read own entities" policy is permissive and sits alongside the
 * public-catalog policy, so it narrows nothing on its own.
 */
export async function listEntitiesByOwner<T>(kind: string, ownerId: string): Promise<T[]> {
  if (!ownerId) return []
  try {
    const { data } = await supabase
      .from('vd_entities')
      .select('*')
      .eq('kind', kind)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as EntityRow[]).map(r => rowToItem<T>(r))
  } catch {}
  return []
}

export async function getEntity<T>(kind: string, id: string): Promise<T | null> {
  try {
    const { data } = await supabase
      .from('vd_entities')
      .select('*')
      .eq('kind', kind)
      .eq('id', id)
      .maybeSingle()
    if (data) return rowToItem<T>(data as EntityRow)
  } catch {}
  return null
}

export async function insertEntity<T extends { id: string; status?: string; supplierId?: string }>(
  kind: string,
  item: T,
): Promise<T> {
  // owner_id is what every ownership check keys on, so it must never be null.
  // A row inserted without an owner is invisible to owner-scoped reads yet
  // still public once active — exactly the shape of a cross-tenant leak.
  // Fall back to the signed-in user when the item carries no supplierId.
  let ownerId = item.supplierId || null
  if (!ownerId) {
    const { data: { user } } = await supabase.auth.getUser()
    ownerId = user?.id ?? null
  }
  if (!ownerId) throw new Error('Cannot create this record without a signed-in owner.')

  const { error } = await supabase.from('vd_entities').insert({
    id: item.id,
    kind,
    owner_id: ownerId,
    status: item.status || 'active',
    value: item,
  })
  if (error) throw error
  return item
}

export async function updateEntity(
  kind: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data } = await supabase
    .from('vd_entities')
    .select('value')
    .eq('kind', kind)
    .eq('id', id)
    .maybeSingle()
  if (!data) return
  const merged = { ...(data.value as object), ...patch, id } as Record<string, unknown>
  const update: Record<string, unknown> = {
    value: merged,
    updated_at: new Date().toISOString(),
  }
  if (typeof merged.status === 'string') {
    update.status = merged.status
  }
  const { error } = await supabase
    .from('vd_entities')
    .update(update)
    .eq('kind', kind)
    .eq('id', id)
  if (error) throw error
}

export async function deleteEntity(kind: string, id: string): Promise<void> {
  const { error } = await supabase.from('vd_entities').delete().eq('kind', kind).eq('id', id)
  if (error) throw error
}
