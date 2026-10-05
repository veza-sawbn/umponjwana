import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'

// Proxy /api/backend/* requests to the legacy FastAPI backend, bypassing
// browser CORS. Usage: fetch('/api/backend/api/v1/listings').
//
// WHAT THE AUDIT FOUND (M3)
//   This route accepted five methods on any path with NO authentication at
//   all, copied the caller's Authorization header through to the upstream, and
//   returned the resolved upstream URL plus the raw error text on failure.
//
//   The upstream base is env-derived, so this was never arbitrary-host SSRF.
//   The problem was what the env could be: NEXT_PUBLIC_API_URL is one of the
//   fallbacks, and the repository's own root .env.example sets that variable
//   to the SUPABASE REST ENDPOINT (https://…supabase.co/rest/v1/). Configured
//   that way, this route is an unauthenticated relay to PostgREST that
//   forwards a caller-supplied Authorization header — an open front door to
//   the database API, from the application's own trusted origin.
//
//   Three things changed:
//     1. A session is required. Every legitimate caller is an admin page.
//     2. The upstream must look like the FastAPI backend, not like Supabase or
//        anything else that happens to be in the env.
//     3. Errors no longer echo the upstream URL or the raw exception.
//   Plus a rate limit, since a 45-second timeout with no concurrency cap is a
//   cheap way to tie up serverless capacity.

const BACKEND_BASE = (
  process.env.RENDER_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://drakensberg-backend.onrender.com'
).replace(/\/+$/, '')

/**
 * Is the configured base actually the FastAPI backend?
 *
 * Refuses a Supabase host outright: whatever NEXT_PUBLIC_API_URL is set to,
 * this proxy must never become a credential-forwarding relay to PostgREST.
 */
function backendBaseIsUsable(): boolean {
  try {
    const url = new URL(BACKEND_BASE)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return false
    if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return false
    return true
  } catch {
    return false
  }
}

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const limit = await rateLimit('backendProxy', callerKey(req))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  // Every legitimate caller of this proxy is a signed-in admin page. Requiring
  // a session costs those pages nothing and closes the endpoint to the world.
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!backendBaseIsUsable()) {
    console.error('[backend proxy] refusing to proxy: BACKEND_BASE is not a usable backend host')
    return NextResponse.json({ error: 'The backend is not configured.' }, { status: 503 })
  }

  // Segments come from the catch-all route, so they cannot contain a raw '/',
  // but an encoded one would let a crafted path climb out of the intended
  // prefix once the upstream decodes it. Re-encode each segment.
  const path = params.path.map(encodeURIComponent).join('/')
  const search = req.nextUrl.search
  const upstreamUrl = `${BACKEND_BASE}/${path}${search}`

  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const auth = req.headers.get('authorization')
  if (auth) headers.set('authorization', auth)

  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer()
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      // Render's free tier can cold-start slowly; admin pages make several
      // concurrent requests, so keep the proxy patient instead of surfacing 502s.
      signal: AbortSignal.timeout(45_000),
    })

    const responseHeaders = new Headers()
    responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json')

    const data = await upstream.arrayBuffer()
    return new NextResponse(data, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (err) {
    // The upstream URL and the raw exception used to be returned to the
    // caller, publishing internal hostnames and infrastructure detail. They go
    // to the function log instead.
    console.error('[backend proxy] upstream request failed', { upstreamUrl, err })
    return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 })
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
