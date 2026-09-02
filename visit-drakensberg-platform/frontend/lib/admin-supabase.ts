import { supabase } from './auth'
import { getBookings, updateBookingStatus, type SavedBooking } from './bookings'
import { notify } from './notifications'

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
  const { data, error } = await supabase.from('site_content').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  if (Array.isArray(data?.value?.items)) return data.value.items as T[]
  return []
}

async function saveCollection<T>(key: string, items: T[]): Promise<void> {
  const { error } = await supabase.from('site_content').upsert(
    { key, value: { items }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  // Surface RLS/auth/network failures — swallowing them made the UI report
  // "Saved" while nothing was persisted.
  if (error) throw error
}

// Region CRUD lives in lib/regions.ts (getRegions/saveAllRegions/
// createRegion/updateRegion/deleteRegion) — the same module the public
// site reads from, exactly like lib/reserves.ts and lib/towns.ts already
// do for their own admin consoles. A parallel AdminRegion type/getCollection
// path used to live here, writing regions with no `slug` field at all;
// normalizeRegion() on the read side then re-derived a slug from `name` on
// every single read, so a rename silently changed the canonical URL and any
// existing link to it. See docs/destination-graph/PHASE_G.md.

export async function getAdminMedia(): Promise<AdminMedia[]> {
  return getCollection<AdminMedia>('admin_media')
}

export async function createAdminMedia(data: Omit<AdminMedia, 'id' | 'uploaded' | 'createdAt'>): Promise<AdminMedia> {
  const all = await getAdminMedia()
  const item: AdminMedia = { ...data, id: `media-${Date.now()}`, uploaded: new Date().toISOString(), createdAt: new Date().toISOString() }
  await saveCollection('admin_media', [...all, item])
  return item
}

function imageDimensions(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.resolve('—')
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve(`${img.naturalWidth}×${img.naturalHeight}`); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve('—'); URL.revokeObjectURL(url) }
    img.src = url
  })
}

// Mirrors the `media` bucket's own allowed_mime_types / file_size_limit
// (supabase/migrations/20260719_media_storage.sql). Checking here as well is
// not redundant: the bucket rejects a 60 MB file only after it has been
// uploaded, and returns a generic error when it does.
const MEDIA_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf',
]
const MEDIA_SIZE_LIMIT = 50 * 1024 * 1024

/** Rejects a file the storage bucket would reject anyway, but early and with
 *  a message that says which rule it broke. Returns null when the file is
 *  acceptable. */
export function validateMediaFile(file: File): string | null {
  if (file.size > MEDIA_SIZE_LIMIT) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 50 MB.`
  }
  if (file.size === 0) return `${file.name} is empty.`
  if (file.type && !MEDIA_MIME_TYPES.includes(file.type)) {
    return `${file.type} files are not accepted. Use PNG, WebP, JPEG, GIF, SVG, AVIF, MP4, WebM, MOV or PDF.`
  }
  return null
}

export async function uploadAdminMedia(file: File): Promise<AdminMedia> {
  const invalid = validateMediaFile(file)
  if (invalid) throw new Error(invalid)

  // Safe name: the original filename is kept only as a display label. The
  // storage key is generated, so a file called "../../x .png" cannot steer
  // the upload path or collide with someone else's object.
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '31536000',
  })
  if (error) {
    const message = String((error as any)?.message || '')
    if (/bucket.*not.*found/i.test(message)) {
      throw new Error('Storage bucket "media" does not exist. Run supabase/migrations/20260719_media_storage.sql in the Supabase SQL editor.')
    }
    throw new Error(message || 'Upload failed')
  }
  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return createAdminMedia({
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    url: data.publicUrl,
    size: file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
    dimensions: await imageDimensions(file),
    used_in: [],
  })
}

export async function deleteAdminMedia(id: string): Promise<void> {
  const all = await getAdminMedia()
  const item = all.find(m => m.id === id)
  await saveCollection('admin_media', all.filter(m => m.id !== id))
  // Best-effort removal of the underlying storage object for our own uploads.
  const marker = '/storage/v1/object/public/media/'
  if (item?.url.includes(marker)) {
    const path = decodeURIComponent(item.url.split(marker)[1] ?? '')
    if (path) await supabase.storage.from('media').remove([path]).catch(() => {})
  }
}

export const adminMediaSource = { list: getAdminMedia, upload: uploadAdminMedia }

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
  /** Properties only — 'request' diverts the stay to request-to-book (see
   *  lib/stay-requests.ts). Absent/'instant' books and charges straight
   *  through checkout, which is what every listing does by default. */
  bookingMode: 'instant' | 'request'
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
    bookingMode: row.value?.bookingMode === 'request' ? 'request' : 'instant',
    createdAt: row.created_at,
  }))
}

/**
 * Switch a property between instant booking and request-to-book.
 *
 * Deliberately admin/ops-only (RLS on vd_entities admits admins; a supplier
 * editing their own property has no field for this): whether a stay sells
 * instantly is a commercial decision about the property, not a preference its
 * operator can flip unilaterally — otherwise instant booking quietly erodes
 * across the marketplace one property at a time.
 */
export async function setAdminListingBookingMode(
  id: string,
  bookingMode: 'instant' | 'request',
): Promise<void> {
  const { data } = await supabase.from('vd_entities').select('value').eq('kind', 'property').eq('id', id).maybeSingle()
  if (!data) return
  const value = { ...(data.value as object), bookingMode }
  const { error } = await supabase
    .from('vd_entities')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('kind', 'property')
    .eq('id', id)
  if (error) throw error
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
