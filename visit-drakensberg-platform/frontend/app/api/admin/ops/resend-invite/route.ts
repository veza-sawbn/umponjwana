import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/ops/resend-invite
 *
 * Resends an invite or setup link to a VD Operations employee.
 *
 * Two cases:
 *  - email_confirmed_at is null  → user never accepted their invite.
 *    Re-calls inviteUserByEmail with the same ops metadata; Supabase
 *    regenerates the invite token and resends the invite email.
 *
 *  - email_confirmed_at is set   → user accepted the invite but may not
 *    have completed password / account setup. Sends a password-reset link
 *    via the same /auth/reset-password route so they can set (or reset)
 *    their password and sign in.
 *
 * The redirectTo in both cases points to /auth/reset-password, which is
 * already in Supabase's allowed redirect URL list and correctly handles
 * both SIGNED_IN (invite) and PASSWORD_RECOVERY events.
 */
export async function POST(req: Request) {
  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // Auth check: caller must be a platform admin
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const admin = supabaseAdmin()

  // Fetch the target user so we know their confirmation status and metadata
  const { data: targetData, error: getUserError } = await admin.auth.admin.getUserById(body.userId)
  if (getUserError || !targetData?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { email, email_confirmed_at, user_metadata, app_metadata } = targetData.user

  if (!email) {
    return NextResponse.json({ error: 'User has no email address' }, { status: 400 })
  }

  // Reconstruct ops metadata from whatever is stored in app_metadata or user_metadata.
  // app_metadata takes precedence since it is server-set.
  const opsRole = app_metadata?.ops_role ?? user_metadata?.ops_role
  const staffRole = app_metadata?.staff_role ?? user_metadata?.staff_role ?? 'operations'
  const organisation = app_metadata?.organisation ?? user_metadata?.organisation ?? 'vd_operations'
  const fullName = app_metadata?.full_name ?? user_metadata?.full_name ?? ''

  const redirectTo = `${origin}/auth/reset-password`

  if (!email_confirmed_at) {
    // ── Unconfirmed: resend invite email ─────────────────────────────────────
    // inviteUserByEmail for an existing unconfirmed user regenerates the token
    // and triggers a new invite email from Supabase.
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        role: 'visitor',
        staff_role: staffRole,
        ops_role: opsRole,
        organisation,
      },
      redirectTo,
    })
    if (error) {
      console.error('[ops/resend-invite] invite error:', error)
      return NextResponse.json({ error: error.message || 'Could not resend invite' }, { status: 500 })
    }
    return NextResponse.json({ type: 'invite_resent' })
  } else {
    // ── Confirmed: send password-reset / account-setup link ──────────────────
    // The employee accepted the invite but may have lost or never set a password.
    // resetPasswordForEmail sends a recovery email through Supabase's email service.
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      console.error('[ops/resend-invite] reset error:', error)
      return NextResponse.json({ error: error.message || 'Could not send setup email' }, { status: 500 })
    }
    return NextResponse.json({ type: 'reset_sent' })
  }
}
