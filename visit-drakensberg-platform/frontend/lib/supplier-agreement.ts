import { supabase } from './auth'
import { AGREEMENT_VERSION, type AgreementDocument } from './supplier-agreement-content'

// The supplier-side legal surface: the Supplier Agreement (commercial) and
// the Supplier Code of Conduct (conduct), plus the append-only record of who
// accepted which version.
//
// Why versions are constants rather than page content: an acceptance is only
// evidence if it names a specific document. The pages at /supplier-terms and
// /supplier-code-of-conduct render from SUPPLIER_TERMS_SECTIONS and
// CODE_OF_CONDUCT_SECTIONS below, so the version stamped on an acceptance and
// the words the supplier actually read cannot drift apart. Change the words,
// bump the version in the same commit.

export {
  SUPPLIER_TERMS_VERSION,
  CODE_OF_CONDUCT_VERSION,
  AGREEMENT_LABEL,
  AGREEMENT_PATH,
  AGREEMENT_VERSION,
  SUPPLIER_TERMS_SECTIONS,
  CODE_OF_CONDUCT_SECTIONS,
} from './supplier-agreement-content'
export type { AgreementDocument, LegalSection } from './supplier-agreement-content'

/* ────────────────────────────────────────────────────────────────────────────
 * Acceptance record
 * ──────────────────────────────────────────────────────────────────────── */

export type AgreementAcceptance = {
  id: string
  supplierId: string | null
  applicationRef: string | null
  document: AgreementDocument
  version: string
  acceptedName: string
  acceptedEmail: string
  acceptedRole: string
  acceptedTerms: Record<string, unknown>
  acceptedAt: string
}

export type RecordAcceptanceInput = {
  document: AgreementDocument
  name: string
  email: string
  role?: string
  /** Commercial terms as displayed at the moment of acceptance. */
  terms?: Record<string, unknown>
  applicationRef?: string
  supplierId?: string
}

function newAcceptanceId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `agr-${crypto.randomUUID()}`
    : `agr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Append one acceptance. Never updates: a correction is a newer row.
 *
 * Deliberately does not throw on a missing table. An acceptance that cannot
 * be written must not stop somebody applying — the application is the thing
 * with commercial value, and losing it to a migration that has not been run
 * yet would be the worse failure. The caller logs and continues; the missing
 * record shows up in the review queue as "no acceptance on file".
 */
export async function recordAcceptance(input: RecordAcceptanceInput): Promise<boolean> {
  const row = {
    id: newAcceptanceId(),
    supplier_id: input.supplierId ?? null,
    application_ref: input.applicationRef ?? null,
    document: input.document,
    version: AGREEMENT_VERSION[input.document],
    accepted_name: input.name ?? '',
    accepted_email: input.email ?? '',
    accepted_role: input.role ?? '',
    accepted_terms: input.terms ?? {},
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : '',
  }
  const { error } = await supabase.from('vd_supplier_agreements').insert(row)
  if (error) {
    console.error('[supplier-agreement] acceptance not recorded:', error.message)
    return false
  }
  return true
}

/** Record acceptance of both supplier documents in one step. */
export async function recordBothAcceptances(
  input: Omit<RecordAcceptanceInput, 'document'>,
): Promise<boolean> {
  const results = await Promise.all([
    recordAcceptance({ ...input, document: 'supplier_terms' }),
    recordAcceptance({ ...input, document: 'code_of_conduct' }),
  ])
  return results.every(Boolean)
}

function acceptanceFromRow(r: Record<string, unknown>): AgreementAcceptance {
  return {
    id: String(r.id ?? ''),
    supplierId: (r.supplier_id as string | null) ?? null,
    applicationRef: (r.application_ref as string | null) ?? null,
    document: (r.document as AgreementDocument) ?? 'supplier_terms',
    version: String(r.version ?? ''),
    acceptedName: String(r.accepted_name ?? ''),
    acceptedEmail: String(r.accepted_email ?? ''),
    acceptedRole: String(r.accepted_role ?? ''),
    acceptedTerms: (r.accepted_terms as Record<string, unknown>) ?? {},
    acceptedAt: String(r.accepted_at ?? ''),
  }
}

/**
 * Verification office: what this applicant accepted, and when.
 *
 * Approval fills in supplier_id on these rows (application_ref is kept, unlike
 * on compliance documents), so the application reference alone is enough. The
 * optional supplierId is a belt-and-braces second lookup for a row whose
 * application_ref was never set — an acceptance recorded from the supplier
 * portal rather than the public form.
 */
export async function getApplicationAcceptances(
  applicationRef: string,
  approvedSupplierId?: string | null,
): Promise<AgreementAcceptance[]> {
  const { data } = await supabase
    .from('vd_supplier_agreements')
    .select('*')
    .eq('application_ref', applicationRef)
    .order('accepted_at', { ascending: true })
  const byApplication = (data ?? []).map(r => acceptanceFromRow(r as Record<string, unknown>))

  if (!approvedSupplierId) return byApplication

  const bySupplier = await getSupplierAcceptances(approvedSupplierId)
  const seen = new Set(byApplication.map(a => a.id))
  return [...byApplication, ...bySupplier.filter(a => !seen.has(a.id))]
    .sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt))
}

/** Acceptances held against a supplier account. */
export async function getSupplierAcceptances(supplierId: string): Promise<AgreementAcceptance[]> {
  const { data } = await supabase
    .from('vd_supplier_agreements')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('accepted_at', { ascending: true })
  return (data ?? []).map(r => acceptanceFromRow(r as Record<string, unknown>))
}
