import { supabase } from './auth'

// The grievance channel (see supabase/migrations/20260905_supplier_compliance.sql).
//
// Required by the Supplier Code of Conduct, which tells suppliers to route
// concerns here and to point their own workers at it when they have nothing
// of their own. That promise only means something if the channel is reachable
// without an account and usable anonymously — a worker reporting their own
// employer, or a guest reporting an operator, cannot be asked to sign up
// first.
//
// Write-only for the public, exactly like listing applications: a reporter
// lodges and can never read anything back, theirs or anyone else's.

export type ConcernCategory =
  | 'safety'
  | 'listing_accuracy'
  | 'guest_treatment'
  | 'worker_treatment'
  | 'bribery_or_fraud'
  | 'data_protection'
  | 'environmental'
  | 'other'

export type ConcernStatus = 'new' | 'reviewing' | 'resolved' | 'dismissed'

export const CONCERN_CATEGORIES: { id: ConcernCategory; label: string; blurb: string }[] = [
  { id: 'safety', label: 'Guest or worker safety', blurb: 'Unsafe equipment, vehicles, premises, group sizes or conditions' },
  { id: 'worker_treatment', label: 'Treatment of workers', blurb: 'Wages, hours, harassment, underage or forced labour' },
  { id: 'guest_treatment', label: 'Treatment of guests', blurb: 'Discrimination, pressure over reviews, a complaint dismissed' },
  { id: 'listing_accuracy', label: 'Misleading listing', blurb: 'Photos, prices or descriptions that do not match reality' },
  { id: 'bribery_or_fraud', label: 'Bribery or fraud', blurb: 'Payments for placement, kickbacks, bookings taken off-platform' },
  { id: 'data_protection', label: 'Guest information', blurb: 'Guest details misused, shared or exposed' },
  { id: 'environmental', label: 'Environmental or heritage', blurb: 'Damage to trails, rock art, water or protected areas' },
  { id: 'other', label: 'Something else', blurb: 'Anything not covered above' },
]

export const CONCERN_CATEGORY_LABEL: Record<ConcernCategory, string> = Object.fromEntries(
  CONCERN_CATEGORIES.map(c => [c.id, c.label]),
) as Record<ConcernCategory, string>

export const CONCERN_STATUS_LABEL: Record<ConcernStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export type Concern = {
  id: string
  reference: string
  category: ConcernCategory
  aboutBusiness: string
  body: string
  isAnonymous: boolean
  reporterName: string
  reporterEmail: string
  status: ConcernStatus
  adminNote: string
  createdAt: string
}

export type ConcernDraft = {
  category: ConcernCategory
  aboutBusiness: string
  body: string
  isAnonymous: boolean
  reporterName: string
  reporterEmail: string
}

function newReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1
  let tail = ''
  for (let i = 0; i < 6; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `CN-${tail}`
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `cn-${crypto.randomUUID()}`
    : `cn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Lodge a concern. Returns the reference so the reporter can quote it later —
 * the one thread they have back to us when they have left no contact details.
 *
 * Anonymity is enforced here as well as by a check constraint on the table:
 * ticking anonymous clears the contact fields on the way out, so a name typed
 * before the box was ticked cannot travel with the report.
 */
export async function submitConcern(draft: ConcernDraft): Promise<Concern> {
  const concern: Concern = {
    id: newId(),
    reference: newReference(),
    category: draft.category,
    aboutBusiness: draft.aboutBusiness.trim(),
    body: draft.body.trim(),
    isAnonymous: draft.isAnonymous,
    reporterName: draft.isAnonymous ? '' : draft.reporterName.trim(),
    reporterEmail: draft.isAnonymous ? '' : draft.reporterEmail.trim(),
    status: 'new',
    adminNote: '',
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from('vd_concerns').insert({
    id: concern.id,
    reference: concern.reference,
    category: concern.category,
    about_business: concern.aboutBusiness,
    body: concern.body,
    is_anonymous: concern.isAnonymous,
    reporter_name: concern.reporterName,
    reporter_email: concern.reporterEmail,
    status: concern.status,
  })

  if (error) {
    const message = String(error.message || '')
    if (/relation .* does not exist|could not find the table/i.test(message)) {
      throw new Error(
        'The concern channel is not set up yet. Run supabase/migrations/20260905_supplier_compliance.sql in the Supabase SQL editor.',
      )
    }
    throw new Error(message || 'Could not send that report. Please try again, or email hello@visitdrakensberg.com.')
  }

  return concern
}

function fromRow(r: Record<string, unknown>): Concern {
  return {
    id: String(r.id ?? ''),
    reference: String(r.reference ?? ''),
    category: (r.category as ConcernCategory) ?? 'other',
    aboutBusiness: String(r.about_business ?? ''),
    body: String(r.body ?? ''),
    isAnonymous: Boolean(r.is_anonymous),
    reporterName: String(r.reporter_name ?? ''),
    reporterEmail: String(r.reporter_email ?? ''),
    status: (r.status as ConcernStatus) ?? 'new',
    adminNote: String(r.admin_note ?? ''),
    createdAt: String(r.created_at ?? ''),
  }
}

/** Verification office only — RLS returns nothing to anyone else. */
export async function getConcerns(): Promise<Concern[]> {
  const { data } = await supabase
    .from('vd_concerns')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(r => fromRow(r as Record<string, unknown>))
}

/** Admin only. */
export async function setConcernStatus(id: string, status: ConcernStatus, adminNote?: string): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (adminNote !== undefined) patch.admin_note = adminNote
  const { error } = await supabase.from('vd_concerns').update(patch).eq('id', id)
  if (error) throw new Error(error.message || 'Could not update that report.')
}
