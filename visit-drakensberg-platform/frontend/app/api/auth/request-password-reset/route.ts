import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSiteOrigin } from '@/lib/origin'
import { sendMail } from '@/lib/mailer'
import { emailShell, ctaButton, esc } from '@/lib/email-layout'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/request-password-reset
 *
 * Generates a password-reset link and sends it via our own SMTP mailer,
 * bypassing Supabase's redirect-URL allowlist entirely.
 *
 * WHY NOT resetPasswordForEmail?
 *   Supabase validates the `redirectTo` parameter against the project's
 *   redirect URL allowlist (Auth → URL Configuration). When the URL is not
 *   on that list, Supabase silently falls back to the project "Site URL".
 *   If that Site URL is misconfigured to point at the Supabase REST endpoint
 *   (e.g. https://xxx.supabase.co/rest/v1/), every reset-email link redirects
 *   to that REST endpoint and the user sees:
 *     {"message":"No API key found in request",...}
 *
 * THE FIX — admin.generateLink + own SMTP:
 *   1. admin.auth.admin.generateLink({ type: 'recovery', email }) returns a
 *      `hashed_token` and a raw action link. No outbound email is sent; no
 *      redirect URL validation happens.
 *   2. We construct a direct link to our own /auth/reset-password page:
 *        https://[site]/auth/reset-password?token_hash=[hash]&type=recovery
 *   3. We send that link via our own SMTP mailer (lib/mailer.ts).
 *   4. The reset-password page uses verifyOtp({ token_hash, type }) — this path
 *      has always been implemented and does not touch the allowlist at all.
 *
 * FALLBACK:
 *   If SMTP is not configured (or generateLink fails for a non-existent email),
 *   we fall back to resetPasswordForEmail so the endpoint never hard-errors.
 *   The "No API key" bug only surfaces when SMTP is missing AND the Supabase
 *   Site URL is misconfigured — having SMTP configured is the primary fix.
 *
 * Rate-limiting: returns success even for unknown emails to avoid user
 * enumeration (same behaviour as Supabase itself).
 */
export async function POST(req: Request) {
  let email: string | undefined
  try {
    const body = await req.json()
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const origin = getSiteOrigin(req)
  const admin = supabaseAdmin()

  // ── Primary path: generateLink + own SMTP ─────────────────────────────────
  // generateLink does NOT send email and does NOT validate redirectTo — it just
  // returns a token_hash we can embed directly in our own link to the app.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  if (!linkError && linkData?.properties?.hashed_token) {
    const token  = linkData.properties.hashed_token
    const resetUrl = `${origin}/auth/reset-password?token_hash=${encodeURIComponent(token)}&type=recovery`

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        We received a request to reset the password for your Visit Drakensberg account
        (<strong>${esc(email)}</strong>).
      </p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;">
        Click the button below to choose a new password. This link is valid for
        <strong>60&nbsp;minutes</strong>.
      </p>
      ${ctaButton(resetUrl, 'Reset my password')}
      <p style="margin:20px 0 0;font-size:12px;color:#8a8a8a;line-height:1.6;">
        If you didn&rsquo;t request a password reset you can safely ignore this email.
        Your password will not change.
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#aaaaaa;word-break:break-all;">
        If the button doesn&rsquo;t work, copy and paste this link into your browser:<br/>
        <a href="${esc(resetUrl)}" style="color:#8a8a8a;">${esc(resetUrl)}</a>
      </p>`

    const html = emailShell({
      origin,
      eyebrow: 'Account security',
      heading: 'Reset your password',
      preheader: 'Reset your Visit Drakensberg password — this link expires in 60 minutes.',
      bodyHtml,
    })

    const { sent, error: mailError } = await sendMail({
      to: email,
      subject: 'Reset your Visit Drakensberg password',
      html,
    })

    if (!sent) {
      // SMTP failure — log it and fall through to the Supabase fallback so the
      // endpoint always returns 200 (anti-enumeration behaviour is preserved).
      console.error('[request-password-reset] SMTP send failed:', mailError)
    } else {
      // Success — email sent via our own mailer, no Supabase allowlist involved.
      return NextResponse.json({ ok: true })
    }
  } else if (linkError) {
    // generateLink returns an error for non-existent emails too; don't log
    // those (it's normal anti-enumeration). Log genuine server errors.
    if (!linkError.message?.toLowerCase().includes('not found')) {
      console.error('[request-password-reset] generateLink error:', linkError)
    }
  }

  // ── Fallback: Supabase resetPasswordForEmail ───────────────────────────────
  // Used when SMTP is not configured or generateLink failed.
  // This path is affected by the allowlist bug described above, but it beats
  // silently dropping the request when SMTP is unavailable.
  const redirectTo = `${origin}/api/auth/callback`
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo })
  if (resetError) {
    console.error('[request-password-reset] resetPasswordForEmail fallback error:', resetError)
  }

  // Always respond with success to avoid leaking whether the address exists.
  return NextResponse.json({ ok: true })
}
