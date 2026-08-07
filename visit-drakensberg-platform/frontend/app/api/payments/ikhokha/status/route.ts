import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { isIkhokhaConfigured } from '@/lib/ikhokha'
import { siteOrigin } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

// Read-only health of the card-payment setup, for the Settings console.
//
// Whether the site is taking real money or pretend money is decided entirely
// by env vars on the host — nothing in the database, nothing in the product.
// That means the one question that matters ("are we live?") had no answer
// short of reading the Vercel dashboard, and a site quietly stuck in test
// mode looks exactly like a working one right up until you check the bank.
//
// Reports presence and mode only. No secret is returned, at any point, to
// anyone: the app key signs every request to iKhokha and must never leave
// the server.
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Same staff test the database uses everywhere else, rather than a second
  // definition of "staff" that can drift from it.
  const { data: isOps } = await supabase.rpc('is_ops')
  if (!isOps) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Anything but the exact string 'live' is test — mirroring lib/ikhokha.ts,
  // so a typo shows here as "test" rather than being reported as live.
  const mode = process.env.IKHOKHA_MODE?.trim() === 'live' ? 'live' : 'test'

  return NextResponse.json({
    configured: isIkhokhaConfigured(),
    mode,
    rawMode: process.env.IKHOKHA_MODE?.trim() || null,
    hasEntityId: !!process.env.IKHOKHA_ENTITY_ID?.trim(),
    hasExternalEntityId: !!process.env.IKHOKHA_EXTERNAL_ENTITY_ID?.trim(),
    siteUrlSet: !!process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    // The origin every invoice link and payment callback is actually built
    // from, after normalising — which is where a scheme-less or stale
    // NEXT_PUBLIC_SITE_URL becomes visible instead of silently breaking
    // reconciliation.
    origin: siteOrigin(),
  })
}
