import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit, callerKey, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { secretsMatch, bearerToken, bearerMatches } from '@/lib/secret-compare'

/**
 * Regression tests for H1 (nothing was rate limited) and L2 (secrets were
 * compared with === / !==, leaking a prefix through timing).
 *
 * These exercise the in-process path, which is what runs when REDIS_URL is
 * unset. The Redis path uses the same rule table and the same arithmetic.
 */

beforeEach(() => {
  delete process.env.REDIS_URL
  delete process.env.REDIS_TOKEN
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

function request(headers: Record<string, string> = {}) {
  return new Request('https://visitdrakensberg.com/api/x', { headers })
}

/** A fresh identifier per test, so the module-level map can't leak between them. */
const uniq = (label: string) => `${label}-${Math.random().toString(36).slice(2)}`

describe('rateLimit', () => {
  it('allows up to the limit and then refuses', async () => {
    const id = uniq('reset')
    const rule = RATE_LIMITS.passwordReset

    for (let i = 0; i < rule.limit; i++) {
      const result = await rateLimit('passwordReset', id)
      expect(result.ok).toBe(true)
      expect(result.remaining).toBe(rule.limit - 1 - i)
    }

    const blocked = await rateLimit('passwordReset', id)
    expect(blocked.ok).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('budgets each identifier separately', async () => {
    const a = uniq('a')
    const b = uniq('b')
    for (let i = 0; i < RATE_LIMITS.passwordReset.limit; i++) await rateLimit('passwordReset', a)

    expect((await rateLimit('passwordReset', a)).ok).toBe(false)
    expect((await rateLimit('passwordReset', b)).ok).toBe(true)
  })

  it('budgets each rule separately', async () => {
    const id = uniq('shared')
    for (let i = 0; i < RATE_LIMITS.passwordReset.limit; i++) await rateLimit('passwordReset', id)

    expect((await rateLimit('passwordReset', id)).ok).toBe(false)
    expect((await rateLimit('invoicePdf', id)).ok).toBe(true)
  })

  it('keeps the two endpoints that guard credentials tight and fail-closed', () => {
    // Both mail or reset a real account, and neither had any limit at all.
    expect(RATE_LIMITS.passwordReset.limit).toBeLessThanOrEqual(10)
    expect(RATE_LIMITS.passwordReset.failClosed).toBe(true)
    expect(RATE_LIMITS.adminRecovery.limit).toBeLessThanOrEqual(10)
    expect(RATE_LIMITS.adminRecovery.failClosed).toBe(true)
  })

  it('makes a brute force of ADMIN_RECOVERY_SECRET hopeless', () => {
    const perYear = RATE_LIMITS.adminRecovery.limit * (31_536_000 / RATE_LIMITS.adminRecovery.windowSeconds)
    expect(perYear).toBeLessThan(100_000)
  })

  it('emits the standard headers', () => {
    const headers = rateLimitHeaders({ ok: false, limit: 5, remaining: 0, retryAfter: 900 })
    expect(headers['RateLimit-Limit']).toBe('5')
    expect(headers['RateLimit-Remaining']).toBe('0')
    expect(headers['Retry-After']).toBe('900')
  })
})

describe('callerKey', () => {
  it('uses the first x-forwarded-for entry — the client, not the proxies', () => {
    expect(callerKey(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' })))
      .toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    expect(callerKey(request({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
  })

  it('puts unidentifiable callers in one shared bucket, not a free pass', () => {
    expect(callerKey(request())).toBe('unknown')
  })

  it('can scope a budget to a user as well as an IP', () => {
    expect(callerKey(request({ 'x-forwarded-for': '203.0.113.7' }), 'user-42'))
      .toBe('203.0.113.7:user-42')
  })
})

describe('secretsMatch (constant-time comparison)', () => {
  const secret = 'a'.repeat(48)

  it('accepts the exact secret', () => {
    expect(secretsMatch(secret, secret)).toBe(true)
  })

  it('rejects a value that shares a long prefix', () => {
    // The case `===` leaked: this used to take measurably longer to reject
    // than a value differing in its first byte.
    expect(secretsMatch('a'.repeat(47) + 'b', secret)).toBe(false)
  })

  it('rejects values of a different length without throwing', () => {
    // timingSafeEqual throws on a length mismatch; hashing first avoids both
    // the throw and the length leak a guard would introduce.
    expect(() => secretsMatch('short', secret)).not.toThrow()
    expect(secretsMatch('short', secret)).toBe(false)
    expect(secretsMatch('a'.repeat(500), secret)).toBe(false)
  })

  it.each([
    [null, secret],
    [undefined, secret],
    ['', secret],
    [secret, null],
    [secret, undefined],
    [secret, ''],
    ['', ''],
  ])('refuses when either side is missing (%j, %j)', (provided, expected) => {
    expect(secretsMatch(provided as string | null, expected as string | null)).toBe(false)
  })
})

describe('bearerToken / bearerMatches', () => {
  const secret = 'x'.repeat(40)

  it('extracts a bearer token case-insensitively', () => {
    expect(bearerToken(request({ authorization: `Bearer ${secret}` }))).toBe(secret)
    expect(bearerToken(request({ authorization: `bearer ${secret}` }))).toBe(secret)
  })

  it.each(['', 'Basic abc', 'Bearer', secret])('returns null for %j', header => {
    expect(bearerToken(request(header ? { authorization: header } : {}))).toBe(null)
  })

  it('matches a correct bearer token', () => {
    expect(bearerMatches(request({ authorization: `Bearer ${secret}` }), secret)).toBe(true)
  })

  it('refuses when the expected secret is unset, even with no header', () => {
    // Both sides missing must never read as a match — that would turn an unset
    // env var into an open endpoint.
    expect(bearerMatches(request(), undefined)).toBe(false)
    expect(bearerMatches(request(), '')).toBe(false)
  })

  it('refuses a near-miss token', () => {
    expect(bearerMatches(request({ authorization: `Bearer ${secret}y` }), secret)).toBe(false)
  })
})
