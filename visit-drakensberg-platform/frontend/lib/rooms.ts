import { supabase } from './auth'
import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId, listEntitiesByOwner } from './entities'
import type { SupabaseClient } from '@supabase/supabase-js'

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

// A room has no public page of its own — its price/details render on its
// parent property's /stays/[id] page, which is ISR-cached for up to 5
// minutes (app/stays/[id]/page.tsx). Without this, a supplier's room-price
// edit sits correctly in the database but the public page keeps serving its
// last-generated snapshot until that window happens to lapse. Best-effort
// and non-blocking, same pattern as lib/properties.ts's revalidateStayPage
// (which this calls directly, since it's the same cache key: the property id).
function revalidateStayPage(propertyId: string): void {
  if (typeof fetch !== 'function' || !propertyId) return
  fetch('/api/revalidate/stay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: propertyId }),
  }).catch(() => {})
}

export async function getRoomsBySupplier(supplierId: string): Promise<Room[]> {
  // Owner-scoped at the database. Filtering listEntities() in JS would still
  // ship every other supplier's rooms to the browser, and would key on the
  // value.supplierId copy rather than the authoritative owner_id column.
  return listEntitiesByOwner<Room>(KIND, supplierId)
}

export async function getRoomsByProperty(propertyId: string, client?: SupabaseClient): Promise<Room[]> {
  const all = client ? await listEntities<Room>(KIND, client) : await listEntities<Room>(KIND)
  return all.filter(r => r.propertyId === propertyId)
}

export async function getRoomById(id: string): Promise<Room | null> {
  return getEntity<Room>(KIND, id)
}

export async function addRoom(r: Omit<Room, 'id' | 'createdAt'>): Promise<Room> {
  const room: Room = { ...r, id: newEntityId('room'), createdAt: new Date().toISOString() }
  const saved = await insertEntity(KIND, room)
  revalidateStayPage(saved.propertyId)
  return saved
}

export async function updateRoom(id: string, updates: Partial<Room>): Promise<void> {
  await updateEntity(KIND, id, updates)
  // `updates` usually won't carry `propertyId` (the edit form never touches
  // it) — read it back rather than assuming the patch is enough, same as
  // lib/activities.ts's updateActivity reads back the slug it needs.
  const propertyId = updates.propertyId ?? (await getRoomById(id))?.propertyId
  if (propertyId) revalidateStayPage(propertyId)
}

export async function deleteRoom(id: string): Promise<void> {
  const room = await getRoomById(id)
  await deleteEntity(KIND, id)
  if (room?.propertyId) revalidateStayPage(room.propertyId)
}

/**
 * Units of this room still free for a date range (server-computed from
 * confirmed bookings). Returns null when dates are missing or the check
 * fails — callers should treat null as "unknown", not "sold out".
 */
export async function getRoomUnitsLeft(roomId: string, checkIn: string, checkOut: string): Promise<number | null> {
  if (!roomId || !checkIn || !checkOut) return null
  try {
    const { data, error } = await supabase.rpc('vd_room_units_left', {
      p_room_id: roomId,
      p_check_in: checkIn,
      p_check_out: checkOut,
    })
    if (error) return null
    return typeof data === 'number' ? data : null
  } catch {
    return null
  }
}
