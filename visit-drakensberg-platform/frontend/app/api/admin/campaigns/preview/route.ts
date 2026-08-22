import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { emailShell } from '@/lib/email-layout'

export const dynamic = 'force-dynamic'

// Renders a campaign template through the same branded shell every
// transactional email uses (lib/email-layout.ts is SERVER ONLY, so this is
// the route the admin campaign builder's live preview fetches instead of
// importing it into a client component). Admin-gated like the other
// app/api/admin/* routes even though it only renders caller-supplied
// strings — no data read or written.
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  let body: { subject?: string; preheader?: string; htmlBody?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const html = emailShell({
    origin,
    heading: body.subject?.trim() || '(No subject)',
    preheader: body.preheader,
    bodyHtml: body.htmlBody || '<p>(Empty)</p>',
  })
  return NextResponse.json({ html })
}
