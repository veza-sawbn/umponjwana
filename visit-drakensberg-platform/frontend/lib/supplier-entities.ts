import type { SupabaseClient } from '@supabase/supabase-js'
import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'

export type SupplierStatus = 'active' | 'draft' | 'pending' | 'verified' | 'rejected' | 'inactive' | 'maintenance' | string

export type SupplierEntity = {
  id: string
  supplierId: string
  createdAt: string
  updatedAt?: string
  [key: string]: any
}

const kindFor = (entity: string) => `supplier_${entity}`

// Both read functions accept an optional Supabase client so Server
// Components can pass a session-less client (lib/supabase-public.ts) — same
// pattern as lib/entities.ts's listEntities()/getEntity(). Existing callers
// (supplier dashboards, using the session-bound default) are unaffected.
export async function getSupplierEntities<T extends SupplierEntity>(entity: string, supplierId?: string, client?: SupabaseClient): Promise<T[]> {
  const all = await listEntities<T>(kindFor(entity), client)
  return supplierId ? all.filter(item => item.supplierId === supplierId) : all
}

export async function getSupplierEntity<T extends SupplierEntity>(entity: string, id: string, client?: SupabaseClient): Promise<T | null> {
  return getEntity<T>(kindFor(entity), id, client)
}

export async function addSupplierEntity<T extends SupplierEntity>(entity: string, data: Omit<T, 'id' | 'createdAt'> & Partial<Pick<T, 'id' | 'createdAt'>>): Promise<T> {
  const now = new Date().toISOString()
  const item = {
    ...data,
    id: data.id ?? newEntityId(entity),
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  } as T
  return insertEntity(kindFor(entity), item)
}

export async function updateSupplierEntity<T extends SupplierEntity>(entity: string, id: string, patch: Partial<T>): Promise<void> {
  await updateEntity(kindFor(entity), id, { ...patch, updatedAt: new Date().toISOString() })
}

export async function deleteSupplierEntity<T extends SupplierEntity>(entity: string, id: string): Promise<void> {
  await deleteEntity(kindFor(entity), id)
}
