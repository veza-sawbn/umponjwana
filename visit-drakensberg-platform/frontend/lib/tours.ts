import { supabase } from './auth'
import { getDepartures, saveDepartures } from './departures'

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

export async function getTours(): Promise<Tour[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'tours')
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) {
      return data.value.items as Tour[]
    }
  } catch {
    // fall through
  }
  return []
}

export async function saveTours(tours: Tour[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'tours', value: { items: tours }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

export async function addTour(tour: Omit<Tour, 'id' | 'createdAt'>): Promise<Tour> {
  const all = await getTours()
  const newTour: Tour = {
    ...tour,
    id: `tour-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  await saveTours([...all, newTour])
  return newTour
}

export async function updateTour(id: string, patch: Partial<Tour>): Promise<void> {
  const all = await getTours()
  await saveTours(all.map(t => t.id === id ? { ...t, ...patch } : t))
}

export async function deleteTour(id: string): Promise<void> {
  const [all, departures] = await Promise.all([getTours(), getDepartures()])
  await Promise.all([
    saveTours(all.filter(t => t.id !== id)),
    saveDepartures(departures.filter(d => d.tourId !== id)),
  ])
}
