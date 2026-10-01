import { describe, it, expect, vi } from 'vitest'
import { verifyTurnstileToken, isTurnstileVerificationConfigured } from '../lib/turnstile-verify'

/**
 * Regression tests for the ONE captcha check this repository performs itself.
 *
 * Everything else is enforced by Supabase, which the browser talks to directly.
 * POST /api/auth/request-password-reset is the exception: it runs under the
 * service-role key, GoTrue exempts service-role calls from captcha, and it
 * mails a real person through our own SMTP. If this function is wrong, that
 * endpoint is an open mail cannon and no dashboard setting will close it.
 */

const SECRET = 'test-secret'

function stubFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  })) as unknown as typeof fetch
}

describe('verifyTurnstileToken', () => {
  it('accepts a token Cloudflare says is good', async () => {
    const fetchImpl = stubFetch({ success: true })
    const verdict = await verifyTurnstileToken('0.good', { secret: SECRET, fetchImpl })
    expect(verdict).toEqual({ ok: true, reason: 'verified' })
  })

  it('refuses a token Cloudflare rejects, and keeps the codes for the log', async () => {
    const fetchImpl = stubFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] })
    const verdict = await verifyTurnstileToken('0.spent', { secret: SECRET, fetchImpl })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('rejected')
    expect(verdict.errorCodes).toEqual(['timeout-or-duplicate'])
  })

  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['whitespace', '  '],
  ])('refuses when the client sends %s, without calling Cloudflare', async (_label, token) => {
    const fetchImpl = stubFetch({ success: true })
    const verdict = await verifyTurnstileToken(token, { secret: SECRET, fetchImpl })
    expect(verdict).toEqual({ ok: false, reason: 'missing_token' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('FAILS CLOSED when Cloudflare cannot be reached', async () => {
    // The whole point. A quiet window in which anyone can mail-bomb an inbox
    // is worse than a few minutes of "please try again" — the same posture
    // lib/rate-limit.ts takes on this same route.
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch
    const verdict = await verifyTurnstileToken('0.tok', { secret: SECRET, fetchImpl })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('unreachable')
  })

  it('fails closed on an HTTP error from siteverify too', async () => {
    const fetchImpl = stubFetch({}, { ok: false, status: 503 })
    const verdict = await verifyTurnstileToken('0.tok', { secret: SECRET, fetchImpl })
    expect(verdict).toMatchObject({ ok: false, reason: 'unreachable', errorCodes: ['http_503'] })
  })

  it('fails closed when siteverify hangs past the timeout', async () => {
    const fetchImpl = vi.fn((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    ) as unknown as typeof fetch
    const verdict = await verifyTurnstileToken('0.tok', { secret: SECRET, fetchImpl, timeoutMs: 10 })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('unreachable')
  })

  it('skips the check — and says so — when no secret is configured', async () => {
    // Deliberate: preview deploys and local checkouts have no secret, and a
    // checkout that cannot send a password reset is a checkout nobody can
    // test. Production has the secret; .env.example lists it as required.
    const fetchImpl = stubFetch({ success: true })
    const verdict = await verifyTurnstileToken('anything', { secret: '', fetchImpl })
    expect(verdict).toEqual({ ok: true, reason: 'not_configured' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts the secret and token as form-encoded fields, to the right URL', async () => {
    const fetchImpl = stubFetch({ success: true })
    await verifyTurnstileToken('0.tok', {
      secret: SECRET,
      remoteIp: '41.0.0.1',
      idempotencyKey: 'abc',
      fetchImpl,
    })
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.method).toBe('POST')
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('secret')).toBe(SECRET)
    expect(sent.get('response')).toBe('0.tok')
    expect(sent.get('remoteip')).toBe('41.0.0.1')
    expect(sent.get('idempotency_key')).toBe('abc')
  })

  it('omits remoteip and idempotency_key when the caller gives none', async () => {
    // The password-reset route deliberately sends neither — an x-forwarded-for
    // that has been through one proxy too many would turn into a refused reset
    // for a real person, and Cloudflare validates remoteip when it is present.
    const fetchImpl = stubFetch({ success: true })
    await verifyTurnstileToken('0.tok', { secret: SECRET, fetchImpl })
    const sent = new URLSearchParams(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    )
    expect(sent.has('remoteip')).toBe(false)
    expect(sent.has('idempotency_key')).toBe(false)
  })

  it('never puts the secret in the URL, where it would reach access logs', async () => {
    const fetchImpl = stubFetch({ success: true })
    await verifyTurnstileToken('0.tok', { secret: SECRET, fetchImpl })
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).not.toContain(SECRET)
  })
})

describe('isTurnstileVerificationConfigured', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['   ', false],
    ['0x4AAA-secret', true],
  ])('%j → %s', (secret, expected) => {
    expect(isTurnstileVerificationConfigured(secret as string | undefined)).toBe(expected)
  })
})
