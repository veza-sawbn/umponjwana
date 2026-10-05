import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// The public package page (app/packages/[id]/page.tsx) is ISR-cached for up
// to 5 minutes, so an admin's edit (packages are admin-curated — see
// lib/packages.ts's header comment, "Suppliers cannot create packages")
// wouldn't reach visitors until that cache window happened to expire.
// Called (best-effort, fire-and-forget) from lib/packages.ts right after a
// create/edit/delete. Admin-only, same shape as
// app/api/revalidate/field-guide/route.ts — no owner_id check needed since
// there is no non-admin owner for this kind.
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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (typeof slug === 'string' && slug && slug !== id) revalidatePath(`/packages/${slug}`)
  revalidatePath(`/packages/${id}`)
  revalidatePath('/packages/[id]', 'page')
  revalidatePath('/packages')
  return NextResponse.json({ revalidated: true })
}
