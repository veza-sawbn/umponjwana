import { supabase } from './auth'

export type Season = { name: string; from: string; to: string; price: string }

export type Room = {
  id: string
  propertyId: string
  propertyName: string
  supplierId: string
  name: string
  bedConfig: string
  maxOccupancy: number
  units: number
  sizeSqm: number
  enSuite: boolean
  amenities: string[]
  images: string[]
  features: string[]
  inclusions: string[]
  basePrice: number
  weekendSurcharge: number
  seasons: Season[]
  minNights: number
  cleaningFee: number
  status: 'active' | 'draft'
  createdAt: string
}

async function getAll(): Promise<Room[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'rooms')
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) {
      return data.value.items as Room[]
    }
  } catch {}
  return []
}

async function saveAll(items: Room[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'rooms', value: { items }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

export async function getRoomsBySupplier(supplierId: string): Promise<Room[]> {
  const all = await getAll()
  return all.filter(r => r.supplierId === supplierId)
}

export async function getRoomsByProperty(propertyId: string): Promise<Room[]> {
  const all = await getAll()
  return all.filter(r => r.propertyId === propertyId)
}

export async function getRoomById(id: string): Promise<Room | null> {
  const all = await getAll()
  return all.find(r => r.id === id) ?? null
}

export async function addRoom(r: Omit<Room, 'id' | 'createdAt'>): Promise<Room> {
  const all = await getAll()
  const now = new Date().toISOString()
  const room: Room = { ...r, id: `room-${Date.now()}`, createdAt: now }
  await saveAll([...all, room])
  return room
}

export async function updateRoom(id: string, updates: Partial<Room>): Promise<void> {
  const all = await getAll()
  await saveAll(all.map(r => r.id === id ? { ...r, ...updates } : r))
}

export async function deleteRoom(id: string): Promise<void> {
  const all = await getAll()
  await saveAll(all.filter(r => r.id !== id))
}
