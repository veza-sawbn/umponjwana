import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { EMAIL_STARTERS } from '@/lib/email-starters'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

// Serves the campaign builder's starting points. lib/email-starters.ts builds
// them from lib/email-layout.ts's blocks, both of which are SERVER ONLY, so
// the admin form fetches this rather than importing either — the same shape as
// the live preview at app/api/admin/campaigns/preview.
//
// Admin-gated like every other app/api/admin/* route. Nothing is read from or
// written to the database here; the gate is about who gets to see the house
// editorial templates, not about data access.
export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  const origin = getSiteOrigin(req)
  return NextResponse.json({
    starters: EMAIL_STARTERS.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      subject: s.subject,
      preheader: s.preheader,
      heroAlt: s.heroAlt,
      htmlBody: s.build(origin),
    })),
  })
}
