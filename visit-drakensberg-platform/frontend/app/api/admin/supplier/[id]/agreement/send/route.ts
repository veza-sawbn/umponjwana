import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSiteOrigin } from '@/lib/origin'
import { sendMail } from '@/lib/mailer'
import { emailShell, ctaButton, esc, getFeaturedExperiences } from '@/lib/email-layout'
import { renderAgreementPdf } from '@/lib/agreement-pdf'
import { loadAgreementRecord, agreementFileName, isAgreementDocument } from '@/lib/agreement-record'
import { AGREEMENT_LABEL } from '@/lib/supplier-agreement-content'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/supplier/[id]/agreement/send
 * Body: { document?: 'supplier_terms' | 'code_of_conduct', to?: string }
 *
 * Emails the supplier their copy of the accepted document, PDF attached.
 *
 * Verification office only — unlike the download route, which a supplier may
 * use on themselves. Sending mail on the platform's behalf is a staff action,
 * and letting a supplier trigger it would hand anyone with an account a way to
 * send Visit Drakensberg-branded mail to an address of their choosing.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: { document?: string; to?: string } = {}
  try {
    body = await req.json()
  } catch {
    // An empty body is fine — defaults below cover it.
  }

  const documentParam = body.document ?? 'supplier_terms'
  if (!isAgreementDocument(documentParam)) {
    return NextResponse.json({ error: 'Unknown document.' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles').select('role, staff_role').eq('id', user.id).maybeSingle()
  const isOffice = caller?.role === 'admin' || caller?.staff_role === 'finance' || caller?.staff_role === 'operations'
  if (!isOffice) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const origin = getSiteOrigin(req)
  const loaded = await loadAgreementRecord(params.id, documentParam, origin)
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const data = loaded.data
  // Default to the address we hold. An override is allowed because the
  // signatory is often not the login — a lodge's owner signs, the reservations
  // mailbox is the account — but it is staff-supplied, never caller-supplied
  // from an unauthenticated context.
  const to = (body.to || data.supplierEmail || '').trim()
  if (!to) {
    return NextResponse.json({ error: 'That supplier has no email address on file.' }, { status: 400 })
  }

  let pdf: Buffer
  try {
    pdf = await renderAgreementPdf(data)
  } catch (err) {
    console.error('[agreement send] render failed', { supplierId: params.id, document: documentParam, err })
    return NextResponse.json({ error: 'Could not generate the agreement PDF.' }, { status: 500 })
  }

  const label = AGREEMENT_LABEL[documentParam]
  const accepted = data.acceptance
  const featured = await getFeaturedExperiences(origin)

  const html = emailShell({
    origin,
    heading: `Your ${label}`,
    preheader: `A copy of the ${label} for ${data.supplierName}.`,
    featured,
    bodyHtml: `
      <p style="margin:0 0 4px;">Dear ${esc(data.supplierName)},</p>
      <p style="margin:0 0 16px;">
        Attached is your copy of the <strong>${esc(label)}</strong> (version ${esc(data.version)}) for your records.
      </p>
      ${accepted
        ? `<p style="margin:0 0 20px;">It was accepted by ${esc(accepted.acceptedName || 'your representative')} on
             ${esc(new Date(accepted.acceptedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }))}.
             The attached PDF carries that record in full.</p>`
        : `<p style="margin:0 0 20px;">We have no record of this document being accepted yet. Please read it and get in
             touch if anything needs discussing before you accept.</p>`}
      ${ctaButton(`${origin}/supplier-terms`, 'Read the current version online')}`,
  })

  const { sent, error } = await sendMail({
    to,
    subject: `${label} — ${data.supplierName}`,
    html,
    attachments: [{
      filename: agreementFileName(data.supplierName, documentParam, data.version),
      content: pdf,
      contentType: 'application/pdf',
    }],
  })

  if (!sent) {
    return NextResponse.json(
      { sent: false, error: error ?? 'The email could not be sent.' },
      { status: error === 'SMTP not configured' ? 503 : 502 },
    )
  }

  return NextResponse.json({ sent: true, to, error: null })
}
