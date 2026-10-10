import { describe, it, expect, vi } from 'vitest'
import {
  signUnsubscribeToken, verifyUnsubscribeToken, newOptInToken, hashOptInToken, isValidEmail, normaliseEmail,
} from '@/lib/marketing-tokens'
import { getMarketingConfig } from '@/lib/marketing-config'
import { sendBrevoEmail, normalizeMessageId } from '@/lib/brevo'
import { parseBrevoPayload, mapBrevoEvent } from '@/lib/brevo-webhook'
import { renderCampaignEmail, htmlToText } from '@/lib/campaign-render'

const SECRET = 'x'.repeat(40)

describe('unsubscribe tokens', () => {
  it('round-trips the address they were issued for', () => {
    const t = signUnsubscribeToken(SECRET, 'Thandi@Example.com ')
    expect(verifyUnsubscribeToken(SECRET, t)).toBe('thandi@example.com')
  })

  it('cannot be reused for a different address', () => {
    // The old ?email= link let anyone opt out anyone. Swapping the address
    // segment of a genuine token must not verify.
    const mine = signUnsubscribeToken(SECRET, 'me@example.com')
    const theirs = signUnsubscribeToken(SECRET, 'victim@example.com')
    const forged = `${theirs.split('.')[0]}.${mine.split('.')[1]}`
    expect(verifyUnsubscribeToken(SECRET, forged)).toBeNull()
  })

  it('rejects a token signed with another secret, garbage, and a missing token', () => {
    const t = signUnsubscribeToken('y'.repeat(40), 'me@example.com')
    expect(verifyUnsubscribeToken(SECRET, t)).toBeNull()
    expect(verifyUnsubscribeToken(SECRET, 'nonsense')).toBeNull()
    expect(verifyUnsubscribeToken(SECRET, '')).toBeNull()
    expect(verifyUnsubscribeToken(SECRET, null)).toBeNull()
    expect(verifyUnsubscribeToken('', t)).toBeNull()
  })

  it('does not treat purposes as interchangeable (an opt-in hash is not an unsubscribe signature)', () => {
    const { token } = newOptInToken()
    expect(verifyUnsubscribeToken(SECRET, `${Buffer.from('me@example.com').toString('base64url')}.${token}`)).toBeNull()
  })
})

describe('opt-in tokens', () => {
  it('are random, and only their hash is derivable', () => {
    const a = newOptInToken(); const b = newOptInToken()
    expect(a.token).not.toBe(b.token)
    expect(a.token.length).toBeGreaterThanOrEqual(40)
    expect(hashOptInToken(a.token)).toBe(a.hash)
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('email validation', () => {
  it('accepts normal addresses and rejects junk', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('no-at-sign')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
    expect(isValidEmail('a@b.co\r\nBcc: x@y.z')).toBe(false)
    expect(normaliseEmail('  A@B.CO ')).toBe('a@b.co')
  })
})

describe('marketing config', () => {
  const full = {
    BREVO_API_KEY: 'k', MARKETING_FROM_EMAIL: 'hello@news.example.com', EMAIL_POSTAL_ADDRESS: '1 Berg Rd, Clarens',
    MARKETING_TOKEN_SECRET: SECRET, BREVO_WEBHOOK_SECRET: 'w', MARKETING_SENDS_ENABLED: 'true',
  } as unknown as NodeJS.ProcessEnv

  it('is ready only when everything is present', () => {
    expect(getMarketingConfig(full).ready).toBe(true)
  })

  it.each([
    ['BREVO_API_KEY'], ['MARKETING_FROM_EMAIL'], ['EMAIL_POSTAL_ADDRESS'],
    ['MARKETING_TOKEN_SECRET'], ['BREVO_WEBHOOK_SECRET'], ['MARKETING_SENDS_ENABLED'],
  ])('refuses to send without %s', (key) => {
    const env = { ...full, [key]: '' } as unknown as NodeJS.ProcessEnv
    const cfg = getMarketingConfig(env)
    expect(cfg.ready).toBe(false)
    expect(cfg.missing.join(' ')).toContain(key)
  })

  it('treats a short token secret as missing, and never echoes secret values', () => {
    const cfg = getMarketingConfig({ ...full, MARKETING_TOKEN_SECRET: 'short' } as unknown as NodeJS.ProcessEnv)
    expect(cfg.ready).toBe(false)
    expect(JSON.stringify(cfg.missing)).not.toContain('short')
  })

  it('needs the explicit kill-switch to be exactly "true"', () => {
    expect(getMarketingConfig({ ...full, MARKETING_SENDS_ENABLED: 'yes' } as unknown as NodeJS.ProcessEnv).ready).toBe(false)
  })

  it('bounds the daily cap and batch size', () => {
    const cfg = getMarketingConfig({ ...full, MARKETING_DAILY_CAP: '-5', MARKETING_BATCH_SIZE: '99999' } as unknown as NodeJS.ProcessEnv)
    expect(cfg.dailyCap).toBe(1)
    expect(cfg.batchSize).toBe(200)
    expect(getMarketingConfig(full).dailyCap).toBe(300)
  })
})

describe('sendBrevoEmail', () => {
  const base = {
    apiKey: 'secret-key', fromEmail: 'hello@news.example.com', fromName: 'Visit Drakensberg',
    to: 'thandi@example.com', toName: 'Thandi', subject: 'Hi', html: '<p>Hi</p>',
    headers: { 'List-Unsubscribe': '<https://x/u>' },
  }
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('posts the documented shape and returns a normalised message id', async () => {
    const f = reply(201, { messageId: '<abc@smtp-relay.mailin.fr>' })
    const r = await sendBrevoEmail(base, f)
    expect(r).toEqual({ ok: true, messageId: 'abc@smtp-relay.mailin.fr' })
    const [url, init] = (f as any).mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.headers['api-key']).toBe('secret-key')
    const body = JSON.parse(init.body)
    expect(body.sender).toEqual({ name: 'Visit Drakensberg', email: 'hello@news.example.com' })
    expect(body.to).toEqual([{ email: 'thandi@example.com', name: 'Thandi' }])
    expect(body.headers['List-Unsubscribe']).toBe('<https://x/u>')
    expect(body.htmlContent).toBe('<p>Hi</p>')
  })

  it('a bad key is fatal for the whole run, not just this recipient', async () => {
    const r = await sendBrevoEmail(base, reply(401, { code: 'unauthorized', message: 'Key not found' }))
    expect(r).toMatchObject({ ok: false, fatal: true, retryable: false })
    expect((r as any).error).not.toContain('secret-key')
  })

  it('throttling and server errors are retryable; throttling asks the run to back off', async () => {
    expect(await sendBrevoEmail(base, reply(429, {}))).toMatchObject({ ok: false, retryable: true, rateLimited: true, fatal: false })
    expect(await sendBrevoEmail(base, reply(503, {}))).toMatchObject({ ok: false, retryable: true, rateLimited: false })
  })

  it('a rejected recipient (400) is permanent for that recipient only', async () => {
    expect(await sendBrevoEmail(base, reply(400, { code: 'invalid_parameter', message: 'bad email' })))
      .toMatchObject({ ok: false, retryable: false, fatal: false })
  })

  it('a network failure is retryable', async () => {
    const f = vi.fn(async () => { throw new Error('socket hang up') }) as unknown as typeof fetch
    expect(await sendBrevoEmail(base, f)).toMatchObject({ ok: false, retryable: true })
  })

  it('a 2xx without a message id is not counted as sent', async () => {
    expect(await sendBrevoEmail(base, reply(201, {}))).toMatchObject({ ok: false })
  })

  it('normalizeMessageId strips angle brackets', () => {
    expect(normalizeMessageId('<a@b>')).toBe('a@b')
    expect(normalizeMessageId('a@b')).toBe('a@b')
    expect(normalizeMessageId('')).toBeNull()
  })
})

describe('brevo webhook parsing', () => {
  it('maps the events we act on and ignores the rest', () => {
    expect(mapBrevoEvent('hard_bounce')).toBe('bounced')
    expect(mapBrevoEvent('hardBounce')).toBe('bounced')
    expect(mapBrevoEvent('soft_bounce')).toBe('soft_bounced')
    expect(mapBrevoEvent('spam')).toBe('complaint')
    expect(mapBrevoEvent('unique_opened')).toBe('opened')
    expect(mapBrevoEvent('click')).toBe('clicked')
    expect(mapBrevoEvent('invalid_email')).toBe('invalid')
    expect(mapBrevoEvent('unsubscribed')).toBe('unsubscribed')
    expect(mapBrevoEvent('request')).toBeNull()
    expect(mapBrevoEvent('something_new')).toBeNull()
    expect(mapBrevoEvent(undefined)).toBeNull()
  })

  it('parses a single object or an array, lower-casing addresses and normalising ids', () => {
    const one = parseBrevoPayload({ event: 'hard_bounce', email: 'Gone@Example.com', 'message-id': '<m1@x>', ts_event: 1_700_000_000, reason: 'mailbox full' })
    expect(one).toHaveLength(1)
    expect(one[0]).toMatchObject({ type: 'bounced', email: 'gone@example.com', messageId: 'm1@x' })
    expect(one[0].occurredAt).toBe('2023-11-14T22:13:20.000Z')
    expect(one[0].metadata.reason).toBe('mailbox full')
    expect(parseBrevoPayload([{ event: 'delivered', email: 'a@b.co' }, { event: 'request', email: 'a@b.co' }, null, 'x'])).toHaveLength(1)
  })

  it('gives a redelivery the same key, but separate opens and different links distinct keys', () => {
    const open = { event: 'opened', email: 'a@b.co', 'message-id': '<m@x>', ts_event: 1_700_000_000 }
    expect(parseBrevoPayload(open)[0].key).toBe(parseBrevoPayload({ ...open })[0].key)
    expect(parseBrevoPayload({ ...open, ts_event: 1_700_000_500 })[0].key).not.toBe(parseBrevoPayload(open)[0].key)
    const click = { event: 'click', email: 'a@b.co', 'message-id': '<m@x>', ts_event: 1_700_000_000, link: 'https://a' }
    expect(parseBrevoPayload({ ...click, link: 'https://b' })[0].key).not.toBe(parseBrevoPayload(click)[0].key)
  })

  it('drops events with no address', () => {
    expect(parseBrevoPayload({ event: 'delivered' })).toEqual([])
  })
})

describe('campaign rendering', () => {
  const template = {
    subject: 'Hello {{first_name|there}} — {{offer}}',
    preheader: 'Winter in the Berg',
    htmlBody: '<p>Hi {{first_name|friend}}, use <b>{{promo_code}}</b>.</p>',
    heroImageUrl: '', heroImageAlt: '',
  }
  const input = {
    template, campaignFields: { offer: 'Winter midweek', promo_code: 'BERG20' },
    contact: null, toEmail: 'thandi@example.com', origin: 'https://visitdrakensberg.com',
    tokenSecret: SECRET, postalAddress: '1 Berg Road, Clarens',
  }

  it('personalises, carries the postal address, and signs the unsubscribe link to this recipient', () => {
    const r = renderCampaignEmail(input)
    expect(r.subject).toBe('Hello Thandi — Winter midweek')
    expect(r.html).toContain('BERG20')
    expect(r.html).toContain('1 Berg Road, Clarens')
    const token = new URL(r.headers['List-Unsubscribe'].slice(1, -1)).searchParams.get('t')
    expect(verifyUnsubscribeToken(SECRET, token)).toBe('thandi@example.com')
  })

  it('sends RFC 8058 one-click unsubscribe headers pointing at the API', () => {
    const r = renderCampaignEmail(input)
    expect(r.headers['List-Unsubscribe']).toMatch(/^<https:\/\/visitdrakensberg\.com\/api\/unsubscribe\?t=.+>$/)
    expect(r.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('footer link goes to the confirmation page, not the one-click endpoint', () => {
    expect(renderCampaignEmail(input).html).toMatch(/href="https:\/\/visitdrakensberg\.com\/unsubscribe\?t=/)
  })

  it('escapes customer-controlled values in the body and flattens the subject to one line', () => {
    const r = renderCampaignEmail({
      ...input,
      contact: {
        id: 'u', fullName: '<img src=x onerror=alert(1)>\r\nBcc: evil', email: 'a@b.co', country: null, city: null,
        lifecycleStage: 'customer', interests: [], favouriteDestinations: [], favouriteActivities: [], tripCount: 0, upcomingTravel: null,
      },
    })
    expect(r.html).not.toContain('<img src=x')
    expect(r.html).toContain('&lt;img')
    expect(r.subject).not.toMatch(/[\r\n]/)
  })

  it('prefixes test sends', () => {
    expect(renderCampaignEmail({ ...input, subjectPrefix: '[TEST] ' }).subject.startsWith('[TEST] ')).toBe(true)
  })

  it('produces a plain-text alternative that includes the unsubscribe URL', () => {
    const r = renderCampaignEmail(input)
    expect(r.text).toContain('Unsubscribe:')
    expect(r.text).not.toMatch(/<[a-z]/i)
  })

  it('htmlToText keeps link targets', () => {
    expect(htmlToText('<p>See <a href="https://x.co/a">our trails</a></p>')).toContain('our trails (https://x.co/a)')
  })
})
