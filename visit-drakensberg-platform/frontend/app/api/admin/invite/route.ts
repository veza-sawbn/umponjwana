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

  const { data, error } = await supabaseAdmin().auth.admin.inviteUserByEmail(email, {
    data: { full_name: body.fullName || '', role, staff_role: staffRole },
    redirectTo: `${origin}/admin`,
  })
  if (error) {
    console.error('[invite] failed:', error)
    return NextResponse.json({ error: error.message || 'Could not send invite' }, { status: 500 })
  }

  return NextResponse.json({ userId: data.user?.id })
}
