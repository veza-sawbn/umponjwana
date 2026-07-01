import { supabase } from './auth'

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

async function getAll(): Promise<Activity[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'activities')
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) {
      return data.value.items as Activity[]
    }
  } catch {}
  return []
}

async function saveAll(items: Activity[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'activities', value: { items }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

export async function getActivities(): Promise<Activity[]> {
  return getAll()
}

export async function getActivitiesBySupplier(supplierId: string): Promise<Activity[]> {
  const all = await getAll()
  return all.filter(a => a.supplierId === supplierId)
}

export async function getActivityById(id: string): Promise<Activity | null> {
  const all = await getAll()
  return all.find(a => a.id === id) ?? null
}

export async function addActivity(a: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
  const all = await getAll()
  const now = new Date().toISOString()
  const activity: Activity = { ...a, id: `act-${Date.now()}`, createdAt: now }
  await saveAll([...all, activity])
  return activity
}

export async function updateActivity(id: string, patch: Partial<Activity>): Promise<void> {
  const all = await getAll()
  await saveAll(all.map(a => a.id === id ? { ...a, ...patch } : a))
}

export async function deleteActivity(id: string): Promise<void> {
  const all = await getAll()
  await saveAll(all.filter(a => a.id !== id))
}
