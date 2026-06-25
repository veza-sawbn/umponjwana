import { NextRequest, NextResponse } from 'next/server'

// Proxy all /api/backend/* requests to the backend, bypassing browser CORS.
// Usage: fetch('/api/backend/api/v1/listings') and the full path is forwarded.
const BACKEND_BASE = (
  process.env.RENDER_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'https://drakensberg-backend.onrender.com'
).replace(/\/+$/, '')

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/')
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
    return NextResponse.json(
      {
        error: 'Upstream request failed',
        upstream: upstreamUrl,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    )
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
