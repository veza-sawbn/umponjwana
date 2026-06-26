import { supabase } from './auth'

export type SupplierStatus = 'active' | 'draft' | 'pending' | 'verified' | 'rejected' | 'inactive' | 'maintenance' | string

export type SupplierEntity = {
  id: string
  supplierId: string
  createdAt: string
  updatedAt?: string
  [key: string]: any
}

const keyFor = (entity: string) => `supplier_${entity}`

async function getAll<T extends SupplierEntity>(entity: string): Promise<T[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', keyFor(entity))
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) return data.value.items as T[]
  } catch {}
  return []
}

async function saveAll<T extends SupplierEntity>(entity: string, items: T[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: keyFor(entity), value: { items }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

export async function getSupplierEntities<T extends SupplierEntity>(entity: string, supplierId?: string): Promise<T[]> {
  const all = await getAll<T>(entity)
  return supplierId ? all.filter(item => item.supplierId === supplierId) : all
}

export async function getSupplierEntity<T extends SupplierEntity>(entity: string, id: string): Promise<T | null> {
  const all = await getAll<T>(entity)
  return all.find(item => item.id === id) ?? null
}

export async function addSupplierEntity<T extends SupplierEntity>(entity: string, data: Omit<T, 'id' | 'createdAt'> & Partial<Pick<T, 'id' | 'createdAt'>>): Promise<T> {
  const all = await getAll<T>(entity)
  const now = new Date().toISOString()
  const item = {
    ...data,
    id: data.id ?? `${entity}-${Date.now()}`,
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  } as T
  await saveAll(entity, [...all, item])
  return item
}

export async function updateSupplierEntity<T extends SupplierEntity>(entity: string, id: string, patch: Partial<T>): Promise<void> {
  const all = await getAll<T>(entity)
  const now = new Date().toISOString()
  await saveAll(entity, all.map(item => item.id === id ? { ...item, ...patch, updatedAt: now } : item))
}

export async function deleteSupplierEntity<T extends SupplierEntity>(entity: string, id: string): Promise<void> {
  const all = await getAll<T>(entity)
  await saveAll(entity, all.filter(item => item.id !== id))
}
