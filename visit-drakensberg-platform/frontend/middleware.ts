import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/checkout', '/supplier', '/admin', '/account', '/operations']
const ADMIN_ROUTES = ['/admin']
const SUPPLIER_ROUTES = ['/supplier']
// The VD Operations working environment. Distinct from /admin: an operations
// employee holds delegated authority over specific suppliers, not platform
// administration, so this area is gated on ops_role rather than the admin role.
const OPERATIONS_ROUTES = ['/operations']
// Routes that must stay reachable even while maintenance mode is on — the
// admin/supplier consoles (per the settings toggle's own description), the
// auth flow (needed to sign in and reach those consoles), the maintenance
// page itself (avoid rewriting it into a loop), and customer-facing
// invoices/quotes (RLS-gated per document, not part of the public site the
// toggle is meant to hide).
const MAINTENANCE_EXEMPT_ROUTES = ['/admin', '/supplier', '/operations', '/auth', '/maintenance', '/invoices', '/quotes']

export async function middleware(req: NextRequest) {
  // `res` must be passed through so auth-helpers can refresh the session cookie.
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const pathname = req.nextUrl.pathname

  // Forwards refreshed auth cookies onto a redirect so the session isn't lost.
  const redirectTo = (path: string, status = 302) => {
    const redirect = NextResponse.redirect(new URL(path, req.url), { status })
    res.headers.getSetCookie().forEach(cookie => {
      redirect.headers.append('Set-Cookie', cookie)
    })
    return redirect
  }

  // ── Admin redirects (Tool 11) ──────────────────────────────────────────────
  // Only apply to public GET requests that don't start with a protected or
  // admin-controlled prefix — those paths are handled by auth guards below.
  // Protected paths are already exempt from this check, and we avoid shadowing
  // the auth/maintenance machinery.
  const SKIP_REDIRECT_PREFIXES = ['/admin', '/supplier', '/operations', '/auth', '/api', '/_next']
  const isPublicPath = req.method === 'GET' && !SKIP_REDIRECT_PREFIXES.some(p => pathname.startsWith(p))

  if (isPublicPath) {
    try {
      const { data: rData } = await supabase
        .from('site_content')
        .select('value')
        .eq('key', 'admin_redirects')
        .maybeSingle()

      if (Array.isArray(rData?.value?.items)) {
        type RItem = { id: string; from: string; to: string; statusCode: number }
        const items = rData.value.items as RItem[]
        const match = items.find((r: RItem) => r.from === pathname)
        if (match) {
          const target = match.to.startsWith('http')
            ? match.to
            : new URL(match.to, req.url).toString()
          return NextResponse.redirect(target, { status: match.statusCode ?? 301 })
        }
      }
    } catch {
      // redirect lookup must never block the request
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Always call getSession so the helper has a chance to refresh the token and
  // write updated Set-Cookie headers onto `res`.
  const { data: { session } } = await supabase.auth.getSession()

  let role: string | undefined
  let staffRole: string | undefined
  if (session) {
    // Prefer app_metadata.role (only settable server-side) over
    // user_metadata.role, which a user can edit on their own account via
    // supabase.auth.updateUser. Roles should be assigned in app_metadata.
    role = session.user.app_metadata?.role ?? session.user.user_metadata?.role
    staffRole = session.user.app_metadata?.staff_role ?? session.user.user_metadata?.staff_role
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
  }
  // Finance/operations collaborators (role stays 'visitor', staff_role set)
  // get into the console too — individual pages and RLS scope what they
  // can actually see, same as is_finance()/is_ops() do at the DB level.
  const isStaff = role === 'admin' || staffRole === 'finance' || staffRole === 'operations'

  // Maintenance mode hides the site from the public, not from the people
  // working on it. Staff keep browsing every route — the visual editor at
  // /admin/editor previews public pages (/, /stays, /hikes …) in an iframe, so
  // gating those would break editing exactly when the site is closed for it.
  // The bypass is tied to the staff role rather than to the editor's ?edit=1
  // marker, which any visitor could append to a URL.
  if (!isStaff && !MAINTENANCE_EXEMPT_ROUTES.some(r => pathname.startsWith(r))) {
    const { data: platformSettings } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'platform_settings')
      .maybeSingle()
    if (platformSettings?.value?.maintenance_mode) {
      return redirectTo('/maintenance')
    }
  }

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
    if (ADMIN_ROUTES.some(r => pathname.startsWith(r)) && !isStaff) {
      return redirectTo('/account')
    }

    // Operations employees don't belong in the admin console at all — send any
    // /admin visit to their own environment. This covers the post-invite
    // landing (redirectTo was set to /admin) as well as direct visits.
    // Full platform admins are not redirected — they use the whole console.
    if (ADMIN_ROUTES.some(r => pathname.startsWith(r)) && staffRole === 'operations' && role !== 'admin') {
      return redirectTo('/operations')
    }

    // /operations is for configured VD Operations employees. Platform admins
    // may look in (they manage the layer), but nobody else gets past here.
    // The environment itself re-checks ops_role client-side, and every query
    // is gated by RLS — this is the coarse routing guard only.
    if (OPERATIONS_ROUTES.some(r => pathname.startsWith(r))) {
      if (role !== 'admin' && staffRole !== 'operations') {
        return redirectTo('/account')
      }
    }

    // Supplier routes: normal suppliers and admins get unconditional access.
    // VD Operations employees (staff_role='operations' with ops_role set) may
    // also enter supplier routes IF they have at least one active management
    // assignment — the DB-level RLS policies verify the specific supplier they
    // are trying to access, so URL manipulation still cannot bypass security.
    if (SUPPLIER_ROUTES.some(r => pathname.startsWith(r))) {
      const isSupplierOrAdmin = ['supplier', 'admin'].includes(role as string)
      const isOpsWithAssignments =
        staffRole === 'operations' &&
        !isSupplierOrAdmin // avoid a redundant DB query for normal suppliers

      if (!isSupplierOrAdmin && !isOpsWithAssignments) {
        return redirectTo('/account')
      }

      if (isOpsWithAssignments) {
        // Verify the employee has at least one active assignment. This is a
        // lightweight check — the heavy per-supplier RLS is in the DB itself.
        // We fetch ops_role here to confirm they are a VD ops employee, not just
        // any user with staff_role='operations' that predates the ops system.
        // ops_role and organisation were added by the delegated-management migration.
        // If those columns don't exist yet (42703), treat the employee as having
        // no ops access rather than crashing the middleware.
        const { data: opsProfile, error: opsProfileError } = await supabase
          .from('profiles')
          .select('ops_role, organisation')
          .eq('id', session.user.id)
          .maybeSingle()

        if (opsProfileError || !opsProfile?.ops_role || opsProfile.organisation !== 'vd_operations') {
          // Either migration not yet applied, or legacy operations collaborator
          return redirectTo('/account')
        }

        const { data: assignments } = await supabase
          .from('vd_ops_assignments')
          .select('id')
          .eq('employee_id', session.user.id)
          .eq('is_active', true)
          .limit(1)

        if (!assignments || assignments.length === 0) {
          // No active assignments → no supplier tool access
          return redirectTo('/operations')
        }

        // Pass the ops context as a response header so the supplier layout can
        // detect it without an extra DB round-trip. The actual data is fetched
        // client-side with proper auth; this is just a routing hint.
        res.headers.set('x-vd-ops-context', '1')
      }
    }
  }

  return res
}

export const config = {
  // Run on every page so maintenance mode can gate public routes too, while
  // skipping static assets, API routes and Next internals.
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico|.*\\..*).*)'],
}
