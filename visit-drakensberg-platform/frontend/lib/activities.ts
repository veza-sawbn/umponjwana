import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'
import type { GraphFields } from './graph-fields'

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
} & GraphFields

const KIND = 'activity'

export async function getActivities(): Promise<Activity[]> {
  return listEntities<Activity>(KIND)
}

export async function getActivitiesBySupplier(supplierId: string): Promise<Activity[]> {
  const all = await listEntities<Activity>(KIND)
  return all.filter(a => a.supplierId === supplierId)
}

export async function getActivityById(id: string): Promise<Activity | null> {
  return getEntity<Activity>(KIND, id)
}

export async function addActivity(a: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
  const activity: Activity = { ...a, id: newEntityId('act'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, activity)
}

export async function updateActivity(id: string, patch: Partial<Activity>): Promise<void> {
  await updateEntity(KIND, id, patch)
}

export async function deleteActivity(id: string): Promise<void> {
  await deleteEntity(KIND, id)
}
