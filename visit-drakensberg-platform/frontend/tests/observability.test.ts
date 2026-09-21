import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { redact, logEvent, alertEvent, resetAlertDedupe, EVENTS } from '@/lib/observability'

/**
 * Regression tests for M7.
 *
 * Redaction is the part that must not fail: these fields are pulled from
 * Supabase error objects and request bodies and written to a log drain that is
 * far more widely readable than the database. A log line that leaks a recovery
 * token is worse than no log line.
 */

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  delete process.env.ALERT_WEBHOOK_URL
  resetAlertDedupe()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('redact — credentials', () => {
  it.each([
    ['password', 'hunter2'],
    ['token', 'abc123'],
    ['token_hash', 'deadbeefcafe'],
    ['share_token', '0123456789abcdef0123456789abcdef'],
    ['authorization', 'Bearer sk_live_abc'],
    ['service_role_key', 'eyJhbGciOiJIUzI1NiJ9.abc.def'],
    ['cookie', 'sb-access-token=xyz'],
  ])('replaces the %j field wholesale', (key, value) => {
    const out = redact({ [key]: value }) as Record<string, unknown>
    expect(out[key]).toBe('[redacted]')
    expect(JSON.stringify(out)).not.toContain(value)
  })

  it('is case-insensitive about field names', () => {
    const out = redact({ Password: 'hunter2', TOKEN: 'abc' }) as Record<string, unknown>
    expect(out.Password).toBe('[redacted]')
    expect(out.TOKEN).toBe('[redacted]')
  })

  it.each([
    ['a JWT', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abcdefghij'],
    ['a Stripe live key', 'sk_live_51AbCdEfGhIjKlMnOp'],
    ['a Resend key', 're_abcdefghijklmnopqrstuvwx'],
    ['a Postgres DSN', 'postgresql://postgres:hunter2@db.abc.supabase.co:5432/postgres'],
  ])('scrubs %s wherever it appears in a string', (_label, secret) => {
    const out = redact({ note: `failed with ${secret} in the message` }) as Record<string, unknown>
    expect(out.note).not.toContain(secret)
    expect(out.note).toContain('[redacted]')
  })

  it('scrubs a secret nested deep inside an error payload', () => {
    const out = JSON.stringify(redact({
      supabase: { error: { details: 'key eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig rejected' } },
    }))
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9')
  })
})

describe('redact — personal data', () => {
  it.each(['email', 'customer_email', 'phone', 'full_name', 'customer_name', 'participant_email'])(
    'replaces the %j field', key => {
      const out = redact({ [key]: 'Jane Doe' }) as Record<string, unknown>
      expect(out[key]).toBe('[redacted]')
    })

  it('scrubs a bare email address in free text', () => {
    const out = redact({ reason: 'no account for jane.doe@example.com' }) as Record<string, unknown>
    expect(out.reason).not.toContain('jane.doe@example.com')
  })

  it('keeps the operational fields that make a log useful', () => {
    const out = redact({
      orderId: 'vdo-123', amount: 4500, currency: 'ZAR', paylinkId: 'PL-9', ok: false,
    }) as Record<string, unknown>
    expect(out).toEqual({ orderId: 'vdo-123', amount: 4500, currency: 'ZAR', paylinkId: 'PL-9', ok: false })
  })
})

describe('redact — shape and safety', () => {
  it('reduces an Error to name and message, dropping the stack', () => {
    const out = redact(new Error('boom')) as Record<string, unknown>
    expect(out).toEqual({ name: 'Error', message: 'boom' })
    expect(out).not.toHaveProperty('stack')
  })

  it('scrubs secrets out of an Error message', () => {
    const out = redact(new Error('bad token sk_live_51AbCdEfGh')) as Record<string, unknown>
    expect(String(out.message)).not.toContain('sk_live_51AbCdEfGh')
  })

  it('terminates on a cyclic object instead of hanging', () => {
    const cyclic: Record<string, unknown> = { name: 'root' }
    cyclic.self = cyclic
    expect(() => redact(cyclic)).not.toThrow()
    expect(JSON.stringify(redact(cyclic))).toContain('too deep')
  })

  it('caps a long array rather than logging all of it', () => {
    const out = redact(Array.from({ length: 500 }, (_, i) => i)) as unknown[]
    expect(out.length).toBe(50)
  })

  it('passes null and undefined through', () => {
    expect(redact(null)).toBe(null)
    expect(redact(undefined)).toBe(undefined)
  })
})

describe('logEvent', () => {
  it('writes one JSON line carrying the event name and severity', () => {
    logEvent({ event: 'test.thing', severity: 'info', fields: { orderId: 'vdo-1' } })
    const line = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const parsed = JSON.parse(line)
    expect(parsed.event).toBe('test.thing')
    expect(parsed.severity).toBe('info')
    expect(parsed.orderId).toBe('vdo-1')
    expect(typeof parsed.ts).toBe('string')
  })

  it('redacts fields on the way out', () => {
    logEvent({ event: 'test.thing', severity: 'error', fields: { customer_email: 'jane@example.com' } })
    const line = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(line).not.toContain('jane@example.com')
  })

  it('routes by severity so a drain can split them', () => {
    logEvent({ event: 'a', severity: 'info' })
    logEvent({ event: 'b', severity: 'warn' })
    logEvent({ event: 'c', severity: 'critical' })
    expect(console.info).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledOnce()
    expect(console.error).toHaveBeenCalledOnce()
  })
})

describe('alertEvent', () => {
  it('does nothing over the network when no webhook is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await alertEvent({ event: EVENTS.ADMIN_RECOVERY_DENIED, severity: 'critical' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()   // still logged
  })

  it('posts to the webhook when one is configured', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example/abc'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    await alertEvent({
      event: EVENTS.PAYMENT_RECONCILIATION_FAILED,
      severity: 'critical',
      fields: { orderId: 'vdo-1' },
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.event).toBe('payment.reconciliation_failed')
    expect(body.fields.orderId).toBe('vdo-1')
  })

  it('redacts the webhook payload too', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example/abc'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    await alertEvent({
      event: EVENTS.ADMIN_RECOVERY_DENIED,
      severity: 'critical',
      fields: { email: 'admin@visitdrakensberg.com', token: 'secret-value' },
    })

    const raw = (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    expect(raw).not.toContain('admin@visitdrakensberg.com')
    expect(raw).not.toContain('secret-value')
  })

  it('never sends info-level events', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example/abc'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await alertEvent({ event: EVENTS.AUDIT_DIGEST, severity: 'info' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('collapses a repeat of the same event — an attack pages once, not a thousand times', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example/abc'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    for (let i = 0; i < 50; i++) {
      await alertEvent({ event: EVENTS.UNTRUSTED_FORWARDED_HOST, severity: 'warn' })
    }
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('still sends a DIFFERENT event during another event\'s dedupe window', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example/abc'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    await alertEvent({ event: EVENTS.UNTRUSTED_FORWARDED_HOST, severity: 'warn' })
    await alertEvent({ event: EVENTS.PAYMENT_RECONCILIATION_FAILED, severity: 'critical' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('swallows a failing webhook — an unreachable alert endpoint must not 500 a payment', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example/abc'
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(alertEvent({
      event: EVENTS.PAYMENT_RECONCILIATION_FAILED,
      severity: 'critical',
    })).resolves.toBeUndefined()
  })
})

describe('EVENTS', () => {
  it('names the signal the application most needed and did not have', () => {
    // A payment that settled at the gateway and not in our database: the route
    // returned 500 and relied on iKhokha retrying, and nobody was told.
    expect(EVENTS.PAYMENT_RECONCILIATION_FAILED).toBe('payment.reconciliation_failed')
  })

  it('gives every event a stable dotted name a log drain can filter on', () => {
    for (const name of Object.values(EVENTS)) {
      expect(name).toMatch(/^[a-z]+(\.[a-z_]+)+$/)
    }
  })
})
