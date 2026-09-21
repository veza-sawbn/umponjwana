import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { verifyUploadGrant, GRANT_COOKIE } from '@/lib/upload-grant'
import { DOC_TYPES } from '@/lib/compliance'

export const dynamic = 'force-dynamic'

const MAX_TEXT = 200
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isoDate(value: unknown): string | null {
  const v = text(value, 10)
  return ISO_DATE.test(v) ? v : null
}

/**
 * POST /api/listing-applications/compliance-document
 *
 * Registers a certificate an applicant has just uploaded. Replaces the
 * anonymous insert into vd_compliance_documents that 20260905 allowed.
 *
 * THE POLICY THIS REPLACES WAS CAREFUL, AND STILL NOT ENOUGH
 *   It pinned review_status to 'pending', supplier_id to null and the review
 *   columns to null, so an applicant could not self-verify or attach a
 *   document to somebody's account. What it could not check is the one thing
 *   that matters most here: that storage_path points at an object this
 *   applicant actually uploaded. A caller could lodge a row naming ANOTHER
 *   application's certificate — and since the verification office finds an
 *   application's evidence by that path prefix, that is how you get your
 *   accreditation assessed against someone else's papers.
 *
 *   The grant fixes exactly that: it names one reference, and the path must
 *   sit under it.
 *
 * The four fields the old policy pinned are still pinned — here, by not
 * reading them from the request at all.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const reference = text(body.reference, 32).toUpperCase()
  const grant = verifyUploadGrant(cookies().get(GRANT_COOKIE)?.value, reference)
  if (!grant.ok) {
    console.warn('[compliance-document] grant refused:', grant.reason)
    return NextResponse.json(
      { error: 'Please complete the security check before uploading.', needsGrant: true },
      { status: 403 },
    )
  }

  // Per-grant only. The per-caller budget is spent in upload-url, which always
  // runs immediately before this — charging it twice would halve the number of
  // certificates an honest applicant can attach.
  const limit = await rateLimit('listingUpload', `ref:${reference}`)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'That is a lot of documents at once. Please try again shortly.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  // The whole point of the grant: this row may only describe an object under
  // this application's own prefix. Checked against the reference the grant was
  // issued for, not against anything else in the request.
  const storagePath = text(body.storagePath, 512)
  const prefix = `applications/${reference}/`
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    return NextResponse.json({ error: 'That document does not belong to this application.' }, { status: 400 })
  }

  const docType = text(body.docType, 64)
  if (!Object.prototype.hasOwnProperty.call(DOC_TYPES, docType)) {
    return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 })
  }

  const id = text(body.id, 64)
  if (!/^cdoc-[A-Za-z0-9-]{1,50}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid document id.' }, { status: 400 })
  }

  const byteSize = typeof body.byteSize === 'number' && Number.isFinite(body.byteSize)
    ? Math.max(0, Math.floor(body.byteSize))
    : 0

  const admin = supabaseAdmin()
  const { error } = await admin.from('vd_compliance_documents').insert({
    id,
    // Not read from the request. The old RLS policy pinned these four; not
    // reading them is the same rule expressed so it cannot be relaxed by
    // accident.
    supplier_id: null,
    review_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    application_ref: reference,
    doc_type: docType,
    issuer: text(body.issuer),
    reference_number: text(body.referenceNumber),
    issued_on: isoDate(body.issuedOn),
    expires_on: isoDate(body.expiresOn),
    storage_path: storagePath,
    file_name: text(body.fileName, 255),
    mime_type: text(body.mimeType, 128),
    byte_size: byteSize,
  })

  if (error) {
    console.error('[compliance-document] insert failed:', error.message)
    return NextResponse.json(
      { error: 'Could not record that document. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ id, storagePath })
}
