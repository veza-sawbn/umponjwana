import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// The public field guide (app/field-guide/[slug]/page.tsx) is ISR-cached for
// an hour, so without this a Publish in the console wouldn't reach visitors
// until that cache window happened to expire — which reads, correctly, as
// "publishing does nothing". Called (best-effort, fire-and-forget) from
// lib/field-guide.ts right after a publish or unpublish succeeds, so the
// change is live on the very next visitor request.
//
// Same shape and same reasoning as /api/revalidate/activity: authorization
// matters even though the endpoint "only" busts a cache, because left open
// anyone could hammer it for a published slug and force Vercel to keep
// regenerating the page and Supabase to keep re-reading it, defeating the
// cache entirely. Only a platform admin — the same set RLS lets write to
// vd_field_guide_pages — may trigger a revalidation.
export async function POST(req: Request) {
  let body: { slug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { slug } = body
  // Mirrors the slug column's own shape (lib/slugify.ts). Rejecting anything
  // else keeps a caller from steering revalidatePath at an unrelated route
  // via a crafted "slug" containing path separators.
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'valid slug required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  revalidatePath(`/field-guide/${slug}`)
  // Also bust the whole dynamic segment. Page settings can rename a slug, and
  // the publish that follows only knows the new one — without this the old
  // URL would keep serving the previous composition from cache for an hour.
  revalidatePath('/field-guide/[slug]', 'page')
  revalidatePath('/field-guide')
  return NextResponse.json({ revalidated: true })
}
