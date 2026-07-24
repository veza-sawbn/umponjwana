import { supabase } from './auth'
import { listEntities, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'

// A rate package is one way to buy a seat on a departure — e.g. "Self-Sufficient"
// vs "Portered" on the same scheduled hike, each with its own price and its own
// extra inclusions on top of the departure's baseline inclusions.
export type DeparturePackage = {
  id: string
  name: string
  pricePerPerson: number
  inclusions: string[]
  description?: string
}

export type Departure = {
  id: string
  tourId: string
  trailId: string
  tour: string
  supplierName: string
  supplierId: string
  tourDays: number
  date: string
  guide: string
  maxSeats: number
  bookedSeats: number
  status: 'open' | 'confirmed' | 'full'
  pricePerPerson: number
  // Baseline inclusions covered by every rate package on this departure
  // (e.g. guide, permits). Falls back to the parent tour's `included` list
  // when empty. Older departures won't carry this field.
  inclusions?: string[]
  // Optional rate variants for this departure. When present, `pricePerPerson`
  // above is kept in sync with the cheapest package so existing "from" price
  // displays keep working without changes.
  packages?: DeparturePackage[]
  createdAt: string
}

const KIND = 'departure'

export function newDeparturePackageId(): string {
  return newEntityId('pkg')
}

export async function getDepartures(): Promise<Departure[]> {
  return listEntities<Departure>(KIND)
}

export async function addDeparture(dep: Omit<Departure, 'id' | 'createdAt'>): Promise<Departure> {
  const newDep: Departure = { ...dep, id: newEntityId('dep'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, newDep)
}

// Owner-side edit of arbitrary departure fields (guide, notified flag, …).
export async function updateDeparture(id: string, patch: Partial<Departure> & Record<string, unknown>): Promise<void> {
  await updateEntity(KIND, id, patch)
}

// Owner-side edit (supplier adjusting counts on their own departure).
export async function updateDepartureSeats(id: string, bookedSeats: number): Promise<void> {
  const all = await getDepartures()
  const dep = all.find(d => d.id === id)
  if (!dep) return
  const status: Departure['status'] = bookedSeats >= dep.maxSeats ? 'full' : dep.status
  await updateEntity(KIND, id, { bookedSeats, status })
}

// Visitor-side booking: atomic, capacity-checked, executed server-side.
// Throws with a readable message when the departure is full.
export async function bookDepartureSeats(id: string, seats: number): Promise<void> {
  const { error } = await supabase.rpc('vd_book_seats', { p_departure_id: id, p_seats: seats })
  if (error) throw new Error(error.message || 'Could not reserve seats')
}

// Free seats after a cancellation (booking owner or supplier).
export async function releaseDepartureSeats(id: string, seats: number): Promise<void> {
  const { error } = await supabase.rpc('vd_release_seats', { p_departure_id: id, p_seats: seats })
  if (error) throw new Error(error.message || 'Could not release seats')
}

export async function deleteDeparture(id: string): Promise<void> {
  await deleteEntity(KIND, id)
}

export async function deleteDeparturesByTour(tourId: string): Promise<void> {
  const all = await getDepartures()
  await Promise.all(all.filter(d => d.tourId === tourId).map(d => deleteEntity(KIND, d.id)))
}
