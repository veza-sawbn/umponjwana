import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// The public stay page (app/stays/[id]/page.tsx) is ISR-cached for up to 5
// minutes, same as activities — so a supplier's property or room edit
// (price, name, amenities, photos, ...) doesn't reach visitors until the
// cache naturally expires. Called (best-effort, fire-and-forget) from
// lib/properties.ts and lib/rooms.ts right after a supplier creates/edits a
// property or one of its rooms, so the change is visible on the very next
// visitor request instead of waiting out the cache window. Mirrors
// app/api/revalidate/activity/route.ts exactly, including the authorization
// rationale in its header comment.
//
// Always takes the *property* id — a room has no page of its own, its
// price/details render on its parent property's /stays/[id] page — and
// resolves the property's slug itself so callers editing a room (which
// don't have the property's slug close at hand) don't need an extra fetch
// just to bust the cache.
export async function POST(req: Request) {
  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const { id } = body
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: entity } = await supabase
    .from('vd_entities')
    .select('owner_id, slug:value->>slug')
    .eq('kind', 'property')
    .eq('id', id)
    .maybeSingle()
  if (!entity?.owner_id) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Public read RLS on vd_entities means this select can succeed for any
  // live property regardless of who's asking — the ownership/role checks
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

  const slug = entity.slug as string | null
  if (slug && slug !== id) revalidatePath(`/stays/${slug}`)
  revalidatePath(`/stays/${id}`)
  revalidatePath('/stays')
  return NextResponse.json({ revalidated: true })
}
