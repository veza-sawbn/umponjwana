import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// Covers both public pages under /guides — the operator company profile
// (app/guides/operators/[id]/page.tsx, kind='operator_profile') and an
// individual guide's profile (app/guides/[id]/page.tsx, kind=
// 'supplier_guides') — both ISR-cached for up to 30 minutes. Called
// (best-effort, fire-and-forget) from lib/operators.ts's
// saveOperatorProfile() and from the supplier guide create/edit/delete
// handlers (app/supplier/guides/**), which write straight to
// addSupplierEntity/updateSupplierEntity/deleteSupplierEntity with no lib
// wrapper of their own to hook into. Mirrors app/api/revalidate/activity/
// route.ts, including the authorization rationale in its header comment.
export async function POST(req: Request) {
  let body: { kind?: 'operator' | 'guide'; id?: string; slug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const { kind, id, slug } = body
  if (kind !== 'operator' && kind !== 'guide') {
    return NextResponse.json({ error: 'kind must be "operator" or "guide"' }, { status: 400 })
  }
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  const vdKind = kind === 'operator' ? 'operator_profile' : 'supplier_guides'
  const basePath = kind === 'operator' ? '/guides/operators' : '/guides'

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: entity } = await supabase
    .from('vd_entities')
    .select('owner_id')
    .eq('kind', vdKind)
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

  if (typeof slug === 'string' && slug && slug !== id) revalidatePath(`${basePath}/${slug}`)
  revalidatePath(`${basePath}/${id}`)
  revalidatePath(`${basePath}/[id]`, 'page')
  revalidatePath('/guides')
  return NextResponse.json({ revalidated: true })
}
