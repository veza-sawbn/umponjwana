import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/checkout', '/supplier', '/admin', '/account']
const ADMIN_ROUTES = ['/admin']
const SUPPLIER_ROUTES = ['/supplier']
// Routes that must stay reachable even while maintenance mode is on — the
// admin/supplier consoles (per the settings toggle's own description), the
// auth flow (needed to sign in and reach those consoles), and the
// maintenance page itself (avoid rewriting it into a loop).
const MAINTENANCE_EXEMPT_ROUTES = ['/admin', '/supplier', '/auth', '/maintenance']

export async function middleware(req: NextRequest) {
  // `res` must be passed through so auth-helpers can refresh the session cookie.
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const pathname = req.nextUrl.pathname

  if (!MAINTENANCE_EXEMPT_ROUTES.some(r => pathname.startsWith(r))) {
    const { data: platformSettings } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'platform_settings')
      .maybeSingle()
    if (platformSettings?.value?.maintenance_mode) {
      return NextResponse.redirect(new URL('/maintenance', req.url))
    }
  }

  // Always call getSession so the helper has a chance to refresh the token and
  // write updated Set-Cookie headers onto `res`.
  const { data: { session } } = await supabase.auth.getSession()

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))

  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    const redirect = NextResponse.redirect(loginUrl)
    // Forward any Set-Cookie headers so the refresh token isn't lost.
    res.headers.getSetCookie().forEach(cookie => {
      redirect.headers.append('Set-Cookie', cookie)
    })
    return redirect
  }

  if (session) {
    // Prefer app_metadata.role (only settable server-side) over
    // user_metadata.role, which a user can edit on their own account via
    // supabase.auth.updateUser. Roles should be assigned in app_metadata.
    let role = session.user.app_metadata?.role ?? session.user.user_metadata?.role
    let staffRole = session.user.app_metadata?.staff_role ?? session.user.user_metadata?.staff_role
    if (!role) {
      // Accounts created outside the signup form may have no role in auth
      // metadata at all — fall back to the profiles table (RLS: own row).
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, staff_role')
        .eq('id', session.user.id)
        .maybeSingle()
      role = profile?.role ?? 'visitor'
      staffRole = staffRole ?? profile?.staff_role
    }
    // Finance/operations collaborators (role stays 'visitor', staff_role set)
    // get into the console too — individual pages and RLS scope what they
    // can actually see, same as is_finance()/is_ops() do at the DB level.
    const isStaff = role === 'admin' || staffRole === 'finance' || staffRole === 'operations'
    if (ADMIN_ROUTES.some(r => pathname.startsWith(r)) && !isStaff) {
      return NextResponse.redirect(new URL('/account', req.url))
    }
    if (SUPPLIER_ROUTES.some(r => pathname.startsWith(r)) && !['supplier', 'admin'].includes(role)) {
      return NextResponse.redirect(new URL('/account', req.url))
    }
  }

  return res
}

export const config = {
  // Run on every page so maintenance mode can gate public routes too, while
  // skipping static assets, API routes and Next internals.
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico|.*\\..*).*)'],
}
