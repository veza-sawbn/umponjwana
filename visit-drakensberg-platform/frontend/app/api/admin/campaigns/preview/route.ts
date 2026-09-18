import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { emailShell } from '@/lib/email-layout'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

// Renders a campaign template through the same branded shell every
// transactional email uses (lib/email-layout.ts is SERVER ONLY, so this is
// the route the admin campaign builder's live preview fetches instead of
// importing it into a client component). Admin-gated like the other
// app/api/admin/* routes even though it only renders caller-supplied
// strings — no data read or written.
//
// The footer is always the MARKETING one here, and that is not a preference:
// a campaign's audience is resolved by intersecting with marketing_consent
// (see supabase/migrations/20260825_email_campaign_foundation.sql), so
// everything composed in this builder is promotional and owes its reader a
// postal address, a preferences link and a working unsubscribe. Previewing a
// campaign inside the transactional "this is an automated message, do not
// reply" shell would show the admin a footer the real send must never use.
//
// EMAIL_POSTAL_ADDRESS is read from the environment rather than hardcoded so
// nobody ships a guessed address; when it is unset the address line is simply
// omitted, which is visible in the preview and is the point.
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  let body: {
    subject?: string; preheader?: string; htmlBody?: string
    heroImageUrl?: string; heroImageAlt?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const origin = getSiteOrigin(req)
  const heroSrc = body.heroImageUrl?.trim()
  const html = emailShell({
    origin,
    heading: body.subject?.trim() || '(No subject)',
    preheader: body.preheader,
    bodyHtml: body.htmlBody || '<p>(Empty)</p>',
    hero: heroSrc ? { src: heroSrc, alt: body.heroImageAlt?.trim() || '' } : undefined,
    // A real send would carry the campaign's own view-online URL; the preview
    // is already the email on screen, so the link would point at itself.
    footer: {
      variant: 'marketing',
      postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
    },
  })
  return NextResponse.json({ html })
}
