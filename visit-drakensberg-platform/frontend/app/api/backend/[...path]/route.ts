import { NextRequest, NextResponse } from 'next/server'

// Proxy all /api/backend/* requests to the Render backend, bypassing browser CORS.
// Usage: fetch('/api/backend/listings/1/availability') instead of fetching the Render URL directly.

const RENDER_BASE = process.env.RENDER_API_URL || 'https://visit-drakensberg.onrender.com/api/v1'

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/')
  const search = req.nextUrl.search
  const upstreamUrl = `${RENDER_BASE}/${path}${search}`

  const headers = new Headers()
  // Forward content-type and auth headers if present.
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
      // Render's free tier can be slow to cold-start; allow up to 10 s.
      signal: AbortSignal.timeout(10_000),
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
      { error: 'Upstream request failed', detail: String(err) },
      { status: 502 }
    )
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
