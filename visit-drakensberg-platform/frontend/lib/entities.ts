import { supabase } from './auth'
import type { SupabaseClient } from '@supabase/supabase-js'

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

// Both read functions accept an optional Supabase client so Server
// Components can pass a session-less client (lib/supabase-public.ts) —
// same pattern as lib/regions.ts's getRegions(). Existing callers (every
// domain lib wrapping this module) are unaffected; only the new server
// detail-page shells pass a client explicitly.
export async function listEntities<T>(kind: string, client: SupabaseClient = supabase): Promise<T[]> {
  try {
    const { data } = await client
      .from('vd_entities')
      .select('*')
      .eq('kind', kind)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as EntityRow[]).map(r => rowToItem<T>(r))
  } catch {}
  return []
}

export async function getEntity<T>(kind: string, id: string, client: SupabaseClient = supabase): Promise<T | null> {
  try {
    const { data } = await client
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
  const { error } = await supabase.from('vd_entities').insert({
    id: item.id,
    kind,
    owner_id: item.supplierId || null,
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
