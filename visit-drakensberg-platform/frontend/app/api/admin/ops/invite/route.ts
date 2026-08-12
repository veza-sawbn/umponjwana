import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { OpsRole } from '@/lib/ops-assignments'

export const dynamic = 'force-dynamic'

const VALID_OPS_ROLES: OpsRole[] = [
  'reservation_agent',
  'reservations_manager',
  'asset_manager',
  'ops_administrator',
]

/**
 * POST /api/admin/ops/invite
 * Invite a new VD Operations employee by email.
 * - Creates a Supabase Auth user via admin.inviteUserByEmail
 * - Seeds ops_role, organisation='vd_operations', and staff_role='operations'
 *   into the user metadata so handle_new_user() can pick them up on first login
 * - The resulting profile.staff_role = 'operations' means the existing
 *   is_ops() / middleware checks still work without modification
 */
export async function POST(req: Request) {
  let body: {
    email?: string
    fullName?: string
    opsRole?: OpsRole
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }
  if (!body.opsRole || !VALID_OPS_ROLES.includes(body.opsRole)) {
    return NextResponse.json({ error: 'A valid operational role is required.' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin

  // Invite the user with ops metadata. handle_new_user() will seed these into
  // profiles.ops_role, profiles.organisation, and profiles.staff_role.
  const { data, error } = await supabaseAdmin().auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: body.fullName || '',
      role: 'visitor',                  // not a supplier; not a platform admin
      staff_role: 'operations',         // grants is_ops() / admin console access
      ops_role: body.opsRole,           // granular operational role
      organisation: 'vd_operations',   // VD internal organisation
    },
    // Redirect to /auth/reset-password — confirmed in Supabase's allowed redirect
    // URL list (the same URL the forgot-password flow uses). Supabase delivers the
    // invite token in the URL hash; the reset-password page listens for SIGNED_IN,
    // shows the password-creation form, and redirects to /auth/login when done.
    // The login page then routes ops employees (staff_role='operations') to /admin,
    // and middleware redirects /admin → /admin/operations/managed-suppliers.
    redirectTo: `${origin}/auth/reset-password`,
  })

  if (error) {
    console.error('[ops/invite] failed:', error)
    return NextResponse.json({ error: error.message || 'Could not send invite' }, { status: 500 })
  }

  return NextResponse.json({ userId: data.user?.id })
}
