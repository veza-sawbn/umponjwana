import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Invites a new collaborator by email using Supabase Auth's built-in invite
// flow (requires SMTP to be configured on the Supabase project — without it,
// the auth user is still created but no email goes out).
export async function POST(req: Request) {
  let body: { email?: string; fullName?: string; level?: 'admin' | 'finance' | 'operations' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }
  if (!body.level || !['admin', 'finance', 'operations'].includes(body.level)) {
    return NextResponse.json({ error: 'A collaborator level is required.' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  const role = body.level === 'admin' ? 'admin' : 'visitor'
  const staffRole = body.level === 'finance' || body.level === 'operations' ? body.level : null
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin

  // The invite itself carries only the name. Privileged fields never travel in
  // `data` (user_metadata) — the signup trigger ignores a role from there,
  // because user_metadata is writable by anyone holding the public anon key.
  // See 20260809_signup_role_hardening.sql.
  const { data, error } = await supabaseAdmin().auth.admin.inviteUserByEmail(email, {
    data: { full_name: body.fullName || '' },
    redirectTo: `${origin}/admin`,
  })
  if (error) {
    console.error('[invite] failed:', error)
    return NextResponse.json({ error: error.message || 'Could not send invite' }, { status: 500 })
  }

  const userId = data.user?.id
  if (!userId) return NextResponse.json({ error: 'Invite created no user' }, { status: 500 })

  // inviteUserByEmail forwards only { email, data } to GoTrue, so app_metadata
  // cannot ride along with it — and the signup trigger has already run by the
  // time this returns, landing the invitee as a plain visitor. Grant the level
  // in the two places that matter: app_metadata (what the JWT and middleware
  // read, service-role only) and profiles (what RLS reads, via the admin RPCs
  // the caller's own session is entitled to call).
  const { error: metaError } = await supabaseAdmin().auth.admin.updateUserById(userId, {
    app_metadata: { role, staff_role: staffRole },
  })
  if (metaError) {
    console.error('[invite] app_metadata grant failed:', metaError)
    return NextResponse.json({ error: 'Invited, but the access level could not be granted.' }, { status: 500 })
  }

  const { error: roleError } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role })
  if (roleError) {
    console.error('[invite] role grant failed:', roleError)
    return NextResponse.json({ error: 'Invited, but the access level could not be granted.' }, { status: 500 })
  }

  const { error: staffError } = await supabase.rpc('admin_set_staff_role', { p_user: userId, p_staff_role: staffRole })
  if (staffError) {
    console.error('[invite] staff role grant failed:', staffError)
    return NextResponse.json({ error: 'Invited, but the access level could not be granted.' }, { status: 500 })
  }

  return NextResponse.json({ userId })
}
