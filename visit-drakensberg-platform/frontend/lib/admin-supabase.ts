import { supabase } from './auth'
import { getBookings, updateBookingStatus, type SavedBooking } from './bookings'

export type AdminRegion = {
  id: string
  name: string
  tagline: string
  heroImage: string
  heroVideo: string
  overview: string
  highlights: string[]
  gettingThere: string
  bestTime: string
  keyAttractions: { id: string; name: string; description: string }[]
  seoTitle: string
  seoDescription: string
  createdAt?: string
  updatedAt?: string
}

export type AdminMedia = {
  id: string
  type: 'image' | 'video'
  name: string
  url: string
  size: string
  dimensions: string
  used_in: string[]
  uploaded: string
  createdAt?: string
}

export type AdminSupplier = {
  id: string
  business_name: string
  description: string
  website?: string | null
  is_verified: boolean
  created_at: string
  email?: string | null
  role?: string | null
}

async function getCollection<T>(key: string): Promise<T[]> {
  try {
    const { data } = await supabase.from('site_content').select('value').eq('key', key).maybeSingle()
    if (Array.isArray(data?.value?.items)) return data.value.items as T[]
  } catch {}
  return []
}

async function saveCollection<T>(key: string, items: T[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key, value: { items }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

export async function getAdminRegions(): Promise<AdminRegion[]> {
  return getCollection<AdminRegion>('admin_regions')
}

export async function createAdminRegion(data: Omit<AdminRegion, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminRegion> {
  const all = await getAdminRegions()
  const now = new Date().toISOString()
  const item: AdminRegion = {
    ...data,
    id: `region-${Date.now()}`,
    seoTitle: data.seoTitle || `${data.name} | Visit Drakensberg`,
    createdAt: now,
    updatedAt: now,
  }
  await saveCollection('admin_regions', [...all, item])
  return item
}

export async function updateAdminRegion(id: string, data: Omit<AdminRegion, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminRegion> {
  const all = await getAdminRegions()
  const previous = all.find(item => item.id === id)
  const updated: AdminRegion = { ...data, id, createdAt: previous?.createdAt, updatedAt: new Date().toISOString() }
  await saveCollection('admin_regions', all.map(item => item.id === id ? updated : item))
  return updated
}

export async function deleteAdminRegion(id: string): Promise<void> {
  const all = await getAdminRegions()
  await saveCollection('admin_regions', all.filter(item => item.id !== id))
}

export async function getAdminMedia(): Promise<AdminMedia[]> {
  return getCollection<AdminMedia>('admin_media')
}

export async function createAdminMedia(data: Omit<AdminMedia, 'id' | 'uploaded' | 'createdAt'>): Promise<AdminMedia> {
  const all = await getAdminMedia()
  const item: AdminMedia = { ...data, id: `media-${Date.now()}`, uploaded: new Date().toISOString(), createdAt: new Date().toISOString() }
  await saveCollection('admin_media', [...all, item])
  return item
}

export async function uploadAdminMedia(file: File): Promise<AdminMedia> {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return createAdminMedia({
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    url: data.publicUrl,
    size: file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
    dimensions: 'Unknown',
    used_in: [],
  })
}

export async function deleteAdminMedia(id: string): Promise<void> {
  const all = await getAdminMedia()
  await saveCollection('admin_media', all.filter(item => item.id !== id))
}

export async function getAdminSuppliers(): Promise<AdminSupplier[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, bio, is_approved, role, created_at')
    .eq('role', 'supplier')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((profile: any) => ({
    id: profile.id,
    business_name: profile.full_name || profile.email || 'Unnamed supplier',
    description: profile.bio || 'No supplier description provided yet.',
    website: null,
    is_verified: Boolean(profile.is_approved),
    created_at: profile.created_at,
    email: profile.email,
    role: profile.role,
  }))
}

export async function setAdminSupplierVerified(id: string, verified: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_approved: verified, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function getAdminBookings(): Promise<SavedBooking[]> {
  return getBookings()
}

export async function setAdminBookingStatus(id: string, status: SavedBooking['status']): Promise<void> {
  await updateBookingStatus(id, status)
}
