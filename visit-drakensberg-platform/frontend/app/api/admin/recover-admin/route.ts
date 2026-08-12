import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/recover-admin
 *
 * Emergency recovery endpoint for the platform admin account.
 *
 * USE CASE
 *   The admin account (e.g. zumaveza@gmail.com) cannot log in because:
 *     a) The password reset email link was broken (incorrect redirectTo URL),
 *        so the account password was never set or is unknown.
 *     b) Fixing the reset link (via /api/auth/request-password-reset) requires
 *        a working email, which may also need to be verified.
 *
 *   This endpoint lets a server operator directly set a new password for the
 *   admin account by supplying the ADMIN_RECOVERY_SECRET env var as a Bearer
 *   token. Once the admin can log in again, rotate ADMIN_RECOVERY_SECRET.
 *
 * SECURITY
 *   - Requires `Authorization: Bearer <ADMIN_RECOVERY_SECRET>` header.
 *   - ADMIN_RECOVERY_SECRET must be a strong random string (≥32 chars).
 *   - Set ADMIN_RECOVERY_SECRET to a new value (or remove it) after use.
 *   - Only operates on the exact email address provided in the request body —
 *     cannot be used to change arbitrary accounts.
 *
 * REQUEST BODY
 *   { "email": "zumaveza@gmail.com", "password": "<new-strong-password>" }
 *
 * RESPONSE
 *   200 { "ok": true, "userId": "<uuid>" }
 *   400/401/403/404/500 { "error": "<reason>" }
 */
export async function POST(req: Request) {
  // ── Guard: secret must be configured and match ────────────────────────────
  const secret = process.env.ADMIN_RECOVERY_SECRET
  if (!secret) {
    // Endpoint is disabled when the env var is not set.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let email: string | undefined
  let password: string | undefined
  try {
    const body = await req.json()
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
    password = typeof body.password === 'string' ? body.password : undefined
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // ── Look up the user by email ─────────────────────────────────────────────
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error('[recover-admin] listUsers error:', listError)
    return NextResponse.json({ error: 'Could not look up users.' }, { status: 500 })
  }

  const targetUser = listData?.users?.find(u => u.email?.toLowerCase() === email)
  if (!targetUser) {
    return NextResponse.json({ error: `No account found for ${email}` }, { status: 404 })
  }

  // ── Update the password ───────────────────────────────────────────────────
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    targetUser.id,
    { password },
  )

  if (updateError) {
    console.error('[recover-admin] updateUserById error:', updateError)
    return NextResponse.json({ error: updateError.message || 'Could not update password.' }, { status: 500 })
  }

  // ── Ensure the profile has role='admin' ───────────────────────────────────
  // (Guards against the edge case where the profile row lost its role.)
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', targetUser.id)

  if (profileError) {
    // Non-fatal — password was updated; role sync is secondary.
    console.error('[recover-admin] profile role sync error:', profileError)
  }

  // ── Sync role into auth app_metadata so middleware sees it immediately ────
  const { error: metaError } = await admin.auth.admin.updateUserById(targetUser.id, {
    app_metadata: { ...targetUser.app_metadata, role: 'admin' },
  })

  if (metaError) {
    console.error('[recover-admin] app_metadata sync error:', metaError)
  }

  console.info(`[recover-admin] Password updated for ${email} (${targetUser.id})`)

  return NextResponse.json({ ok: true, userId: updated?.user?.id ?? targetUser.id })
}
