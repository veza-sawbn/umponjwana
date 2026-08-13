import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId, listEntitiesByOwner } from './entities'

export type SupplierStatus = 'active' | 'draft' | 'pending' | 'verified' | 'rejected' | 'inactive' | 'maintenance' | string

export type SupplierEntity = {
  id: string
  supplierId: string
  createdAt: string
  updatedAt?: string
  [key: string]: any
}

const kindFor = (entity: string) => `supplier_${entity}`

export async function getSupplierEntities<T extends SupplierEntity>(entity: string, supplierId?: string): Promise<T[]> {
  // When a supplier is named, scope the query at the database rather than
  // fetching every supplier's rows and discarding them client-side.
  if (supplierId) return listEntitiesByOwner<T>(kindFor(entity), supplierId)
  return listEntities<T>(kindFor(entity))
}

export async function getSupplierEntity<T extends SupplierEntity>(entity: string, id: string): Promise<T | null> {
  return getEntity<T>(kindFor(entity), id)
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
