import { supabase } from './auth'

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
  createdAt: string
}

export async function getDepartures(): Promise<Departure[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'departures')
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) {
      return data.value.items as Departure[]
    }
  } catch {
    // fall through
  }
  return []
}

export async function saveDepartures(departures: Departure[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'departures', value: { items: departures }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

export async function addDeparture(dep: Omit<Departure, 'id' | 'createdAt'>): Promise<Departure> {
  const all = await getDepartures()
  const newDep: Departure = {
    ...dep,
    id: `dep-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  await saveDepartures([...all, newDep])
  return newDep
}

export async function updateDepartureSeats(id: string, bookedSeats: number): Promise<void> {
  const all = await getDepartures()
  const dep = all.find(d => d.id === id)
  if (!dep) return
  const status: Departure['status'] = bookedSeats >= dep.maxSeats ? 'full' : dep.status
  await saveDepartures(all.map(d => d.id === id ? { ...d, bookedSeats, status } : d))
}

export async function deleteDeparture(id: string): Promise<void> {
  const all = await getDepartures()
  await saveDepartures(all.filter(d => d.id !== id))
}
