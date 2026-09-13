import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'
import { bearerMatches, secretsMatch } from '@/lib/secret-compare'

export const dynamic = 'force-dynamic'

/**
 * Record an attempt in vd_audit_log.
 *
 * Deliberately records no email address and no secret — only what happened and
 * why it was refused, since the log is readable by every admin. Never throws:
 * an audit failure must not turn into an error the caller can distinguish from
 * a refusal, which would itself be an oracle.
 */
async function auditRecoveryAttempt(action: string, details: Record<string, unknown>) {
  try {
    await supabaseAdmin().from('vd_audit_log').insert({
      action,
      entity: 'auth',
      entity_id: 'admin-recovery',
      details,
    })
  } catch (e) {
    console.error('[recover-admin] audit write failed:', e instanceof Error ? e.message : e)
  }
}

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
 *   - Requires `Authorization: Bearer <ADMIN_RECOVERY_SECRET>` header,
 *     compared in constant time (lib/secret-compare.ts).
 *   - ADMIN_RECOVERY_SECRET must be at least 32 characters. This is ENFORCED,
 *     not advisory: a short secret on an endpoint that sets any account's
 *     password is not a configuration choice, it is an open door.
 *   - ADMIN_RECOVERY_EMAIL must name the one account this endpoint may touch.
 *     Without it the endpoint stays disabled.
 *   - Rate limited to 5 attempts per hour per caller, failing closed.
 *   - Every attempt, successful or not, writes an audit row.
 *   - Set ADMIN_RECOVERY_SECRET to a new value (or remove it) after use.
 *
 * WHAT THE AUDIT FOUND (H7)
 *   This is a permanent backdoor that sets an arbitrary password on ANY
 *   account by email and grants it role='admin'. The header above claimed it
 *   "cannot be used to change arbitrary accounts" because it only acts on the
 *   supplied email — but it acted on WHATEVER email was supplied, which is
 *   every account. Its only protection was a static secret, compared with
 *   `!==` (timing leak), with no rate limit (online brute force), no length
 *   enforcement, no audit trail, and a listUsers({perPage:1000}) scan on every
 *   call including failed ones. All six are addressed below.
 *
 * REQUEST BODY
 *   { "email": "zumaveza@gmail.com", "password": "<new-strong-password>" }
 *
 * RESPONSE
 *   200 { "ok": true, "userId": "<uuid>" }
 *   400/401/403/404/500 { "error": "<reason>" }
 */
export async function POST(req: Request) {
  // ── Guard: the endpoint must be deliberately, completely enabled ──────────
  const secret = process.env.ADMIN_RECOVERY_SECRET
  const allowedEmail = process.env.ADMIN_RECOVERY_EMAIL?.trim().toLowerCase()

  // Disabled unless BOTH are set. Requiring the account up front means a
  // leaked secret can only reach the one account the operator nominated,
  // rather than every account on the platform.
  if (!secret || !allowedEmail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Enforced, not advised. A weak secret here is worth as much as no secret.
  if (secret.length < 32) {
    console.error('[recover-admin] ADMIN_RECOVERY_SECRET is shorter than 32 characters — endpoint disabled')
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Before the secret is even looked at: an attacker must not be able to make
  // unlimited guesses. Fails closed, so a Redis outage does not open a window.
  const limit = await rateLimit('adminRecovery', callerKey(req))
  if (!limit.ok) {
    console.warn('[recover-admin] rate limited')
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  if (!bearerMatches(req, secret)) {
    // Audited: a wrong secret on this endpoint is an attack, not a typo, and
    // nothing else in the system would have recorded it.
    await auditRecoveryAttempt('admin.recovery_denied', { reason: 'bad secret' })
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

  // The nominated account, and only the nominated account. Compared in
  // constant time like the secret, since the address is itself a second factor
  // a leaked-secret attacker would have to guess.
  if (!secretsMatch(email, allowedEmail)) {
    await auditRecoveryAttempt('admin.recovery_denied', { reason: 'account not nominated' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 8 was Supabase's floor, not a sensible one for the account this endpoint
  // exists to restore — it is the platform admin.
  if (!password || password.length < 12) {
    return NextResponse.json({ error: 'Password must be at least 12 characters.' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // ── Look up the user by email ─────────────────────────────────────────────
  // Was listUsers({ perPage: 1000 }) — a thousand user records pulled into
  // memory on every call, failed attempts included. The profiles table is
  // keyed on the same id and holds the address, so one indexed read does it.
  const { data: profileRow, error: lookupError } = await admin
    .from('profiles').select('id').ilike('email', email).maybeSingle()
  if (lookupError) {
    console.error('[recover-admin] profile lookup error:', lookupError)
    return NextResponse.json({ error: 'Could not look up the account.' }, { status: 500 })
  }
  if (!profileRow?.id) {
    await auditRecoveryAttempt('admin.recovery_denied', { reason: 'no such account' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: targetData } = await admin.auth.admin.getUserById(profileRow.id as string)
  const targetUser = targetData?.user
  if (!targetUser) {
    await auditRecoveryAttempt('admin.recovery_denied', { reason: 'no auth user' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // The most privileged action the platform can take, so it leaves a row in
  // the same audit log everything else does — not only a function log line
  // that rotates away.
  await auditRecoveryAttempt('admin.recovery_used', { userId: targetUser.id })
  console.info(`[recover-admin] Password updated for the nominated account (${targetUser.id})`)

  return NextResponse.json({ ok: true, userId: updated?.user?.id ?? targetUser.id })
}
