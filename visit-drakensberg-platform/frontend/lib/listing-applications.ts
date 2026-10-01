import { supabase } from './auth'
import { requestUploadUrl, putToSignedUrl } from './applicant-upload'

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

/* ── Accreditation and compliance ─────────────────────────────────────────
 *
 * The verification office cannot validate a listing on the applicant's word,
 * so the application carries evidence: either an EDTEA tourism operator
 * registration or CTO membership (one of the two is mandatory — see
 * ACCREDITATION_DOC_TYPES in lib/compliance.ts), plus public liability cover
 * and the registration details that let a reviewer confirm the entity is real.
 *
 * The certificates themselves are NOT stored here. They go into the private
 * `compliance` bucket and are registered in vd_compliance_documents; what the
 * application keeps is the id of that row, so the review queue can find the
 * document without the application blob ever holding a readable path to
 * somebody's registration papers.
 */

export type AccreditationKind = 'edtea' | 'cto'

export const ACCREDITATION_OPTIONS: { id: AccreditationKind; label: string; blurb: string }[] = [
  {
    id: 'edtea',
    label: 'EDTEA operator registration',
    blurb: 'Registered as a tourism operator with KZN Economic Development, Tourism & Environmental Affairs',
  },
  {
    id: 'cto',
    label: 'CTO membership',
    blurb: 'A current member of your local Community Tourism Organisation',
  },
]

export type ComplianceDetails = {
  accreditationKind: AccreditationKind | ''
  accreditationIssuer: string
  accreditationNumber: string
  accreditationExpiry: string
  /** vd_compliance_documents.id — not a storage path. */
  accreditationDocId: string
  accreditationFileName: string

  insurer: string
  insurancePolicyNumber: string
  insuranceExpiry: string
  insuranceDocId: string
  insuranceFileName: string

  companyRegistrationNumber: string
  vatNumber: string
}

export function emptyCompliance(): ComplianceDetails {
  return {
    accreditationKind: '', accreditationIssuer: '', accreditationNumber: '',
    accreditationExpiry: '', accreditationDocId: '', accreditationFileName: '',
    insurer: '', insurancePolicyNumber: '', insuranceExpiry: '',
    insuranceDocId: '', insuranceFileName: '',
    companyRegistrationNumber: '', vatNumber: '',
  }
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

// Trimmed to three stops — Standard, Premium, Signature — rather than the
// six-tier ladder this used to be. Ids for the removed tiers ('enhanced',
// 'priority', 'elite') are still handled gracefully: tierById() falls back to
// Standard for any id it doesn't recognise, so an application already
// recorded against one of them still renders instead of crashing.
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
    id: 'premium', name: 'Premium', rate: 22, elevation: '2 900 m', tagline: 'High plateau',
    benefits: [
      'Homepage features and seasonal campaigns',
      'Curated package inclusion',
      'Dedicated promotional opportunities',
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
  // Accreditation and supporting evidence (see ComplianceDetails)
  compliance: ComplianceDetails
  // Commercial terms the applicant asked for (see COMMISSION_TIERS — a
  // preference, not a binding rate)
  commissionTier: string
  commissionAcknowledged: boolean
  createdAt: string
  /**
   * The supplier account this application was approved into, written by the
   * approval route. Absent until approved — and the reason the review queue
   * can still find the applicant's certificates afterwards, since approval
   * moves them off the application reference and onto the account.
   */
  supplierId?: string
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
    // Applications lodged before accreditation was required carry no
    // compliance block. They read back as an empty one — which the review
    // queue renders as "no accreditation on file", the right answer for a
    // row that genuinely has none.
    compliance: { ...emptyCompliance(), ...(r.compliance ?? {}) },
    commissionTier: r.commissionTier ?? COMMISSION_TIERS[0].id,
    commissionAcknowledged: r.commissionAcknowledged ?? false,
    createdAt: r.createdAt ?? '',
    supplierId: typeof r.supplierId === 'string' ? r.supplierId : undefined,
  }
}

/**
 * Short, sayable handle for the applicant to quote when they follow up.
 *
 * Exported because the reference is needed *before* the application is
 * submitted: accreditation certificates upload into
 * compliance/applications/<reference>/… while the applicant is still filling
 * the form, so the form mints the reference up front and hands it back on
 * submit. Defined in lib/listing-application-intake.ts so the server can mint
 * one too, without importing the browser Supabase client.
 */
export { newApplicationReference } from './listing-application-intake'

/**
 * Lodge an application. Resolves with the stored row so the success screen can
 * show the reference; throws with a readable message if the write is refused.
 *
 * THIS USED TO INSERT DIRECTLY, AND THAT WAS THE HOLE
 *   `supabase.from(TABLE).insert(...)` with the anon key, guarded by nothing
 *   but an RLS clause saying `status = 'new'`. It meant the client chose the
 *   primary key, the timestamp and the whole `value` blob, and — far worse —
 *   that anything able to reach PostgREST could lodge applications without
 *   ever loading this form. In September 2026 something did: 144 applications,
 *   109 of them scripted.
 *
 *   The write now goes through POST /api/listing-applications, which verifies
 *   a Turnstile token, rate limits per caller and per address, and owns the id
 *   and status itself. The table no longer accepts anonymous inserts at all
 *   (20260921_listing_applications_server_only.sql), so this is not a
 *   politeness the caller can decline.
 */
export async function submitListingApplication(
  draft: ListingApplicationDraft,
  /** The reference the form already uploaded compliance documents against. */
  reference?: string,
  /** Turnstile token from the widget on the last step. */
  captchaToken?: string,
): Promise<ListingApplication> {
  const res = await fetch('/api/listing-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      application: { ...draft, reference },
      captchaToken,
    }),
  })

  if (!res.ok) {
    let message = 'Could not submit your application. Please try again.'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch { /* non-JSON error page; keep the generic message */ }
    throw new Error(message)
  }

  const stored = await res.json() as { id: string; reference: string; contactEmail: string }

  // The server owns the id, the reference and the timestamp, so the record
  // handed back to the success screen is built from what it stored — not from
  // what this function hoped it would store.
  return {
    ...draft,
    id: stored.id,
    reference: stored.reference,
    contactEmail: stored.contactEmail,
    status: 'new',
    createdAt: new Date().toISOString(),
  }
}

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024
export const PHOTO_MAX_COUNT = 8

/**
 * Upload one application photo and return its public URL.
 *
 * The write used to go straight to storage with the anon key, under a policy
 * that checked only the first path segment — so anything holding that key
 * could fill the bucket, from anywhere, without loading this form. It now goes
 * through a signed upload URL that the server issues only to a caller holding
 * a valid upload grant, and the server picks the path.
 *
 * The limits below are re-checked server-side; these are here so the applicant
 * finds out before the file leaves their phone.
 */
export async function uploadApplicationPhoto(file: File, reference: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image.`)
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new Error(`${file.name} is larger than ${PHOTO_MAX_BYTES / 1024 / 1024} MB.`)
  }

  const signed = await requestUploadUrl({ kind: 'photo', reference, file })
  await putToSignedUrl('media', signed, file)

  if (!signed.publicUrl) throw new Error('Upload failed.')
  return signed.publicUrl
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
