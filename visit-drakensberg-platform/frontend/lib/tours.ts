import {
  listEntities, listEntitiesByOwner, insertEntity, updateEntity, deleteEntity, newEntityId,
} from './entities'
import { deleteDeparturesByTour } from './departures'
import { getEffectiveSupplierId } from './effective-supplier'
import type { GraphFields } from './graph-fields'
import { slugify, uniqueSlug } from './slugify'
import type { SupabaseClient } from '@supabase/supabase-js'

// One way to buy a seat on any departure of this tour — e.g. "Shuttled" vs
// "Self-Drive" — with its own price and its own add-ons. Departures choose
// which subset of a tour's tiers apply to their date (see DeparturePackage
// and composePackages() in lib/experiences.ts); a tour with none defined
// falls back to the flat `pricePerPerson` below.
export type PricingTier = {
  id: string
  name: string
  pricePerPerson: number
  inclusions: string[]
}

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
  // Kept in sync with the cheapest entry in `pricingTiers` (mirrors how
  // Departure.pricePerPerson follows its cheapest package) so the public
  // listing/SEO/admin surfaces that read this directly keep working
  // unchanged. Only a true stored value when pricingTiers is empty.
  pricePerPerson: number
  pricingTiers?: PricingTier[]
  /** @deprecated Removed from the supplier forms; retained so stored tours still parse. */
  groupDiscount?: number
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
} & GraphFields

const KIND = 'tour'

export function newPricingTierId(): string {
  return newEntityId('tier')
}

/**
 * Public catalog read — every live tour on the platform.
 * Use only on public-facing pages and in the admin console.
 * Supplier-portal screens must use getMyTours() / getToursBySupplier().
 */
export async function getTours(client?: SupabaseClient): Promise<Tour[]> {
  return client ? listEntities<Tour>(KIND, client) : listEntities<Tour>(KIND)
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
  // Slug population (see lib/slugify.ts) — auto-generated from the tour
  // name unless already supplied, unique against every other tour's
  // canonical URL segment (slug || id).
  const slug = tour.slug || uniqueSlug(slugify(tour.name), (await getTours()).map(e => e.slug || e.id))
  const newTour: Tour = { ...tour, slug, id: newEntityId('tour'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, newTour)
}

export async function updateTour(id: string, patch: Partial<Tour>): Promise<void> {
  await updateEntity(KIND, id, patch)
}

export async function deleteTour(id: string): Promise<void> {
  await Promise.all([deleteEntity(KIND, id), deleteDeparturesByTour(id)])
}
