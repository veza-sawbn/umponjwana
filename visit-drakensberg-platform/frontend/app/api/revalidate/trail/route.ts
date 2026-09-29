import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// The public trail page (app/hikes/[id]/page.tsx) is ISR-cached for 30
// minutes. Trails live in a single `site_content` row (lib/trails.ts's
// saveTrails — the whole collection is one JSON blob, not per-row
// vd_entities), written wholesale from two different admin screens
// (app/admin/trails/page.tsx, app/admin/seo/related/page.tsx) that don't
// necessarily know which single trail changed within the array — so unlike
// region/town/reserve, this busts the whole dynamic segment rather than one
// slug. Called (best-effort, fire-and-forget) from saveTrails() itself.
// Admin-only, same shape as app/api/revalidate/field-guide/route.ts.
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  revalidatePath('/hikes/[id]', 'page')
  revalidatePath('/hikes')
  return NextResponse.json({ revalidated: true })
}
