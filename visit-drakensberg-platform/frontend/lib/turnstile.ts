/**
 * Cloudflare Turnstile — shared configuration.
 *
 * WHY THIS EXISTS
 *   The September 2026 audit's M2 said the platform's unauthenticated write
 *   endpoints were unprotected, and 20260807_listing_applications.sql said it
 *   in plain words: "a bot that finds it can fill the bucket. Put the platform
 *   behind a rate limit / captcha before this sees real traffic." It then saw
 *   real traffic: 144 listing applications, 109 of them scripted, before
 *   anyone noticed.
 *
 * WHERE THE CHECK ACTUALLY HAPPENS
 *   Not here, and not anywhere else in this repository. lib/auth.ts talks to
 *   *.supabase.co directly from the browser — Vercel never sees a signup — so
 *   the only place a token can be *enforced* for auth is Supabase itself
 *   (Authentication → Attack Protection → Enable Captcha protection, provider
 *   Turnstile). This module's job is to make sure every client-side GoTrue
 *   call carries a token so that flipping that switch does not break the site.
 *
 *   The secret key belongs in that Supabase setting and nowhere else. It must
 *   never appear in this repository or in a NEXT_PUBLIC_* variable.
 *
 * WHICH CALLS ARE GATED
 *   GoTrue applies the captcha to /signup, /token (password grant), /recover,
 *   /magiclink, /otp and /resend. It does not apply it to /verify with a
 *   token_hash — which is the shape the password-reset page uses — and the
 *   client library agrees: VerifyTokenHashParams is the one auth param type in
 *   @supabase/auth-js that has no captchaToken field, so there would be no way
 *   to satisfy a check there. Recovery links keep working.
 */

/** Cloudflare's widget origin. Also needed by the CSP — see security-headers.mjs. */
export const TURNSTILE_HOST = 'https://challenges.cloudflare.com'

/**
 * Explicit render: the script does not scan the DOM for .cf-turnstile on load.
 * React owns when the widget appears, which matters on pages where the form is
 * behind a step (list-with-us) or remounts on error.
 */
export const TURNSTILE_SCRIPT_URL = `${TURNSTILE_HOST}/turnstile/v0/api.js?render=explicit`

/**
 * Public site key. Safe to ship to the browser — it is in the page source of
 * every site that uses Turnstile. Written as a literal process.env.NEXT_PUBLIC_*
 * access so Next inlines it at build time.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

/**
 * A Turnstile token is valid for 300 seconds and is redeemable exactly once.
 * Anything holding one for longer than this should ask for a fresh one rather
 * than spend it and show the user an opaque auth failure.
 */
export const TURNSTILE_TOKEN_TTL_MS = 300_000

/**
 * Is the widget configured for this deployment?
 *
 * Unconfigured is a working state on purpose: local development and preview
 * builds have no site key, and a missing key must not make the login page
 * unusable. It is NOT a working state in production once Supabase captcha is
 * on — see docs/security/TURNSTILE.md for the deploy order (site key to Vercel
 * first, Supabase switch second).
 */
export function isTurnstileEnabled(siteKey: string = TURNSTILE_SITE_KEY): boolean {
  return siteKey.trim().length > 0
}

/**
 * Turn a token into the `options` fragment supabase-js expects.
 *
 * Returns {} rather than { captchaToken: undefined } when there is no token:
 * GoTrue rejects an empty-string captcha_token outright, so a deployment with
 * captcha switched off must send no field at all.
 */
export function captchaOptions(token?: string | null): { captchaToken?: string } {
  const t = (token || '').trim()
  return t ? { captchaToken: t } : {}
}

/**
 * Has a token been held too long to spend?
 *
 * The widget's own expired-callback covers the normal case; this covers a form
 * whose tab was backgrounded, where timers are throttled and the callback may
 * not have fired yet.
 */
export function isTokenStale(issuedAt: number, now: number = Date.now()): boolean {
  return now - issuedAt >= TURNSTILE_TOKEN_TTL_MS
}
