import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Changes a collaborator's access level. Updates profiles.role/staff_role
// (the source of truth for RLS) via the caller's own admin session AND the
// user's auth metadata (what middleware reads from the JWT) — without the
// second part, a promoted/demoted collaborator would keep their old access
// until they next log out and back in.
export async function POST(req: Request) {
  let body: { userId?: string; level?: 'admin' | 'finance' | 'operations' | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  const role = body.level === 'admin' ? 'admin' : 'visitor'
  const staffRole = body.level === 'finance' || body.level === 'operations' ? body.level : null

  const { error: roleError } = await supabase.rpc('admin_set_role', { p_user: body.userId, p_role: role })
  if (roleError) return NextResponse.json({ error: roleError.message || 'Could not update role' }, { status: 400 })

  const { error: staffError } = await supabase.rpc('admin_set_staff_role', { p_user: body.userId, p_staff_role: staffRole })
  if (staffError) return NextResponse.json({ error: staffError.message || 'Could not update staff role' }, { status: 400 })

  // app_metadata, not user_metadata: the user can rewrite their own
  // user_metadata via auth.updateUser, so a level stored there would be a
  // level they could grant themselves. app_metadata is service-role only.
  // Any role/staff_role left in user_metadata by the old code is now inert —
  // neither the signup trigger nor the middleware reads it any more.
  const { data: existing } = await supabaseAdmin().auth.admin.getUserById(body.userId)
  const { error: metaError } = await supabaseAdmin().auth.admin.updateUserById(body.userId, {
    app_metadata: { ...existing?.user?.app_metadata, role, staff_role: staffRole },
  })
  if (metaError) {
    // profiles/RLS already reflect the change — this only means the user's
    // current session won't see it until they next log in.
    console.error('[set-level] auth metadata sync failed:', metaError)
  }

  return NextResponse.json({ ok: true })
}
