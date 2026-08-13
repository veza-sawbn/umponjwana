import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId, listEntitiesByOwner } from './entities'

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
}

const KIND = 'activity'

export async function getActivities(): Promise<Activity[]> {
  return listEntities<Activity>(KIND)
}

export async function getActivitiesBySupplier(supplierId: string): Promise<Activity[]> {
  // Owner-scoped at the database — see the note in lib/entities.ts on why
  // listEntities() must not be used for supplier-facing reads.
  return listEntitiesByOwner<Activity>(KIND, supplierId)
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
