import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile-verify'
import { buildIntakeRow, INTAKE_MAX_BYTES } from '@/lib/listing-application-intake'

export const dynamic = 'force-dynamic'

/**
 * POST /api/listing-applications
 *
 * The front door for "list with us". Closes the last hole the September 2026
 * audit left open, and the one 20260807_listing_applications.sql asked for in
 * its own header a month before the flood arrived:
 *
 *   "It is still an unauthenticated write endpoint: a bot that finds it can
 *    fill the bucket. Put the platform behind a rate limit / captcha before
 *    this sees real traffic."
 *
 * WHAT CHANGED
 *   The form used to insert straight into PostgREST with the anon key. The
 *   Turnstile work that preceded this commit covered the *wizard* — it signs
 *   the applicant up first, and Supabase gates that signup — but a client that
 *   skipped the wizard and posted to PostgREST directly was not signing up and
 *   so met no captcha at all. That is exactly what a scripted run does.
 *
 *   The write now happens here, behind three things a script has to get past
 *   rather than none:
 *     1. a Turnstile token, verified against Cloudflare (not skippable: the
 *        browser cannot reach the table any more — see
 *        20260921_listing_applications_server_only.sql);
 *     2. a rate limit, per caller and per contact address;
 *     3. server-owned id, status and timestamp, and a hard size ceiling
 *        (lib/listing-application-intake.ts).
 *
 * WHY THE RATE LIMIT FAILS OPEN HERE
 *   Unlike password reset, the limiter is not the primary control on this
 *   route — the captcha is, and the captcha fails closed. A Redis outage
 *   should not also close the platform's supplier pipeline while Cloudflare is
 *   still turning bots away.
 */
export async function POST(req: Request) {
  // Read as text first: JSON.parse on an unbounded body is the cost this cap
  // exists to avoid, so the size is checked before anything parses it.
  let raw: string
  try {
    raw = await req.text()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const bytes = Buffer.byteLength(raw, 'utf8')
  if (bytes > INTAKE_MAX_BYTES) {
    return NextResponse.json({ error: 'That application is too large to submit.' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const captchaToken =
    body && typeof body === 'object' && typeof (body as { captchaToken?: unknown }).captchaToken === 'string'
      ? (body as { captchaToken: string }).captchaToken
      : undefined

  // Before the rate limiter, so a forged token cannot spend a real applicant's
  // budget for the IP they happen to share.
  const captcha = await verifyTurnstileToken(captchaToken)
  if (!captcha.ok) {
    console.warn('[listing-applications] captcha refused:', captcha.reason, captcha.errorCodes)
    return NextResponse.json(
      { error: 'Security check failed. Please reload the page and try again.' },
      { status: 400 },
    )
  }

  const built = buildIntakeRow(
    body,
    { id: `lapp-${crypto.randomUUID()}`, now: new Date().toISOString() },
    bytes,
  )
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 })
  }
  const { row } = built

  // Budgeted per caller AND per contact address, so neither one script working
  // through a list of businesses nor a distributed burst under one address
  // gets through. Five an hour is generous for a form that takes a human
  // fifteen minutes to fill in.
  const limits = await Promise.all([
    rateLimit('listingApplication', callerKey(req)),
    rateLimit('listingApplication', `email:${row.contact_email}`),
  ])
  const blocked = limits.find(l => !l.ok)
  if (blocked) {
    return NextResponse.json(
      { error: 'Too many applications from here just now. Please try again shortly.' },
      { status: 429, headers: rateLimitHeaders(blocked) },
    )
  }

  const admin = supabaseAdmin()

  // Mirror columns added by migrations later than the table itself:
  // commission_tier (20260808), accreditation_type / accreditation_ref
  // (20260905). Deploys and migrations do not land in lockstep, so a build
  // carrying these can reach a database that has not run those migrations.
  // Every one of them only helps the review queue sort and filter; the
  // authoritative copy is inside `value`. Same fallback the client-side
  // insert used, moved here with the write.
  const compliance = (row.value.compliance ?? {}) as Record<string, unknown>
  const mirrors = {
    commission_tier: typeof row.value.commissionTier === 'string' ? row.value.commissionTier : null,
    accreditation_type: typeof compliance.accreditationKind === 'string' ? compliance.accreditationKind : null,
    accreditation_ref: typeof compliance.accreditationNumber === 'string' ? compliance.accreditationNumber : null,
  }

  let { error } = await admin.from('vd_listing_applications').insert({ ...row, ...mirrors })
  if (error && Object.keys(mirrors).some(col => isMissingColumn(error!.message, col))) {
    ;({ error } = await admin.from('vd_listing_applications').insert(row))
  }

  if (error) {
    // The applicant has just spent fifteen minutes on this form. Log what
    // actually happened, and tell them something they can act on without
    // handing them the database's own words.
    console.error('[listing-applications] insert failed:', error.message)
    return NextResponse.json(
      { error: 'Could not submit your application. Please try again.' },
      { status: 500 },
    )
  }

  // Only what the success screen needs. The row is write-only to the public by
  // design — an applicant cannot read one back, not even their own.
  return NextResponse.json({
    id: row.id,
    reference: row.reference,
    contactEmail: row.contact_email,
  })
}

/** PostgREST reports an unknown column either from its schema cache or straight from Postgres. */
function isMissingColumn(message: string | undefined, column: string): boolean {
  const m = String(message || '')
  return m.includes(column) && /could not find|does not exist|schema cache/i.test(m)
}
