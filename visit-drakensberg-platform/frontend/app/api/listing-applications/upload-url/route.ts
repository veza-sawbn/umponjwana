import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'
import { verifyUploadGrant, GRANT_COOKIE } from '@/lib/upload-grant'
import { planUpload } from '@/lib/listing-application-uploads'

export const dynamic = 'force-dynamic'

/**
 * POST /api/listing-applications/upload-url
 *
 * Hands back a one-object signed upload URL for an applicant who holds a valid
 * grant. The browser then PUTs the file straight to Supabase Storage.
 *
 * WHY NOT PROXY THE BYTES THROUGH HERE
 *   Two reasons, and the first is fatal on its own: a serverless function on
 *   Vercel takes a request body of about 4.5 MB, while a listing photo may be
 *   8 MB and a compliance certificate 15 MB. Proxying would break uploads that
 *   work today. The second is that streaming a 15 MB PDF through a function
 *   buys nothing — the security question is *may this caller write, and
 *   where*, and both are answered here, before any bytes move.
 *
 *   The signed URL is good for one object at one path, which the server chose
 *   (lib/listing-application-uploads.ts). Nothing the caller sent becomes a
 *   path segment except a sanitised extension.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const reference = typeof body.reference === 'string' ? body.reference.trim().toUpperCase() : ''

  // The grant proves a captcha was solved for THIS application. Checked first:
  // everything below it costs something.
  const grant = verifyUploadGrant(cookies().get(GRANT_COOKIE)?.value, reference)
  if (!grant.ok) {
    console.warn('[upload-url] grant refused:', grant.reason)
    return NextResponse.json(
      {
        error: grant.reason === 'expired'
          ? 'Your session has been open a while. Please reload the page and try again.'
          : 'Please complete the security check before uploading.',
        // The form uses this to re-request a grant rather than showing the
        // applicant a dead upload button.
        needsGrant: true,
      },
      { status: 403 },
    )
  }

  // A grant is a bearer capability, so the limit is per grant as well as per
  // caller: someone who solves one challenge should not get an unbounded
  // number of objects out of it.
  const limits = await Promise.all([
    rateLimit('listingUpload', callerKey(req)),
    rateLimit('listingUpload', `ref:${reference}`),
  ])
  const blocked = limits.find(l => !l.ok)
  if (blocked) {
    return NextResponse.json(
      { error: 'That is a lot of files at once. Please try again shortly.' },
      { status: 429, headers: rateLimitHeaders(blocked) },
    )
  }

  const planned = planUpload({
    kind: body.kind,
    reference,
    fileName: body.fileName,
    contentType: body.contentType,
    size: body.size,
    objectId: crypto.randomUUID(),
  })
  if (!planned.ok) {
    return NextResponse.json({ error: planned.error }, { status: 400 })
  }
  const { plan } = planned

  const admin = supabaseAdmin()
  const { data, error } = await admin.storage.from(plan.bucket).createSignedUploadUrl(plan.path)
  if (error || !data) {
    console.error('[upload-url] createSignedUploadUrl failed:', error?.message)
    return NextResponse.json({ error: 'Could not start that upload. Please try again.' }, { status: 500 })
  }

  // The public URL only for the public bucket. A compliance certificate is
  // read through a short-lived signed URL by the verification office and must
  // never acquire a permanent one.
  const publicUrl = plan.publicRead
    ? admin.storage.from(plan.bucket).getPublicUrl(plan.path).data.publicUrl
    : null

  return NextResponse.json({
    bucket: plan.bucket,
    path: data.path,
    token: data.token,
    publicUrl,
  })
}
