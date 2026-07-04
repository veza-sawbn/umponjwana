import { listEntities, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'
import { deleteDeparturesByTour } from './departures'

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
}

const KIND = 'tour'

export async function getTours(): Promise<Tour[]> {
  return listEntities<Tour>(KIND)
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
