import { supabase } from './auth'

// Public "list with us" applications (see
// supabase/migrations/20260807_listing_applications.sql).
//
// An application is a lead, not a listing. Anyone — signed in or not — may
// lodge one; nobody but an admin can read one back. Approving an application
// is a human step that ends with a real supplier account and a vd_entities
// row, so nothing written here can reach the public catalog on its own.
//
// The journey covers every supplier type the platform runs, not just stays:
// an applicant says what they operate, and answers a short block per type.
// Deliberately short — the supplier portal already has a full wizard for each
// type, so this only has to carry what a reviewer needs to say yes or no.
// What ends up in profiles.supplier_type is the comma-joined list of the
// types chosen here (see lib/supplier-context.tsx, which parses it back).

export type ApplicationActivity = {
  name: string
  category: string
  difficulty: string
  durationHours: string
  maxGroup: string
  minAge: string
  pricePerPerson: string
  included: string[]
  description: string
}

export function emptyActivity(): ApplicationActivity {
  return {
    name: '', category: '', difficulty: 'Moderate',
    durationHours: '', maxGroup: '', minAge: '', pricePerPerson: '',
    included: [], description: '',
  }
}

/* ── Supplier types ──────────────────────────────────────────────────────── */

// Mirrors SupplierType in lib/supplier-config.ts. Kept as plain strings here
// because an application is data, not a live supplier — but the values must
// match exactly, since approval joins them into profiles.supplier_type.
export const APPLICANT_TYPES = [
  {
    id: 'Accommodation',
    label: 'Somewhere to stay',
    blurb: 'Lodge, guesthouse, hotel, cottage or campsite',
  },
  {
    id: 'Activity',
    label: 'Activities',
    blurb: 'Abseiling, zip-line, horseback, guided day walks',
  },
  {
    id: 'Guided Tours',
    label: 'Guided tours',
    blurb: 'Multi-day hikes, summit attempts, cultural tours',
  },
  {
    id: 'Shuttle',
    label: 'Transport',
    blurb: 'Airport runs, trailhead drops, 4×4 transfers',
  },
  {
    id: 'Experience',
    label: 'Experiences',
    blurb: 'Photography workshops, stargazing, wellness retreats',
  },
] as const

export type ApplicantTypeId = (typeof APPLICANT_TYPES)[number]['id']

/* ── Per-type detail. Enough for a reviewer to decide; the portal wizard
      collects the rest once the account exists. ─────────────────────────── */

export type StayDetails = {
  propertyName: string
  propertyType: string
  elevation: string
  amenities: string[]
  roomCount: string
}

export type TourDetails = {
  tourStyle: string
  typicalDurationDays: string
  guideCount: string
  certifications: string
}

export type ShuttleDetails = {
  fleetSize: string
  vehicleTypes: string[]
  routesServed: string
  operatingLicence: string
}

export type ExperienceDetails = {
  experienceStyle: string
  typicalGroupSize: string
  durationHours: string
  setting: string
}

export const STAY_ROOM_BANDS = ['1–5', '6–15', '16–40', '40+']
export const TOUR_STYLES = ['Day hikes', 'Multi-day trekking', 'Summit attempts', 'Cultural & heritage', 'Wildlife & birding']
export const VEHICLE_TYPES = ['Sedan', 'Minibus (≤14)', 'Coach (15+)', '4×4', 'Trailer / luggage']
export const EXPERIENCE_SETTINGS = ['Outdoors', 'Indoors', 'Both']

export function emptyStay(): StayDetails {
  return { propertyName: '', propertyType: '', elevation: '', amenities: [], roomCount: '' }
}
export function emptyTour(): TourDetails {
  return { tourStyle: '', typicalDurationDays: '', guideCount: '', certifications: '' }
}
export function emptyShuttle(): ShuttleDetails {
  return { fleetSize: '', vehicleTypes: [], routesServed: '', operatingLicence: '' }
}
export function emptyExperience(): ExperienceDetails {
  return { experienceStyle: '', typicalGroupSize: '', durationHours: '', setting: '' }
}

/**
 * Commission ladder offered on the application.
 *
 * `rate` is the TOTAL platform fee on a booking, not a surcharge on top of a
 * base rate — Standard's 12% is the whole of it (10% booking + 2% payment
 * handling), and it mirrors the seeded `default_commission_rate` in
 * vd_finance_settings. Keep the two in sync: change one and the other has to
 * move with it, or an applicant is quoted a rate the ledger will not use.
 *
 * Every tier above the floor buys *eligibility* for placement and promotion —
 * never a guaranteed ranking or booking. Say it that way in any copy that
 * describes them.
 *
 * What an applicant picks here is a preference recorded on the application.
 * It binds nothing on its own: commission is enforced server-side from
 * vd_supplier_terms, which only an admin can write, and that happens when an
 * application is approved.
 */
export type CommissionTier = {
  id: string
  name: string
  rate: number          // whole percent
  elevation: string
  tagline: string
  benefits: string[]
  isFloor?: boolean
}

export const COMMISSION_TIERS: CommissionTier[] = [
  {
    id: 'standard', name: 'Standard', rate: 12, elevation: '1 200 m', tagline: 'Base camp',
    isFloor: true,
    benefits: [
      'Standard listing and normal search visibility',
      'Includes 10% booking commission + 2% payment handling',
    ],
  },
  {
    id: 'enhanced', name: 'Enhanced', rate: 15, elevation: '1 800 m', tagline: 'Tree line',
    benefits: [
      'Improved placement in relevant search results',
      'Eligible for selected campaigns and newsletters',
      'Increased promotional exposure',
    ],
  },
  {
    id: 'priority', name: 'Priority', rate: 18, elevation: '2 400 m', tagline: 'Escarpment',
    benefits: [
      'Priority ranking within category and region',
      'Inclusion in featured accommodation sections',
      'Greater access to promotional campaigns',
    ],
  },
  {
    id: 'premium', name: 'Premium', rate: 22, elevation: '2 900 m', tagline: 'High plateau',
    benefits: [
      'Homepage features and seasonal campaigns',
      'Curated package inclusion',
      'Dedicated promotional opportunities',
    ],
  },
  {
    id: 'elite', name: 'Elite', rate: 26, elevation: '3 200 m', tagline: 'Alpine zone',
    benefits: [
      'Top-of-category placement',
      'Cross-platform promotion (social, newsletter takeovers)',
      'Priority tie-break against lower tiers',
    ],
  },
  {
    id: 'signature', name: 'Signature', rate: 30, elevation: '3 482 m', tagline: 'Summit',
    benefits: [
      'First look at new marketing initiatives',
      'Dedicated account support',
      'Maximum promotional allocation',
    ],
  },
]

export const COMMISSION_MIN_RATE = COMMISSION_TIERS[0].rate
export const COMMISSION_MAX_RATE = COMMISSION_TIERS[COMMISSION_TIERS.length - 1].rate

export function tierById(id: string): CommissionTier {
  return COMMISSION_TIERS.find(t => t.id === id) ?? COMMISSION_TIERS[0]
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
  // What they operate — one or more of APPLICANT_TYPES. Joined with commas
  // into profiles.supplier_type on approval.
  supplierTypes: string[]
  // Shared across every type
  tradingName: string
  region: string
  baseTown: string
  description: string
  photos: string[]
  // Per-type blocks. Each is present in the record whatever the applicant
  // picked — the ones for unselected types simply stay empty, which keeps the
  // shape stable for anything reading an application back.
  stay: StayDetails
  tour: TourDetails
  shuttle: ShuttleDetails
  experience: ExperienceDetails
  // Activities: the Activity type's own list, and also what a stay or tour
  // operator adds when they run guided activities alongside the main offering.
  offersActivities: boolean
  activities: ApplicationActivity[]
  // Commercial terms the applicant asked for (see COMMISSION_TIERS — a
  // preference, not a binding rate)
  commissionTier: string
  commissionAcknowledged: boolean
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

const TABLE = 'vd_listing_applications'

/**
 * Coerce a stored `value` blob into the current ListingApplication shape.
 *
 * The journey used to be stays-only: no supplierTypes, no per-type blocks,
 * and activities carried only name/difficulty. A row submitted before the
 * multi-type reconstruction — there is a real one in production, reference
 * LP-TYM4AV — has none of those fields, and every reader added since
 * (the review queue, the admin dashboard widget, the approval route) assumes
 * they exist. Reading that row without this would throw on
 * `supplierTypes.includes(...)` and, worse, silently approve the applicant
 * with an empty supplier_type since nothing would infer 'Accommodation' from
 * the old-shape fields it does carry.
 *
 * Every reader of a stored application — client or server — should go through
 * this rather than casting `value` directly.
 */
export function normalizeListingApplication(raw: Record<string, unknown>): Omit<ListingApplication, 'status'> {
  const r = raw as Partial<ListingApplication> & {
    propertyName?: string; propertyType?: string; elevation?: string; amenities?: string[]
  }
  const looksLikeOldStay = !r.supplierTypes && Boolean(r.propertyName || r.propertyType || r.amenities?.length)
  const supplierTypes = Array.isArray(r.supplierTypes) && r.supplierTypes.length > 0
    ? r.supplierTypes
    : looksLikeOldStay ? ['Accommodation'] : []

  const stay: StayDetails = r.stay ?? {
    propertyName: r.propertyName ?? '',
    propertyType: r.propertyType ?? '',
    elevation: r.elevation ?? '',
    amenities: r.amenities ?? [],
    roomCount: '',
  }

  const activities = Array.isArray(r.activities)
    ? r.activities.map(a => ({ ...emptyActivity(), ...a }))
    : []

  return {
    id: String(r.id ?? ''),
    reference: String(r.reference ?? ''),
    contactName: r.contactName ?? '',
    contactEmail: r.contactEmail ?? '',
    contactPhone: r.contactPhone ?? '',
    businessName: r.businessName ?? '',
    contactRole: r.contactRole ?? '',
    supplierTypes,
    tradingName: r.tradingName ?? '',
    region: r.region ?? '',
    baseTown: r.baseTown ?? '',
    description: r.description ?? '',
    photos: Array.isArray(r.photos) ? r.photos : [],
    stay,
    tour: r.tour ?? emptyTour(),
    shuttle: r.shuttle ?? emptyShuttle(),
    experience: r.experience ?? emptyExperience(),
    offersActivities: r.offersActivities ?? activities.length > 0,
    activities,
    commissionTier: r.commissionTier ?? COMMISSION_TIERS[0].id,
    commissionAcknowledged: r.commissionAcknowledged ?? false,
    createdAt: r.createdAt ?? '',
  }
}

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

  const row = {
    id: application.id,
    reference: application.reference,
    status: application.status,
    // The mirrored name is whatever the applicant calls the thing they are
    // listing: a stay has a property name, everyone else is known by their
    // trading name.
    property_name: application.stay.propertyName || application.tradingName,
    contact_email: application.contactEmail,
    region: application.region,
    value: application,
  }

  // commission_tier is a mirror of value->>'commissionTier', added by a later
  // migration than the table itself. Deploys and migrations do not land in
  // lockstep, so a build carrying the tier can reach a database that has not
  // run 20260808 yet — and this form is live with real applicants. Mirror it
  // when the column is there, and fall back to the JSON-only row when it is
  // not, rather than losing the application over a column that only helps the
  // review queue sort.
  let { error } = await supabase.from(TABLE).insert({ ...row, commission_tier: application.commissionTier })
  if (error && isMissingColumn(error.message, 'commission_tier')) {
    ({ error } = await supabase.from(TABLE).insert(row))
  }

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

/** PostgREST reports an unknown column either from its schema cache or straight from Postgres. */
function isMissingColumn(message: string | undefined, column: string): boolean {
  const m = String(message || '')
  return m.includes(column) && /could not find|does not exist|schema cache/i.test(m)
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
      ...normalizeListingApplication(row.value as Record<string, unknown>),
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
