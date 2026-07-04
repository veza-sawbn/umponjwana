import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'

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

const KIND = 'room'

export async function getRoomsBySupplier(supplierId: string): Promise<Room[]> {
  const all = await listEntities<Room>(KIND)
  return all.filter(r => r.supplierId === supplierId)
}

export async function getRoomsByProperty(propertyId: string): Promise<Room[]> {
  const all = await listEntities<Room>(KIND)
  return all.filter(r => r.propertyId === propertyId)
}

export async function getRoomById(id: string): Promise<Room | null> {
  return getEntity<Room>(KIND, id)
}

export async function addRoom(r: Omit<Room, 'id' | 'createdAt'>): Promise<Room> {
  const room: Room = { ...r, id: newEntityId('room'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, room)
}

export async function updateRoom(id: string, updates: Partial<Room>): Promise<void> {
  await updateEntity(KIND, id, updates)
}

export async function deleteRoom(id: string): Promise<void> {
  await deleteEntity(KIND, id)
}
