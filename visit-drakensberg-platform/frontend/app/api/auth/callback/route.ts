import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/callback
 *
 * Server-side PKCE callback handler for Supabase auth flows.
 *
 * Supabase sends password-reset and invite emails with a link that
 * redirects to this route with ?code=<auth_code>. We exchange the code
 * server-side (using the route-handler client which manages cookies) and
 * then redirect the user to the appropriate page.
 *
 * WHY SERVER-SIDE?
 *   Exchanging the code in the browser requires the anon key to be
 *   correctly injected at build time (NEXT_PUBLIC_SUPABASE_ANON_KEY).
 *   Doing it here avoids that dependency entirely: the route-handler
 *   client reads the key from process.env at request time.
 *
 * URL PATTERNS
 *   Password reset:  ?code=xxx  → /auth/reset-password  (or ?next= override)
 *   Invite accept:   ?code=xxx  → /auth/reset-password  (set password on invite)
 *
 * The redirectTo passed to Supabase's resetPasswordForEmail / inviteUserByEmail
 * should point here:  https://site.com/api/auth/callback
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // Allow callers to override the post-exchange redirect (e.g. ?next=/supplier)
  const next = url.searchParams.get('next') ?? '/auth/reset-password'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Code exchanged; session cookie is now set. Redirect to target page.
      // Use an absolute URL so the redirect works from any deployment origin.
      return NextResponse.redirect(new URL(next, request.url))
    }

    // Exchange failed (expired code, already used, etc.)
    console.error('[auth/callback] exchangeCodeForSession error:', error)
    return NextResponse.redirect(
      new URL(`/auth/reset-password?error=link_expired`, request.url),
    )
  }

  // No code present — send to login
  return NextResponse.redirect(new URL('/auth/login', request.url))
}
