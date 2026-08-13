import {
  listEntities, listEntitiesByOwner, insertEntity, updateEntity, deleteEntity, newEntityId,
} from './entities'
import { deleteDeparturesByTour } from './departures'
import { getEffectiveSupplierId } from './effective-supplier'

export type Tour = {
  id: string
  trailId: string
  trailName: string
  name: string
  difficulty: string
  days: number
  minAge: number
  maxGroup: number
  meetingPoint: string
  gpsLat: string
  gpsLng: string
  description: string
  included: string[]
  fitnessNotes: string
  cancellation: string
  pricePerPerson: number
  groupDiscount: number
  status: 'active' | 'draft'
  supplierName: string
  supplierId: string
  createdAt: string
  // Optional marketplace fields (trekking experience detail / comparison).
  // Older tours won't carry these; readers must treat them as absent.
  leadGuide?: string
  accommodationStyle?: string
  mealsIncluded?: string
  transportIncluded?: boolean
  equipmentIncluded?: boolean
  guideExperienceYears?: number
  rating?: number
  reviewCount?: number
  featured?: boolean
}

const KIND = 'tour'

/**
 * Public catalog read — every live tour on the platform.
 * Use only on public-facing pages and in the admin console.
 * Supplier-portal screens must use getMyTours() / getToursBySupplier().
 */
export async function getTours(): Promise<Tour[]> {
  return listEntities<Tour>(KIND)
}

/** Only the tours owned by `supplierId`. */
export async function getToursBySupplier(supplierId: string): Promise<Tour[]> {
  return listEntitiesByOwner<Tour>(KIND, supplierId)
}

/**
 * The signed-in supplier's own tours — or, for operations staff who have
 * entered a managed supplier, that supplier's tours.
 */
export async function getMyTours(): Promise<Tour[]> {
  const ownerId = await getEffectiveSupplierId()
  return ownerId ? getToursBySupplier(ownerId) : []
}

export async function addTour(tour: Omit<Tour, 'id' | 'createdAt'>): Promise<Tour> {
  const newTour: Tour = { ...tour, id: newEntityId('tour'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, newTour)
}

export async function updateTour(id: string, patch: Partial<Tour>): Promise<void> {
  await updateEntity(KIND, id, patch)
}

export async function deleteTour(id: string): Promise<void> {
  await Promise.all([deleteEntity(KIND, id), deleteDeparturesByTour(id)])
}
