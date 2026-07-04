import { supabase } from './auth'
import { getBookings, updateBookingStatus, type SavedBooking } from './bookings'
import { notify } from './notifications'

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
  subregions: { id: string; name: string; description: string }[]
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
    subregions: data.subregions || [],
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
  // Column-level grants stop direct is_approved updates; approval goes
  // through the SECURITY DEFINER function which enforces admin-only.
  const { error } = await supabase.rpc('admin_set_supplier_approval', { p_user: id, p_approved: verified })
  if (error) throw error
  await notify(
    id,
    'approval',
    verified ? 'Your supplier account is approved' : 'Your supplier approval was revoked',
    verified
      ? 'You can now publish listings and receive bookings on Visit Drakensberg.'
      : 'Contact support if you believe this is an error.',
    '/supplier',
  )
}

export type AdminStats = {
  totalUsers: number
  totalSuppliers: number
  pendingSuppliers: number
  totalListings: number
  totalBookings: number
  cancelledBookings: number
  totalRevenue: number
}

const LISTING_KINDS = ['property', 'activity', 'tour']

export async function getAdminStats(): Promise<AdminStats> {
  const [users, suppliers, pending, listings, bookings] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'supplier'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'supplier').eq('is_approved', false),
    supabase.from('vd_entities').select('id', { count: 'exact', head: true }).in('kind', LISTING_KINDS),
    supabase.from('vd_bookings').select('status, value'),
  ])
  const rows = (bookings.data ?? []) as { status: string; value: { total?: number } }[]
  return {
    totalUsers: users.count ?? 0,
    totalSuppliers: suppliers.count ?? 0,
    pendingSuppliers: pending.count ?? 0,
    totalListings: listings.count ?? 0,
    totalBookings: rows.length,
    cancelledBookings: rows.filter(b => b.status === 'cancelled').length,
    totalRevenue: rows.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (b.value?.total ?? 0), 0),
  }
}

export type AdminListing = {
  id: string
  kind: string
  name: string
  region: string
  supplierId: string | null
  supplierName: string
  status: string
  createdAt: string
}

export async function getAdminListings(): Promise<AdminListing[]> {
  const { data, error } = await supabase
    .from('vd_entities')
    .select('id, kind, owner_id, status, value, created_at')
    .in('kind', LISTING_KINDS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    kind: row.kind,
    name: row.value?.name ?? row.id,
    region: row.value?.region ?? row.value?.trailName ?? '—',
    supplierId: row.owner_id,
    supplierName: row.value?.supplierName ?? '—',
    status: row.status,
    createdAt: row.created_at,
  }))
}

export async function setAdminListingStatus(kind: string, id: string, status: string): Promise<void> {
  const { data } = await supabase.from('vd_entities').select('value').eq('kind', kind).eq('id', id).maybeSingle()
  if (!data) return
  const value = { ...(data.value as object), status }
  const { error } = await supabase.from('vd_entities').update({ status, value, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteAdminListing(kind: string, id: string): Promise<void> {
  const { error } = await supabase.from('vd_entities').delete().eq('kind', kind).eq('id', id)
  if (error) throw error
}

export async function getAdminBookings(): Promise<SavedBooking[]> {
  return getBookings()
}

export async function setAdminBookingStatus(id: string, status: SavedBooking['status']): Promise<void> {
  await updateBookingStatus(id, status, { notifyUser: true, notifySuppliers: true })
}
