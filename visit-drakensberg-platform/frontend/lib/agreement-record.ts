import { supabaseAdmin } from './supabase-admin'
import { AGREEMENT_VERSION, type AgreementDocument } from './supplier-agreement-content'
import { BUSINESS_DETAILS_DEFAULTS, type BusinessDetails } from './pdf-letterhead'
import type { AgreementPdfData, AgreementPdfAcceptance } from './agreement-pdf'

// SERVER ONLY.
//
// Assembles what the agreement PDF needs for one supplier: who they are, and
// the acceptance on file for the document being issued.
//
// Reads with the service role because the two routes that use it have already
// checked the caller (admin/ops, or the supplier themself), and the supplier's
// own acceptance row may still be keyed to the application reference rather
// than their account.

export type AgreementLoad =
  | { ok: true; data: AgreementPdfData }
  | { ok: false; status: number; error: string }

export async function loadAgreementRecord(
  supplierId: string,
  document: AgreementDocument,
  siteUrl: string,
): Promise<AgreementLoad> {
  const admin = supabaseAdmin()

  // Registered company details for the letterhead. Merged over the defaults so
  // a missing key renders as an omitted line rather than "undefined" on a legal
  // document; edited at /admin/settings.
  const [{ data: profile, error: profileError }, { data: businessRow }] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('id', supplierId).maybeSingle(),
    admin.from('site_content').select('value').eq('key', 'business_details').maybeSingle(),
  ])
  const business: BusinessDetails = {
    ...BUSINESS_DETAILS_DEFAULTS,
    ...((businessRow?.value as Partial<BusinessDetails> | undefined) ?? {}),
  }

  if (profileError) return { ok: false, status: 500, error: 'Could not load that supplier.' }
  if (!profile) return { ok: false, status: 404, error: 'Supplier not found.' }

  // Newest acceptance of this document wins: a re-issue after a wording change
  // appends a row rather than editing the old one, so the latest is the one in
  // force. The older rows stay on file as the history of what was agreed when.
  const { data: rows, error: acceptanceError } = await admin
    .from('vd_supplier_agreements')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('document', document)
    .order('accepted_at', { ascending: false })
    .limit(1)

  if (acceptanceError && !/relation .* does not exist/i.test(String(acceptanceError.message || ''))) {
    return { ok: false, status: 500, error: 'Could not load the acceptance record.' }
  }

  const row = rows?.[0] as Record<string, unknown> | undefined
  const acceptance: AgreementPdfAcceptance | null = row
    ? {
        document: (row.document as AgreementDocument) ?? document,
        version: String(row.version ?? ''),
        acceptedName: String(row.accepted_name ?? ''),
        acceptedEmail: String(row.accepted_email ?? ''),
        acceptedRole: String(row.accepted_role ?? ''),
        acceptedAt: String(row.accepted_at ?? ''),
        acceptedTerms: (row.accepted_terms as Record<string, unknown>) ?? {},
      }
    : null

  return {
    ok: true,
    data: {
      document,
      supplierName: profile.full_name || profile.email || 'Supplier',
      supplierEmail: profile.email ?? '',
      business,
      acceptance,
      // Render the version they accepted, not today's — a PDF headed with a
      // version nobody agreed to is worse than no PDF. Falls back to current
      // only when there is no acceptance, where the document itself says so.
      version: acceptance?.version || AGREEMENT_VERSION[document],
      siteUrl,
      generatedAt: new Date().toISOString(),
    },
  }
}

export function agreementFileName(supplierName: string, document: AgreementDocument, version: string): string {
  const safeName = supplierName.replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '-') || 'Supplier'
  const docPart = document === 'supplier_terms' ? 'Supplier-Agreement' : 'Code-of-Conduct'
  return `${docPart}-${safeName}-v${version}.pdf`
}

export function isAgreementDocument(value: string | null): value is AgreementDocument {
  return value === 'supplier_terms' || value === 'code_of_conduct'
}
