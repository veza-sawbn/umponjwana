import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSiteOrigin } from '@/lib/origin'
import { renderAgreementPdf } from '@/lib/agreement-pdf'
import { loadAgreementRecord, agreementFileName, isAgreementDocument } from '@/lib/agreement-record'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/supplier/[id]/agreement?document=supplier_terms
 *
 * The supplier's copy of a document they accepted, as a PDF: the acceptance
 * record (who, when, on what commission) followed by the full text at the
 * version they accepted.
 *
 * Readable by the verification office and by the supplier themself — a
 * supplier asking for their own signed terms is the most ordinary request
 * there is, and making them email staff for it would be silly.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const documentParam = new URL(req.url).searchParams.get('document') ?? 'supplier_terms'
  if (!isAgreementDocument(documentParam)) {
    return NextResponse.json({ error: 'Unknown document.' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles').select('role, staff_role').eq('id', user.id).maybeSingle()
  const isOffice = caller?.role === 'admin' || caller?.staff_role === 'finance' || caller?.staff_role === 'operations'
  if (!isOffice && user.id !== params.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const loaded = await loadAgreementRecord(params.id, documentParam, getSiteOrigin(req))
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  let pdf: Buffer
  try {
    pdf = await renderAgreementPdf(loaded.data)
  } catch (err) {
    // Surface the real cause in the function logs — a render failure otherwise
    // looks identical to "the download button doesn't work" with no lead.
    console.error('[agreement pdf] render failed', { supplierId: params.id, document: documentParam, err })
    return NextResponse.json({ error: 'Could not generate the agreement PDF.' }, { status: 500 })
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${agreementFileName(loaded.data.supplierName, documentParam, loaded.data.version)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
