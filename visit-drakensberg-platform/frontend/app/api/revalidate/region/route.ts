import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const SEASONS = ['summer', 'autumn', 'winter', 'spring']

// Two public pages depend on this content: app/regions/[slug]/page.tsx
// (ISR: 1 hour) and app/regions/[slug]/[season]/page.tsx (ISR: 15 minutes,
// one path per season). Regions live in a single `site_content` row (see
// lib/regions.ts's saveRegions — the whole collection is one JSON blob, not
// per-row vd_entities), so there is no per-item ownership to check: any
// admin editing any region is authorized, matching the write path's own
// RLS on site_content. Called (best-effort, fire-and-forget) from
// createRegion/updateRegion/deleteRegion. Same admin-only shape as
// app/api/revalidate/field-guide/route.ts.
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

  revalidatePath(`/regions/${slug}`)
  revalidatePath('/regions/[slug]', 'page')
  for (const season of SEASONS) revalidatePath(`/regions/${slug}/${season}`)
  revalidatePath('/regions/[slug]/[season]', 'page')
  revalidatePath('/regions')
  return NextResponse.json({ revalidated: true })
}
