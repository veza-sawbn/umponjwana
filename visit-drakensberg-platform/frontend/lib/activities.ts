import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId, listEntitiesByOwner } from './entities'
import type { GraphFields } from './graph-fields'
import { slugify, uniqueSlug } from './slugify'
import type { Season, SeasonTopic } from './seasons'
import type { SupabaseClient } from '@supabase/supabase-js'

// Single canonical activity-category vocabulary — imported by both the
// supplier creation/edit forms and the public /activities filter tabs.
// Previously these were two independently hand-maintained lists that had
// drifted apart: the supplier form offered 'Nature'/'Water' (which the
// public page never showed, making activities tagged with them
// unreachable via the public filter), and the public page offered
// 'Wildlife' (which no supplier could ever select, so the tab always
// returned zero results). This list is their union, plus the destination
// graph's new "Things to Do" taxonomy values.
export const ACTIVITY_CATEGORIES = [
  'Adventure', 'Nature', 'Water', 'Wildlife', 'Cultural', 'Wellness', 'Family',
  'Photography', 'Horse Riding', 'Fishing', 'Rock Climbing', 'Cycling',
] as const

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[number]

export type Activity = {
  id: string
  supplierId: string
  supplierName: string
  name: string
  category: string
  region: string
  difficulty: string
  description: string
  durationH: number
  durationM: number
  minAge: number
  maxGroup: number
  meetingPoint: string
  gpsLat: string
  gpsLng: string
  whatToWear: string
  photos: string[]
  included: string[]
  safetyNotes: string
  pricePerPerson: number
  priceGroup: number
  depositRequired: boolean
  depositPercent: string
  status: 'active' | 'draft'
  createdAt: string
  /** Which seasons this activity suits — powers the region "When to Go"
   *  module and /regions/[slug]/[season] pages. See lib/seasons.ts. */
  seasons?: Season[]
  /** Which season-page topic groups ("By Water", "In the Mountains", …)
   *  this activity should appear under. See lib/seasons.ts. */
  topics?: SeasonTopic[]
} & GraphFields

const KIND = 'activity'

export async function getActivities(client?: SupabaseClient): Promise<Activity[]> {
  return client ? listEntities<Activity>(KIND, client) : listEntities<Activity>(KIND)
}

export async function getActivitiesBySupplier(supplierId: string): Promise<Activity[]> {
  // Owner-scoped at the database — see the note in lib/entities.ts on why
  // listEntities() must not be used for supplier-facing reads.
  return listEntitiesByOwner<Activity>(KIND, supplierId)
}

export async function getActivityById(id: string, client?: SupabaseClient): Promise<Activity | null> {
  return client ? getEntity<Activity>(KIND, id, client) : getEntity<Activity>(KIND, id)
}

export async function addActivity(a: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
  // Slug population (see lib/slugify.ts) — auto-generated from the
  // activity name unless already supplied, unique against every other
  // activity's canonical URL segment (slug || id).
  const slug = a.slug || uniqueSlug(slugify(a.name), (await getActivities()).map(e => e.slug || e.id))
  const activity: Activity = { ...a, slug, id: newEntityId('act'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, activity)
}

export async function updateActivity(id: string, patch: Partial<Activity>): Promise<void> {
  await updateEntity(KIND, id, patch)
}

export async function deleteActivity(id: string): Promise<void> {
  await deleteEntity(KIND, id)
}
