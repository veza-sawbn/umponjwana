import { NextResponse } from 'next/server'
import { REFERENCE_PATTERN } from '@/lib/listing-application-intake'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile-verify'
import { signUploadGrant, grantCookieOptions, GRANT_COOKIE, GRANT_TTL_MS } from '@/lib/upload-grant'

export const dynamic = 'force-dynamic'

/**
 * POST /api/listing-applications/upload-grant
 *
 * Trades one solved Turnstile challenge for a two-hour, reference-scoped
 * permission to upload — see lib/upload-grant.ts for why it is a grant rather
 * than a captcha per file.
 *
 * The grant comes back as an httpOnly cookie rather than in the body: nothing
 * in the page ever needs to read it, and a value no script can reach cannot be
 * scraped out of the DOM by an injected one.
 */
export async function POST(req: Request) {
  let body: { reference?: unknown; captchaToken?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const reference = typeof body.reference === 'string' ? body.reference.trim().toUpperCase() : ''
  if (!REFERENCE_PATTERN.test(reference)) {
    return NextResponse.json({ error: 'That application reference is not valid.' }, { status: 400 })
  }

  // Before the rate limiter, so a forged token cannot spend a real applicant's
  // budget for an IP they happen to share.
  const captcha = await verifyTurnstileToken(
    typeof body.captchaToken === 'string' ? body.captchaToken : undefined,
  )
  if (!captcha.ok) {
    console.warn('[upload-grant] captcha refused:', captcha.reason, captcha.errorCodes)
    return NextResponse.json(
      { error: 'Security check failed. Please reload the page and try again.' },
      { status: 400 },
    )
  }

  const limit = await rateLimit('listingUploadGrant', callerKey(req))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts from here just now. Please try again shortly.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const grant = signUploadGrant(reference)
  if (!grant) {
    // No service-role key: the upload routes could not write anyway, so this
    // is a misconfigured deployment rather than a rejected caller.
    console.error('[upload-grant] no SUPABASE_SERVICE_ROLE_KEY — cannot issue upload grants')
    return NextResponse.json({ error: 'Uploads are not available right now.' }, { status: 503 })
  }

  const res = NextResponse.json({ expiresInSeconds: Math.floor(GRANT_TTL_MS / 1000) })
  res.cookies.set(GRANT_COOKIE, grant, grantCookieOptions(new URL(req.url).protocol === 'https:'))
  return res
}
