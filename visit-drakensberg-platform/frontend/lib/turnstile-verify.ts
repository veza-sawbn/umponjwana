import { TURNSTILE_HOST } from './turnstile'

/**
 * Server-side Turnstile verification (siteverify).
 *
 * WHEN THIS IS THE ONLY THING STANDING THERE
 *   Supabase's own captcha setting covers the GoTrue calls the browser makes
 *   directly — signup, password sign-in, recover. It does not cover this
 *   application's own API routes, and one of those is a genuinely expensive
 *   unauthenticated endpoint: POST /api/auth/request-password-reset generates
 *   a recovery link with the SERVICE ROLE key and mails it through our own
 *   SMTP. Service-role calls bypass captcha by design, so no dashboard switch
 *   will ever protect that route. This module does.
 *
 * FAIL-CLOSED, WITH ONE DELIBERATE EXCEPTION
 *   A token that is missing, malformed, already spent or refused is a refusal,
 *   and so is a Cloudflare that cannot be reached — the same posture
 *   lib/rate-limit.ts takes for this route, for the same reason: a quiet
 *   window where anyone can mail-bomb an inbox is worse than a few minutes of
 *   "please try again".
 *
 *   The exception is "no secret configured". Preview deploys and local
 *   development have no secret, and a checkout that cannot send a password
 *   reset is a checkout nobody can test. Production is the case that matters
 *   and production has the secret; docs/security/TURNSTILE.md lists it as a
 *   required variable and the deploy order that makes it so.
 *
 * THE SECRET
 *   TURNSTILE_SECRET_KEY is server-only. It must never be given a NEXT_PUBLIC_
 *   prefix, never be read from a client component, and never be committed.
 */

const SITEVERIFY_URL = `${TURNSTILE_HOST}/turnstile/v0/siteverify`

/** How long to wait for Cloudflare before treating it as unreachable. */
const VERIFY_TIMEOUT_MS = 5_000

export type TurnstileVerdict = {
  ok: boolean
  /**
   * verified       — Cloudflare accepted the token.
   * not_configured — no secret on this deployment; the check was skipped.
   * missing_token  — the client sent nothing.
   * rejected       — Cloudflare refused it (expired, already spent, forged).
   * unreachable    — siteverify errored or timed out.
   */
  reason: 'verified' | 'not_configured' | 'missing_token' | 'rejected' | 'unreachable'
  /** Cloudflare's own codes, for logs. Never returned to the caller's browser. */
  errorCodes?: string[]
}

export type VerifyOptions = {
  /** Defaults to process.env.TURNSTILE_SECRET_KEY. */
  secret?: string
  /** The end user's IP, when the caller has a trustworthy one. Optional per Cloudflare. */
  remoteIp?: string | null
  /**
   * Makes a retry of the *same* token safe: Cloudflare returns the original
   * verdict instead of "already spent". Without it, a retried request that
   * reuses a token fails for a reason that has nothing to do with the user.
   */
  idempotencyKey?: string
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  opts: VerifyOptions = {},
): Promise<TurnstileVerdict> {
  const secret = (opts.secret ?? process.env.TURNSTILE_SECRET_KEY ?? '').trim()
  if (!secret) return { ok: true, reason: 'not_configured' }

  const response = (token || '').trim()
  if (!response) return { ok: false, reason: 'missing_token' }

  const body = new URLSearchParams({ secret, response })
  if (opts.remoteIp) body.set('remoteip', opts.remoteIp)
  if (opts.idempotencyKey) body.set('idempotency_key', opts.idempotencyKey)

  const doFetch = opts.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? VERIFY_TIMEOUT_MS)

  try {
    const res = await doFetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, reason: 'unreachable', errorCodes: [`http_${res.status}`] }

    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (data?.success === true) return { ok: true, reason: 'verified' }
    return { ok: false, reason: 'rejected', errorCodes: data?.['error-codes'] ?? [] }
  } catch (err) {
    // Includes the AbortError from the timeout above.
    return {
      ok: false,
      reason: 'unreachable',
      errorCodes: [err instanceof Error ? err.name : 'unknown'],
    }
  } finally {
    clearTimeout(timer)
  }
}

/** True when this deployment has a secret and will therefore actually check. */
export function isTurnstileVerificationConfigured(secret = process.env.TURNSTILE_SECRET_KEY): boolean {
  return (secret ?? '').trim().length > 0
}
