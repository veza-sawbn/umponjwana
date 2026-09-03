import { supabase } from './auth'

// Supplier compliance documents (see
// supabase/migrations/20260905_supplier_compliance.sql).
//
// The verification office validates every listing against evidence, and the
// gating piece is accreditation: an operator is listable only once we hold
// either an up-to-date EDTEA tourism operator registration certificate or
// proof of membership of a Community Tourism Organisation. Both are PDFs,
// both expire, and both carry business detail that must not be public — so
// they live in the private `compliance` bucket and are read through signed
// URLs, never a CDN path.
//
// Everything else here (insurance, CIPC, guide registration, fire clearance)
// is supporting evidence: captured, reviewed and expiry-tracked the same way,
// but not on its own a reason to refuse a listing.

export type ComplianceDocType =
  | 'edtea_registration'
  | 'cto_membership'
  | 'public_liability_insurance'
  | 'company_registration'
  | 'tax_clearance'
  | 'guide_registration'
  | 'fire_compliance'
  | 'other'

export type ComplianceReviewStatus = 'pending' | 'verified' | 'rejected'

export type ComplianceDocument = {
  id: string
  supplierId: string | null
  applicationRef: string | null
  docType: ComplianceDocType
  issuer: string
  referenceNumber: string
  issuedOn: string | null
  expiresOn: string | null
  storagePath: string
  fileName: string
  mimeType: string
  byteSize: number
  reviewStatus: ComplianceReviewStatus
  reviewNote: string
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

type DocTypeSpec = {
  label: string
  /** What the reviewer is looking at, in the reviewer's language. */
  hint: string
  /** Shown on the applicant-facing upload control. */
  applicantHint: string
  issuerLabel: string
  referenceLabel: string
  /** Whether an expiry date is expected. Undated CTO letters exist, hence the flag. */
  expectsExpiry: boolean
}

export const DOC_TYPES: Record<ComplianceDocType, DocTypeSpec> = {
  edtea_registration: {
    label: 'EDTEA operator registration',
    hint: 'KZN Department of Economic Development, Tourism and Environmental Affairs — tourism operator registration certificate.',
    applicantHint: 'Your current registration certificate from KZN EDTEA, as a PDF.',
    issuerLabel: 'Issuing office',
    referenceLabel: 'Registration number',
    expectsExpiry: true,
  },
  cto_membership: {
    label: 'CTO membership',
    hint: 'Proof of current membership of a Community Tourism Organisation (e.g. Central Drakensberg, Northern Drakensberg, Southern Drakensberg CTO).',
    applicantHint: 'Your current CTO membership certificate or letter, as a PDF.',
    issuerLabel: 'Community Tourism Organisation',
    referenceLabel: 'Membership number',
    expectsExpiry: true,
  },
  public_liability_insurance: {
    label: 'Public liability insurance',
    hint: 'Schedule or certificate of currency showing the insured party, cover amount and period.',
    applicantHint: 'Your public liability schedule or certificate of currency.',
    issuerLabel: 'Insurer',
    referenceLabel: 'Policy number',
    expectsExpiry: true,
  },
  company_registration: {
    label: 'Company registration (CIPC)',
    hint: 'CIPC registration certificate for the trading entity.',
    applicantHint: 'Your CIPC registration certificate, if you trade as a company or close corporation.',
    issuerLabel: 'Registrar',
    referenceLabel: 'Registration number',
    expectsExpiry: false,
  },
  tax_clearance: {
    label: 'Tax clearance',
    hint: 'SARS tax compliance status confirmation.',
    applicantHint: 'Your SARS tax compliance status letter.',
    issuerLabel: 'Issuer',
    referenceLabel: 'PIN / reference',
    expectsExpiry: true,
  },
  guide_registration: {
    label: 'Tourist guide registration',
    hint: 'Provincial tourist guide registration (CATHSSETA / KZN registrar) for guided products.',
    applicantHint: 'Registration for the guide who will lead your trips.',
    issuerLabel: 'Registrar',
    referenceLabel: 'Guide number',
    expectsExpiry: true,
  },
  fire_compliance: {
    label: 'Fire / occupancy certificate',
    hint: 'Municipal fire clearance or occupancy certificate for accommodation premises.',
    applicantHint: 'Your municipal fire clearance or occupancy certificate.',
    issuerLabel: 'Municipality',
    referenceLabel: 'Certificate number',
    expectsExpiry: true,
  },
  other: {
    label: 'Other document',
    hint: 'Anything else the applicant sent in support.',
    applicantHint: 'Any other supporting document.',
    issuerLabel: 'Issued by',
    referenceLabel: 'Reference',
    expectsExpiry: false,
  },
}

/**
 * The accreditation rule, in one place: an operator satisfies it with EITHER
 * of these. Mirrors vd_accreditation_ok() in the migration — if you change
 * one, change the other.
 */
export const ACCREDITATION_DOC_TYPES: ComplianceDocType[] = ['edtea_registration', 'cto_membership']

export function isAccreditation(docType: ComplianceDocType): boolean {
  return ACCREDITATION_DOC_TYPES.includes(docType)
}

export const REVIEW_STATUS_LABEL: Record<ComplianceReviewStatus, string> = {
  pending: 'Awaiting review',
  verified: 'Verified',
  rejected: 'Rejected',
}

/* ── Expiry ─────────────────────────────────────────────────────────────── */

export type ExpiryState = 'none' | 'valid' | 'expiring' | 'expired'

/** Documents inside this window are surfaced for renewal before they lapse. */
export const EXPIRY_WARNING_DAYS = 45

export function expiryState(expiresOn: string | null, today = new Date()): ExpiryState {
  if (!expiresOn) return 'none'
  const expiry = new Date(`${expiresOn}T00:00:00`)
  if (Number.isNaN(expiry.getTime())) return 'none'
  // Compare whole days from midnight so a certificate expiring today reads as
  // valid rather than expired for anyone loading the page in the afternoon.
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((expiry.getTime() - start.getTime()) / 86_400_000)
  if (days < 0) return 'expired'
  if (days <= EXPIRY_WARNING_DAYS) return 'expiring'
  return 'valid'
}

export function daysUntilExpiry(expiresOn: string | null, today = new Date()): number | null {
  if (!expiresOn) return null
  const expiry = new Date(`${expiresOn}T00:00:00`)
  if (Number.isNaN(expiry.getTime())) return null
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((expiry.getTime() - start.getTime()) / 86_400_000)
}

/** A document counts toward accreditation only while verified and unexpired. */
export function isCurrentlyValid(doc: ComplianceDocument, today = new Date()): boolean {
  return doc.reviewStatus === 'verified' && expiryState(doc.expiresOn, today) !== 'expired'
}

/**
 * Does this set of documents satisfy the accreditation requirement?
 * The client-side twin of vd_accreditation_ok().
 */
export function accreditationOk(docs: ComplianceDocument[], today = new Date()): boolean {
  return docs.some(d => isAccreditation(d.docType) && isCurrentlyValid(d, today))
}

/**
 * What the applicant has *submitted* toward accreditation, regardless of
 * review outcome. The form gates on this (a human hasn't reviewed yet at
 * submission time); the approval route gates on accreditationOk().
 */
export function accreditationSubmitted(docs: { docType: ComplianceDocType }[]): boolean {
  return docs.some(d => isAccreditation(d.docType))
}

/* ── Storage ────────────────────────────────────────────────────────────── */

export const COMPLIANCE_BUCKET = 'compliance'
export const COMPLIANCE_MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function safeExtension(fileName: string, mime: string): string {
  const fromName = (fileName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName && fromName.length <= 5) return fromName
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

function newDocId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `cdoc-${crypto.randomUUID()}`
    : `cdoc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function friendlyStorageError(message: string): string {
  if (/row-level security|not authoriz/i.test(message)) {
    return 'Document uploads aren’t enabled yet. Run supabase/migrations/20260905_supplier_compliance.sql in the Supabase SQL editor.'
  }
  if (/bucket.*not.*found/i.test(message)) {
    return 'Storage bucket "compliance" does not exist. Run supabase/migrations/20260905_supplier_compliance.sql first.'
  }
  if (/mime type|not supported/i.test(message)) {
    return 'That file type isn’t accepted. Upload a PDF, or a photo of the certificate.'
  }
  return message || 'Upload failed.'
}

export type ComplianceUploadInput = {
  file: File
  docType: ComplianceDocType
  issuer?: string
  referenceNumber?: string
  issuedOn?: string | null
  expiresOn?: string | null
  /** Exactly one of these — an application reference, or a supplier account. */
  applicationRef?: string
  supplierId?: string
}

/**
 * Upload a certificate into the private bucket and register it for review.
 *
 * The object is written first: a registry row pointing at a file that failed
 * to upload is worse than an orphaned object, which the reviewer simply never
 * sees. If the registry insert then fails, the upload is rolled back where we
 * are allowed to (suppliers own their subtree); an applicant cannot delete,
 * so that path leaves the object behind by design rather than pretending the
 * submission worked.
 */
export async function uploadComplianceDocument(input: ComplianceUploadInput): Promise<ComplianceDocument> {
  const { file, docType, applicationRef, supplierId } = input

  if (!applicationRef === !supplierId) {
    throw new Error('A compliance document belongs to either an application or a supplier account.')
  }
  if (file.size > COMPLIANCE_MAX_BYTES) {
    throw new Error(`${file.name} is larger than ${COMPLIANCE_MAX_BYTES / 1024 / 1024} MB.`)
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    throw new Error(`${file.name} must be a PDF, JPEG, PNG or WebP.`)
  }

  const id = newDocId()
  const ext = safeExtension(file.name, file.type)
  const prefix = supplierId ? `suppliers/${supplierId}` : `applications/${applicationRef}`
  const storagePath = `${prefix}/${id}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(COMPLIANCE_BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false })
  if (uploadError) {
    throw new Error(friendlyStorageError(String((uploadError as { message?: string })?.message || '')))
  }

  const row = {
    id,
    supplier_id: supplierId ?? null,
    application_ref: applicationRef ?? null,
    doc_type: docType,
    issuer: input.issuer ?? '',
    reference_number: input.referenceNumber ?? '',
    issued_on: input.issuedOn || null,
    expires_on: input.expiresOn || null,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || '',
    byte_size: file.size,
    review_status: 'pending' as const,
  }

  const { error } = await supabase.from('vd_compliance_documents').insert(row)
  if (error) {
    if (supplierId) {
      try { await supabase.storage.from(COMPLIANCE_BUCKET).remove([storagePath]) } catch {}
    }
    const message = String(error.message || '')
    if (/relation .* does not exist|could not find the table/i.test(message)) {
      throw new Error(
        'Compliance documents are not set up yet. Run supabase/migrations/20260905_supplier_compliance.sql in the Supabase SQL editor.',
      )
    }
    throw new Error(message || 'Could not record that document. Please try again.')
  }

  return fromRow(row as Record<string, unknown>)
}

/**
 * A time-limited URL for one certificate. The bucket is private, so this is
 * the only way to open a document, and the link dies with the expiry below
 * rather than becoming a shareable handle on somebody's registration papers.
 */
export async function complianceDocumentUrl(storagePath: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(COMPLIANCE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

function fromRow(r: Record<string, unknown>): ComplianceDocument {
  return {
    id: String(r.id ?? ''),
    supplierId: (r.supplier_id as string | null) ?? null,
    applicationRef: (r.application_ref as string | null) ?? null,
    docType: (r.doc_type as ComplianceDocType) ?? 'other',
    issuer: String(r.issuer ?? ''),
    referenceNumber: String(r.reference_number ?? ''),
    issuedOn: (r.issued_on as string | null) ?? null,
    expiresOn: (r.expires_on as string | null) ?? null,
    storagePath: String(r.storage_path ?? ''),
    fileName: String(r.file_name ?? ''),
    mimeType: String(r.mime_type ?? ''),
    byteSize: Number(r.byte_size ?? 0),
    reviewStatus: (r.review_status as ComplianceReviewStatus) ?? 'pending',
    reviewNote: String(r.review_note ?? ''),
    reviewedBy: (r.reviewed_by as string | null) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
  }
}

/** Shared error handling — a read that fails must not read as "none on file". */
function readError(error: { message?: string } | null): Error | null {
  if (!error) return null
  const message = String(error.message || '')
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return new Error(
      'Compliance tracking is not set up yet. Run supabase/migrations/20260905_supplier_compliance.sql in the Supabase SQL editor.',
    )
  }
  return new Error(message || 'Could not load compliance documents.')
}

/** Verification office: documents lodged against one application. */
export async function getApplicationDocuments(applicationRef: string): Promise<ComplianceDocument[]> {
  const { data, error } = await supabase
    .from('vd_compliance_documents')
    .select('*')
    .eq('application_ref', applicationRef)
    .order('created_at', { ascending: true })
  const failure = readError(error)
  if (failure) throw failure
  return (data ?? []).map(d => fromRow(d as Record<string, unknown>))
}

/** Documents held against a supplier account. */
export async function getSupplierDocuments(supplierId: string): Promise<ComplianceDocument[]> {
  const { data, error } = await supabase
    .from('vd_compliance_documents')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: true })
  const failure = readError(error)
  if (failure) throw failure
  return (data ?? []).map(d => fromRow(d as Record<string, unknown>))
}

/**
 * Every document belonging to an application, including after approval.
 *
 * Approving an application re-homes its certificates onto the new supplier
 * account (vd_link_application_to_supplier): supplier_id is set and
 * application_ref is cleared, because the renewal queue tracks expiry per
 * supplier and would otherwise never see a certificate about to lapse.
 *
 * The consequence, which cost a real bug: an approved application queried by
 * application_ref alone comes back empty, so its own panel showed no documents
 * and declared accreditation unsatisfied for an operator who had just been
 * verified and approved. The evidence had moved, not vanished.
 *
 * So look in both places. The storage path still begins applications/<ref>/…,
 * which is what preserves provenance once the row's application_ref is gone.
 */
export async function getDocumentsForApplication(
  applicationRef: string,
  approvedSupplierId?: string | null,
): Promise<ComplianceDocument[]> {
  const [byApplication, bySupplier] = await Promise.all([
    getApplicationDocuments(applicationRef),
    approvedSupplierId ? getSupplierDocuments(approvedSupplierId) : Promise.resolve([]),
  ])

  // A supplier can hold documents from more than one application, and from
  // their own later uploads. Keep only what this application actually sent —
  // the storage prefix is the surviving link once application_ref is cleared.
  const fromThisApplication = bySupplier.filter(d =>
    d.storagePath.startsWith(`applications/${applicationRef}/`),
  )

  const seen = new Set(byApplication.map(d => d.id))
  return [...byApplication, ...fromThisApplication.filter(d => !seen.has(d.id))]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Verification office: everything awaiting a decision, plus anything already
 * verified that has expired or is about to. Both are work; neither shows up
 * anywhere else.
 */
export async function getComplianceQueue(): Promise<ComplianceDocument[]> {
  const { data, error } = await supabase
    .from('vd_compliance_documents')
    .select('*')
    .order('created_at', { ascending: false })
  // Unlike the per-application reads, this one throws: an empty queue and a
  // queue that could not be loaded look identical on screen, and "nothing
  // waiting" is the more dangerous of the two to show by mistake.
  if (error) {
    const message = String(error.message || '')
    if (/relation .* does not exist|could not find the table/i.test(message)) {
      throw new Error(
        'Compliance tracking is not set up yet. Run supabase/migrations/20260905_supplier_compliance.sql in the Supabase SQL editor.',
      )
    }
    throw new Error(message || 'Could not load the compliance queue.')
  }
  const all = (data ?? []).map(d => fromRow(d as Record<string, unknown>))
  return all.filter(d => {
    if (d.reviewStatus === 'pending') return true
    if (d.reviewStatus !== 'verified') return false
    const state = expiryState(d.expiresOn)
    return state === 'expired' || state === 'expiring'
  })
}

/**
 * Every compliance document on file, newest first, with the owner resolved to
 * a readable name.
 *
 * getComplianceQueue() answers "what needs doing?"; this answers "what do we
 * hold?". Both are needed: a queue-only page is empty whenever the estate is
 * healthy, which is most of the time, and gives no way to check whether a
 * particular operator is accredited.
 *
 * Owner names come from two tables because a document is owned by either a
 * supplier account or a not-yet-approved application. Both lookups are
 * admin/ops-gated by RLS and return nothing to anyone else, so a non-staff
 * caller gets documents with blank labels rather than a leak.
 */
export type ComplianceDocumentWithOwner = ComplianceDocument & {
  ownerLabel: string
  ownerHref: string | null
}

export async function getAllComplianceDocuments(): Promise<ComplianceDocumentWithOwner[]> {
  const { data, error } = await supabase
    .from('vd_compliance_documents')
    .select('*')
    .order('created_at', { ascending: false })
  const failure = readError(error)
  if (failure) throw failure

  const docs = (data ?? []).map(d => fromRow(d as Record<string, unknown>))
  if (docs.length === 0) return []

  const supplierIds = [...new Set(docs.map(d => d.supplierId).filter((v): v is string => Boolean(v)))]
  const applicationRefs = [...new Set(docs.map(d => d.applicationRef).filter((v): v is string => Boolean(v)))]

  const [profiles, applications] = await Promise.all([
    supplierIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', supplierIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    applicationRefs.length
      ? supabase.from('vd_listing_applications').select('reference, property_name, contact_email').in('reference', applicationRefs)
      : Promise.resolve({ data: [] as { reference: string; property_name: string | null; contact_email: string | null }[] }),
  ])

  const supplierName = new Map(
    (profiles.data ?? []).map(p => [p.id, p.full_name || p.email || 'Unnamed supplier']),
  )
  const applicationName = new Map(
    (applications.data ?? []).map(a => [a.reference, a.property_name || a.contact_email || a.reference]),
  )

  return docs.map(d => {
    if (d.supplierId) {
      return {
        ...d,
        ownerLabel: supplierName.get(d.supplierId) ?? 'Supplier account',
        ownerHref: '/admin/suppliers',
      }
    }
    return {
      ...d,
      ownerLabel: d.applicationRef
        ? `${applicationName.get(d.applicationRef) ?? d.applicationRef} · application`
        : 'Unknown owner',
      ownerHref: '/admin/listing-applications',
    }
  })
}

/** Record a verification decision. Server-side identity, via the RPC. */
export async function reviewComplianceDocument(
  id: string,
  status: ComplianceReviewStatus,
  note = '',
): Promise<void> {
  const { error } = await supabase.rpc('vd_review_compliance_document', {
    p_id: id,
    p_status: status,
    p_note: note,
  })
  if (error) {
    const message = String(error.message || '')
    if (/could not find the function|does not exist/i.test(message)) {
      throw new Error(
        'Compliance review is not set up yet. Run supabase/migrations/20260905_supplier_compliance.sql in the Supabase SQL editor.',
      )
    }
    throw new Error(message || 'Could not save that decision.')
  }
}
