import { supabase } from './auth'
import { getEffectiveSupplierId, effectiveSupplierId } from './effective-supplier'
import { listEntities, insertEntity, deleteEntity, newEntityId, listEntitiesByOwner } from './entities'

// A supplier's own uploaded media — real Supabase Storage files (bucket
// `media`, path supplier/{uid}/...), indexed as vd_entities rows so RLS
// ("Owners read/write own", "Admins read all") scopes each supplier to only
// their own library with zero extra policy work. status='private' keeps
// these out of the public-entity feed (which only surfaces
// active/open/confirmed/full rows) — nobody but the owner and admins can
// browse a supplier's uploads.

export type MediaItem = {
  id: string
  supplierId: string
  type: 'image' | 'video'
  name: string
  url: string
  size: string
  dimensions: string
  createdAt: string
  status?: string
}

const KIND = 'media'

export async function getMyMedia(): Promise<MediaItem[]> {
  // Owner-scoped at the database: filtering listEntities() in JS would ship
  // every supplier's media library to the browser. Resolves to the managed
  // supplier when an operations employee is acting on one's behalf.
  const ownerId = await getEffectiveSupplierId()
  if (!ownerId) return []
  const mine = await listEntitiesByOwner<MediaItem>(KIND, ownerId)
  return mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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

export async function uploadMedia(file: File): Promise<MediaItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to upload media.')
  // The media belongs to the SUPPLIER, not whoever is uploading it. When an
  // operations employee is acting-as a managed supplier, this resolves to
  // the supplier's own id — uploading under the raw signed-in user id would
  // both misattribute the file (the supplier would never see it in their own
  // library) and fail RLS, since the storage policies check the folder
  // segment against a supplier the caller is authorised for, not against
  // whichever id happens to be in the path.
  const ownerId = effectiveSupplierId(user.id)
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `supplier/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '31536000',
  })
  if (error) {
    const message = String((error as { message?: string })?.message || '')
    if (/bucket.*not.*found/i.test(message)) {
      throw new Error('Storage bucket "media" does not exist. Run supabase/migrations/20260719_media_storage.sql in the Supabase SQL editor.')
    }
    if (/row-level security|not authoriz/i.test(message)) {
      throw new Error('Uploads aren’t enabled for your account yet. Run supabase/migrations/20260726_supplier_media.sql and 20260820_ops_delete_and_managed_media.sql in the Supabase SQL editor.')
    }
    throw new Error(message || 'Upload failed')
  }
  const { data } = supabase.storage.from('media').getPublicUrl(path)
  const item: MediaItem = {
    id: newEntityId('media'),
    supplierId: ownerId,
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    url: data.publicUrl,
    size: file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
    dimensions: await imageDimensions(file),
    createdAt: new Date().toISOString(),
    status: 'private',
  }
  return insertEntity(KIND, item)
}

export async function deleteMedia(id: string, url: string): Promise<void> {
  await deleteEntity(KIND, id)
  const marker = '/storage/v1/object/public/media/'
  if (url.includes(marker)) {
    const path = decodeURIComponent(url.split(marker)[1] ?? '')
    if (path) await supabase.storage.from('media').remove([path]).catch(() => {})
  }
}

export const supplierMediaSource = { list: getMyMedia, upload: uploadMedia }
