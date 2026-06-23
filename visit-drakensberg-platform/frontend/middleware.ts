import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/checkout', '/supplier', '/admin', '/account']
const ADMIN_ROUTES = ['/admin']
const SUPPLIER_ROUTES = ['/supplier']

export async function middleware(req: NextRequest) {
  // `res` must be passed through so auth-helpers can refresh the session cookie.
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Always call getSession so the helper has a chance to refresh the token and
  // write updated Set-Cookie headers onto `res`.
  const { data: { session } } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname
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
    const role = session.user.user_metadata?.role ?? 'visitor'
    if (ADMIN_ROUTES.some(r => pathname.startsWith(r)) && role !== 'admin') {
      return NextResponse.redirect(new URL('/account', req.url))
    }
    if (SUPPLIER_ROUTES.some(r => pathname.startsWith(r)) && !['supplier', 'admin'].includes(role)) {
      return NextResponse.redirect(new URL('/account', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/checkout/:path*',
    '/supplier/:path*',
    '/admin/:path*',
    '/account/:path*',
  ],
}
