import { listEntities, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'
import { deleteDeparturesByTour } from './departures'
import type { GraphFields } from './graph-fields'
import { slugify, uniqueSlug } from './slugify'
import type { SupabaseClient } from '@supabase/supabase-js'

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
} & GraphFields

const KIND = 'tour'

export async function getTours(client?: SupabaseClient): Promise<Tour[]> {
  return client ? listEntities<Tour>(KIND, client) : listEntities<Tour>(KIND)
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
