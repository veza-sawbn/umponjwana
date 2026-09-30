import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// The public tour page (app/tours/[id]/page.tsx) is ISR-cached for up to 5
// minutes, same as activities and stays — so a supplier's price/itinerary
// edit doesn't reach visitors until the cache naturally expires. Called
// (best-effort, fire-and-forget) from lib/tours.ts right after a supplier
// creates/edits a tour. Mirrors app/api/revalidate/activity/route.ts
// exactly, including the authorization rationale in its header comment.
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
    .eq('kind', 'tour')
    .eq('id', id)
    .maybeSingle()
  if (!entity?.owner_id) return NextResponse.json({ error: 'not found' }, { status: 404 })

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

  if (typeof slug === 'string' && slug && slug !== id) revalidatePath(`/tours/${slug}`)
  revalidatePath(`/tours/${id}`)
  revalidatePath('/tours/[id]', 'page')
  revalidatePath('/tours')
  return NextResponse.json({ revalidated: true })
}
