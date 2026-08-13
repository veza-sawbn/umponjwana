import { DEFAULT_REGIONS } from './regions'
import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'
import type { GraphFields } from './graph-fields'
import type { SupabaseClient } from '@supabase/supabase-js'

export const PROPERTY_REGIONS = DEFAULT_REGIONS.map(region => region.name)

// Shared vocabulary for every surface that describes a property: the supplier
// wizard, the property edit form and the public listing application. Resort,
// Glamping and Farm Stay were added for the "Stay" destination-graph
// taxonomy — genuine, distinct South African tourism accommodation
// categories, not just labels to complete a menu.
export const PROPERTY_TYPES = [
  'Lodge', 'Guesthouse', 'Hotel', 'Self-catering Cottage', 'Campsite', 'Backpackers', 'Boutique Hotel',
  'Resort', 'Glamping', 'Farm Stay',
]

export const PROPERTY_AMENITIES = [
  'Swimming Pool', 'Braai Facilities', 'Wi-Fi', 'Restaurant', 'Bar', 'Spa', 'Gym', 'Laundry',
  'Pet-Friendly', 'Wheelchair Access', 'Airport Transfers', 'Hiking Trails Access',
]

export type Property = {
  id: string
  supplierId: string
  name: string
  type: string
  starRating: string
  description: string
  region: string
  address: string
  gpsLat: string
  gpsLng: string
  accessNotes: string
  amenities: string[]
  checkIn: string
  checkOut: string
  petPolicy: string
  cancellationPolicy: string
  photos: string[]
  status: 'active' | 'draft'
  createdAt: string
} & GraphFields

const KIND = 'property'

export async function getProperties(client?: SupabaseClient): Promise<Property[]> {
  return client ? listEntities<Property>(KIND, client) : listEntities<Property>(KIND)
}

export async function getPropertyById(id: string, client?: SupabaseClient): Promise<Property | null> {
  return client ? getEntity<Property>(KIND, id, client) : getEntity<Property>(KIND, id)
}

export async function getPropertiesBySupplier(supplierId: string): Promise<Property[]> {
  const all = await listEntities<Property>(KIND)
  return all.filter(p => p.supplierId === supplierId)
}

export async function addProperty(p: Omit<Property, 'id' | 'createdAt'>): Promise<Property> {
  const prop: Property = { ...p, id: newEntityId('prop'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, prop)
}

export async function updateProperty(id: string, updates: Partial<Property>): Promise<void> {
  await updateEntity(KIND, id, updates)
}

export async function deleteProperty(id: string): Promise<void> {
  await deleteEntity(KIND, id)
}
