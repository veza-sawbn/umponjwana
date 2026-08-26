import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// The public activity page (app/activities/[id]/page.tsx) is ISR-cached for
// up to 5 minutes so a supplier's price/timeslot edit doesn't reach visitors
// until the cache naturally expires. Called (best-effort, fire-and-forget)
// from lib/activities.ts right after a supplier creates/edits an activity,
// so the change is visible on the very next visitor request instead of
// waiting out the cache window.
//
// Authorization matters here even though the endpoint "only" busts a cache:
// left open, anyone could repeatedly hit it for a popular activity's id and
// force Vercel to keep regenerating that page and Supabase to keep re-reading
// it, defeating the whole point of the cache. Only the activity's own
// supplier — or an admin / ops agent managing them, the same set RLS already
// lets write to it — may trigger a revalidation for it.
export async function POST(req: Request) {
  let body: { id?: string; slug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const { id, slug } = body
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: entity } = await supabase
    .from('vd_entities')
    .select('owner_id')
    .eq('kind', 'activity')
    .eq('id', id)
    .maybeSingle()
  if (!entity?.owner_id) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Public read RLS on vd_entities means this select can succeed for any
  // live activity regardless of who's asking — the ownership/role checks
  // below are the actual gate, not the row being visible at all.
  let authorized = entity.owner_id === user.id
  if (!authorized) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    authorized = profile?.role === 'admin'
  }
  if (!authorized) {
    const { data: managed } = await supabase.rpc('is_managed_supplier', { p_supplier_id: entity.owner_id })
    authorized = !!managed
  }
  if (!authorized) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (typeof slug === 'string' && slug && slug !== id) revalidatePath(`/activities/${slug}`)
  revalidatePath(`/activities/${id}`)
  revalidatePath('/activities')
  return NextResponse.json({ revalidated: true })
}
