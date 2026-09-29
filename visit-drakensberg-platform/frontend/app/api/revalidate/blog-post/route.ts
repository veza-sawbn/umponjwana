import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// The public blog page (app/mydrakensberg/[slug]/page.tsx) is ISR-cached
// for an hour, so an admin's edit wouldn't reach visitors until that cache
// window happened to expire. Called (best-effort, fire-and-forget) from
// lib/blog-posts.ts right after a publish/edit/status-change/delete.
// blog_posts is its own dedicated table (not vd_entities or site_content),
// admin-only — same admin-only shape as
// app/api/revalidate/field-guide/route.ts, no per-item ownership to check.
export async function POST(req: Request) {
  let body: { slug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { slug } = body
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'valid slug required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  revalidatePath(`/mydrakensberg/${slug}`)
  revalidatePath('/mydrakensberg/[slug]', 'page')
  revalidatePath('/mydrakensberg')
  return NextResponse.json({ revalidated: true })
}
