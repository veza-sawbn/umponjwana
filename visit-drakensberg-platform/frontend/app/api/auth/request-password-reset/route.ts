import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/request-password-reset
 *
 * Server-side wrapper around Supabase's resetPasswordForEmail.
 *
 * Why server-side instead of calling Supabase directly from the browser?
 *
 *   1. Correct redirectTo URL.
 *      The browser build of lib/auth.ts relied on NEXT_PUBLIC_SITE_URL to
 *      construct the redirectTo path. If that env var is misconfigured (e.g.
 *      missing "https://" or pointing at the Supabase REST API endpoint), the
 *      email link redirects to the wrong place and the user sees:
 *        {"message":"No API key found in request",...}
 *      because they end up hitting a Supabase REST endpoint without credentials.
 *
 *      Here we use getSiteOrigin() which always prefers the x-forwarded-host /
 *      x-forwarded-proto headers set by Vercel (the public URL the browser
 *      actually used) over the potentially-wrong env var.
 *
 *   2. Admin client — no anon-key dependency.
 *      The supabaseAdmin() client uses the service-role key (server-only env
 *      var). The browser-side anon key does not need to be present or correct
 *      for email delivery.
 *
 * Rate-limiting: returns success even for unknown emails to avoid user
 * enumeration (same behaviour as Supabase itself).
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

  // Point Supabase at the server-side callback handler, NOT /auth/reset-password
  // directly. The callback route exchanges the PKCE code server-side (no anon-key
  // dependency) and then redirects the user to /auth/reset-password with the
  // session cookie already set, where onAuthStateChange fires PASSWORD_RECOVERY.
  const redirectTo = `${getSiteOrigin(req)}/api/auth/callback`

  const { error } = await supabaseAdmin().auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    // Log server-side but don't expose Supabase internals to the client.
    console.error('[request-password-reset] Supabase error:', error)
  }
  // Always respond with success to avoid leaking whether the address exists.
  return NextResponse.json({ ok: true })
}
