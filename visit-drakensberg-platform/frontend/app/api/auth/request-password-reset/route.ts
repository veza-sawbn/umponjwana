import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/request-password-reset
 *
 * Server-side wrapper around Supabase's resetPasswordForEmail.
 *
 * Why server-side?
 *   The client-side supabase.auth.resetPasswordForEmail() builds its
 *   redirectTo URL from NEXT_PUBLIC_SITE_URL. If that variable is absent
 *   or missing the "https://" scheme (e.g. "umponjwana.vercel.app"),
 *   Supabase rejects the redirect URL and the user's browser ends up
 *   hitting the Supabase REST API endpoint directly — which responds with
 *   {"message":"No API key found in request",...}.
 *
 *   By handling the call server-side we can derive a reliable origin from
 *   the x-forwarded-host / x-forwarded-proto headers (set by Vercel and
 *   most reverse-proxies) and use the admin client, which is not affected
 *   by the anon-key env-var issues that can plague the browser client.
 *
 * Rate-limiting: intentionally returns success even for unknown emails
 * (same behaviour as Supabase) to avoid user enumeration.
 */
export async function POST(req: Request) {
  let email: string | undefined
  try {
    const body = await req.json()
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  // Build the site origin reliably.
  // Priority: NEXT_PUBLIC_SITE_URL env var (normalised to have https://) →
  //           x-forwarded-host + x-forwarded-proto (Vercel / proxies) →
  //           URL host of this request itself.
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  let siteOrigin: string

  if (rawSiteUrl) {
    // Ensure the URL always has a scheme — the env var is sometimes set
    // without "https://" (e.g. "umponjwana.vercel.app").
    siteOrigin = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`
    // Strip any trailing slash so the path concatenation below is clean.
    siteOrigin = siteOrigin.replace(/\/+$/, '')
  } else {
    const host = req.headers.get('x-forwarded-host') ?? new URL(req.url).host
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    siteOrigin = `${proto}://${host}`
  }

  const redirectTo = `${siteOrigin}/auth/reset-password`

  const admin = supabaseAdmin()
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    // Log on the server but don't expose internal details to the client.
    console.error('[request-password-reset] Supabase error:', error)
    // Still return a 200-equivalent "check your email" response to avoid
    // leaking whether the address exists in our system.
  }

  return NextResponse.json({ ok: true })
}
