import { supabase } from './auth'

// Public "List your property" applications (see
// supabase/migrations/20260807_listing_applications.sql).
//
// An application is a lead, not a listing. Anyone — signed in or not — may
// lodge one; nobody but an admin can read one back. Approving an application
// is a human step that ends with a real supplier account and a vd_entities
// property row, so nothing written here can reach the public catalog on its
// own.

export type ApplicationActivity = {
  name: string
  difficulty: 'Easy' | 'Moderate' | 'Strenuous'
}

export type ListingApplicationStatus = 'new' | 'in_review' | 'approved' | 'declined'

export type ListingApplication = {
  id: string
  reference: string
  status: ListingApplicationStatus
  // Who is applying
  contactName: string
  contactEmail: string
  contactPhone: string
  businessName: string
  contactRole: string
  // What they are listing
  propertyName: string
  propertyType: string
  region: string
  elevation: string
  description: string
  amenities: string[]
  photos: string[]
  // Activities they run themselves
  offersActivities: boolean
  activities: ApplicationActivity[]
  createdAt: string
}

export type ListingApplicationDraft = Omit<
  ListingApplication,
  'id' | 'reference' | 'status' | 'createdAt'
>

export const APPLICATION_STATUS_LABELS: Record<ListingApplicationStatus, string> = {
  new: 'New',
  in_review: 'In review',
  approved: 'Approved',
  declined: 'Declined',
}

export const ACTIVITY_DIFFICULTIES: ApplicationActivity['difficulty'][] = ['Easy', 'Moderate', 'Strenuous']

const TABLE = 'vd_listing_applications'

/** Short, sayable handle for the applicant to quote when they follow up. */
function newReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1
  let tail = ''
  for (let i = 0; i < 6; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `LP-${tail}`
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `lapp-${crypto.randomUUID()}`
    : `lapp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Lodge an application. Resolves with the stored row so the success screen can
 * show the reference; throws with a readable message if the write is refused
 * (most often because the migration has not been run yet).
 */
export async function submitListingApplication(draft: ListingApplicationDraft): Promise<ListingApplication> {
  const application: ListingApplication = {
    ...draft,
    id: newId(),
    reference: newReference(),
    status: 'new',
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from(TABLE).insert({
    id: application.id,
    reference: application.reference,
    status: application.status,
    property_name: application.propertyName,
    contact_email: application.contactEmail,
    region: application.region,
    value: application,
  })

  if (error) {
    const message = String(error.message || '')
    if (/relation .* does not exist|could not find the table/i.test(message)) {
      throw new Error(
        'Listing applications are not set up yet. Run supabase/migrations/20260807_listing_applications.sql in the Supabase SQL editor.',
      )
    }
    throw new Error(message || 'Could not submit your application. Please try again.')
  }

  return application
}

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024
export const PHOTO_MAX_COUNT = 8

/**
 * Upload one application photo to media/listing-applications/… and return its
 * public URL. Open to anonymous applicants by design — see the storage policy
 * in 20260807_listing_applications.sql for what that does and does not allow.
 */
export async function uploadApplicationPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image.`)
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new Error(`${file.name} is larger than ${PHOTO_MAX_BYTES / 1024 / 1024} MB.`)
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `listing-applications/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '31536000',
  })
  if (error) {
    const message = String((error as { message?: string })?.message || '')
    if (/row-level security|not authoriz/i.test(message)) {
      throw new Error(
        'Photo uploads aren’t enabled yet. Run supabase/migrations/20260807_listing_applications.sql in the Supabase SQL editor.',
      )
    }
    if (/bucket.*not.*found/i.test(message)) {
      throw new Error('Storage bucket "media" does not exist. Run supabase/migrations/20260719_media_storage.sql first.')
    }
    throw new Error(message || 'Upload failed.')
  }
  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return data.publicUrl
}

type Row = { value: Record<string, unknown>; status: string; created_at: string }

/** Admin-only: every application, newest first. Non-admins get an empty list. */
export async function getListingApplications(): Promise<ListingApplication[]> {
  try {
    const { data } = await supabase
      .from(TABLE)
      .select('value, status, created_at')
      .order('created_at', { ascending: false })
    if (!Array.isArray(data)) return []
    return (data as Row[]).map(row => ({
      ...(row.value as unknown as ListingApplication),
      status: row.status as ListingApplicationStatus,
    }))
  } catch {
    return []
  }
}

/** Admin-only: move an application through the review queue. */
export async function setListingApplicationStatus(
  id: string,
  status: ListingApplicationStatus,
): Promise<void> {
  const { data } = await supabase.from(TABLE).select('value').eq('id', id).maybeSingle()
  if (!data) return
  const value = { ...(data.value as object), status }
  const { error } = await supabase
    .from(TABLE)
    .update({ status, value, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
