import { supabase } from './auth'

export type Property = {
  id: string
  supplierId: string
  name: string
  type: string
  starRating: string
  description: string
  address: string
  gpsLat: string
  gpsLng: string
  nearestTown: string
  accessNotes: string
  amenities: string[]
  checkIn: string
  checkOut: string
  petPolicy: string
  cancellationPolicy: string
  photos: string[]
  status: 'active' | 'draft'
  createdAt: string
}

async function getAll(): Promise<Property[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'properties')
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) {
      return data.value.items as Property[]
    }
  } catch {}
  return []
}

async function saveAll(items: Property[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'properties', value: { items }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

export async function getPropertiesBySupplier(supplierId: string): Promise<Property[]> {
  const all = await getAll()
  return all.filter(p => p.supplierId === supplierId)
}

export async function addProperty(p: Omit<Property, 'id' | 'createdAt'>): Promise<Property> {
  const all = await getAll()
  const now = new Date().toISOString()
  const prop: Property = { ...p, id: `prop-${Date.now()}`, createdAt: now }
  await saveAll([...all, prop])
  return prop
}

export async function updateProperty(id: string, updates: Partial<Property>): Promise<void> {
  const all = await getAll()
  await saveAll(all.map(p => p.id === id ? { ...p, ...updates } : p))
}

export async function deleteProperty(id: string): Promise<void> {
  const all = await getAll()
  await saveAll(all.filter(p => p.id !== id))
}
