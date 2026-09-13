import { redisCommand, isRedisConfigured } from './redis'

/**
 * Fixed-window rate limiting for API routes.
 *
 * WHY (audit finding H1)
 *   Nothing in this application was rate limited. Not the password-reset
 *   endpoint, which mails through our own SMTP and can be pointed at any
 *   address. Not /api/admin/recover-admin, whose entire protection is a static
 *   secret an attacker could therefore guess at line speed with no lockout, no
 *   backoff and no alert. Not the invoice PDF route, which runs
 *   @react-pdf/renderer per request. Not the notification email route.
 *
 * HOW
 *   Redis when it is configured (shared across serverless instances, which is
 *   the only way a limit means anything on Vercel), and an in-process map
 *   otherwise. The in-process fallback is honest about what it is: it bounds
 *   one instance, which still blunts a single-source burst and is far better
 *   than nothing for local and preview deploys — but production must have
 *   REDIS_URL and REDIS_TOKEN set for these limits to hold platform-wide.
 *
 *   INCR + EXPIRE rather than a sorted set: a fixed window admits at most 2x
 *   the limit across a boundary, which is an acceptable trade for two commands
 *   and no clock skew handling. The limits below are chosen with that in mind.
 *
 * FAIL-CLOSED vs FAIL-OPEN
 *   When Redis is configured but unreachable, `failClosed` decides. Password
 *   reset and admin recovery fail closed — better to refuse a reset than to let
 *   an outage open a brute-force window. Everything else fails open, because a
 *   Redis blip should not take checkout down.
 */

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
  /** Refuse the request if the limiter itself cannot be consulted. */
  failClosed?: boolean
}

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  /** Seconds until the window resets — the Retry-After value. */
  retryAfter: number
}

/**
 * The limits, one per protected route. Kept together so the whole budget can
 * be read at a glance rather than hunted through route files.
 */
export const RATE_LIMITS = {
  /**
   * Mails a real person through our SMTP, so the cost of abuse lands on a
   * third party's inbox and on our sender reputation. Deliberately tight.
   */
  passwordReset: { limit: 5, windowSeconds: 900, failClosed: true },
  /**
   * A static-secret backdoor that can set any account's password. Five
   * attempts an hour turns an online brute force into a non-starter.
   */
  adminRecovery: { limit: 5, windowSeconds: 3600, failClosed: true },
  /** Renders a PDF per request — CPU, not just I/O. */
  invoicePdf: { limit: 30, windowSeconds: 60 },
  /** Mails a real person; also bounded in the database by insert volume. */
  notificationEmail: { limit: 30, windowSeconds: 300 },
  /** Creates a payment link at the gateway on every call. */
  paymentCreate: { limit: 20, windowSeconds: 300 },
  /** Unauthenticated proxy to the legacy backend. */
  backendProxy: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

// ── In-process fallback ─────────────────────────────────────────────────────
// Module scope, so it survives between invocations on a warm instance.
const memory = new Map<string, { count: number; resetAt: number }>()

function memoryConsume(key: string, rule: RateLimitRule, now: number): RateLimitResult {
  // Opportunistic sweep so an instance that lives a long time doesn't grow a
  // map entry per attacker IP forever.
  if (memory.size > 10_000) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k)
  }

  const entry = memory.get(key)
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + rule.windowSeconds * 1000
    memory.set(key, { count: 1, resetAt })
    return { ok: true, limit: rule.limit, remaining: rule.limit - 1, retryAfter: rule.windowSeconds }
  }

  entry.count += 1
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
  return {
    ok: entry.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - entry.count),
    retryAfter,
  }
}

/**
 * Identify the caller. X-Forwarded-For's FIRST entry is the client as the edge
 * saw it; later entries are proxies. On Vercel this header is set by the
 * platform, so it cannot be spoofed past the edge — but a request that arrives
 * without one falls back to a constant bucket, which is intentional: an
 * unidentifiable caller shares one budget rather than getting a free pass.
 */
export function callerKey(req: Request, extra?: string | null): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown'
  return extra ? `${ip}:${extra}` : ip
}

/**
 * Consume one unit of `name`'s budget for `identifier`.
 * Never throws — a limiter that can break a route is worse than no limiter.
 */
export async function rateLimit(
  name: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<RateLimitResult> {
  const rule: RateLimitRule = RATE_LIMITS[name]
  const now = Date.now()
  const window = Math.floor(now / (rule.windowSeconds * 1000))
  const key = `ratelimit:${name}:${identifier}:${window}`

  if (!isRedisConfigured()) {
    return memoryConsume(key, rule, now)
  }

  try {
    const count = Number(await redisCommand('INCR', key))
    if (!Number.isFinite(count) || count === 0) throw new Error('no count from redis')
    if (count === 1) await redisCommand('EXPIRE', key, rule.windowSeconds)

    const resetAt = (window + 1) * rule.windowSeconds * 1000
    return {
      ok: count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    }
  } catch (e) {
    console.error(`[rate-limit] ${name} could not be evaluated:`, e instanceof Error ? e.message : e)
    if (rule.failClosed) {
      return { ok: false, limit: rule.limit, remaining: 0, retryAfter: rule.windowSeconds }
    }
    // Fail open, but still bound this instance.
    return memoryConsume(key, rule, now)
  }
}

/** The standard headers for a limited response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'Retry-After': String(result.retryAfter),
  }
}
