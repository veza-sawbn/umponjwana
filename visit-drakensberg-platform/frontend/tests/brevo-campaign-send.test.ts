import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderCampaignEmail, unsubscribeUrlFor, type CampaignRecipientRow } from '@/lib/campaign-send'
import { sendBrevoBatch, mapBrevoEvent, brevoEventWithdrawsConsent, brevoConfigured } from '@/lib/brevo'

const recipient: CampaignRecipientRow = {
  user_id: 'u1',
  email: 'thandi@example.com',
  full_name: 'Thandi Dlamini',
  country: 'South Africa',
  city: 'Durban',
  lifecycle_stage: 'returning_customer',
  interests: ['hiking'],
  favourite_destinations: ['Royal Natal'],
  favourite_activities: [],
  trip_count: 2,
  upcoming_travel: null,
}

const template = {
  subject: 'Hi {{first_name|there}}, {{offer}}',
  preheader: 'For {{city}}',
  htmlBody: '<p>See you at {{favourite_destination|the berg}}, {{first_name}}.</p>',
  heroImageUrl: '',
  heroImageAlt: '',
}

describe('renderCampaignEmail', () => {
  it('fills merge tags per recipient and uses their unsubscribe link', () => {
    const m = renderCampaignEmail({
      origin: 'https://example.test', template, recipient, campaignFields: { offer: 'Winter <midweek>' },
    })
    expect(m.email).toBe('thandi@example.com')
    expect(m.name).toBe('Thandi Dlamini')
    expect(m.subject).toBe('Hi Thandi, Winter <midweek>')
    expect(m.html).toContain('See you at Royal Natal, Thandi.')
    expect(m.html).toContain('https://example.test/unsubscribe?email=thandi%40example.com')
  })

  it('escapes values in the body', () => {
    const m = renderCampaignEmail({
      origin: 'https://example.test',
      template: { ...template, htmlBody: '<p>{{first_name}}</p>' },
      recipient: { ...recipient, full_name: '<script>x</script>' },
      campaignFields: {},
    })
    expect(m.html).not.toContain('<script>x</script>')
  })

  it('does not send an email address as the display name', () => {
    const m = renderCampaignEmail({
      origin: 'https://example.test', template, recipient: { ...recipient, full_name: '' }, campaignFields: {},
    })
    expect(m.name).toBeUndefined()
    expect(m.subject.startsWith('Hi there,')).toBe(true)
  })

  it('encodes the address in the unsubscribe link', () => {
    expect(unsubscribeUrlFor('https://x.test', 'a+b@c.test')).toBe('https://x.test/unsubscribe?email=a%2Bb%40c.test')
  })
})

describe('sendBrevoBatch', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.BREVO_API_KEY = 'xkeysib-test'
    process.env.BREVO_SENDER_EMAIL = 'hello@example.test'
  })
  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllGlobals()
  })

  it('refuses without configuration', async () => {
    delete process.env.BREVO_API_KEY
    expect(brevoConfigured()).toBe(false)
    const r = await sendBrevoBatch({ messages: [{ email: 'a@b.test', subject: 's', html: 'h' }], campaignId: 'c', unsubscribeUrl: 'u' })
    expect(r.sent).toBe(0)
    expect(r.error).toMatch(/not configured/)
  })

  it('posts one message version per recipient with the campaign id header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageIds: ['1', '2'] }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await sendBrevoBatch({
      messages: [
        { email: 'a@b.test', name: 'A', subject: 'S1', html: 'H1' },
        { email: 'c@d.test', subject: 'S2', html: 'H2' },
      ],
      campaignId: 'camp-1',
      unsubscribeUrl: 'https://x.test/unsubscribe',
    })
    expect(r).toEqual({ sent: 2, error: null })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.headers['api-key']).toBe('xkeysib-test')
    const body = JSON.parse(init.body)
    expect(body.sender).toEqual({ email: 'hello@example.test', name: 'Visit Drakensberg' })
    expect(body.messageVersions).toEqual([
      { to: [{ email: 'a@b.test', name: 'A' }], subject: 'S1', htmlContent: 'H1' },
      { to: [{ email: 'c@d.test' }], subject: 'S2', htmlContent: 'H2' },
    ])
    expect(body.headers['X-Mailin-custom']).toBe('camp-1')
    expect(body.headers['List-Unsubscribe']).toBe('<https://x.test/unsubscribe>')
  })

  it('surfaces Brevo error messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 }),
    ))
    const r = await sendBrevoBatch({ messages: [{ email: 'a@b.test', subject: 's', html: 'h' }], campaignId: 'c', unsubscribeUrl: 'u' })
    expect(r).toEqual({ sent: 0, error: 'Brevo 401: Key not found' })
  })
})

describe('Brevo webhook mapping', () => {
  it('maps engagement events and skips the rest', () => {
    expect(mapBrevoEvent('delivered')).toBe('delivered')
    expect(mapBrevoEvent('unique_opened')).toBe('opened')
    expect(mapBrevoEvent('click')).toBe('clicked')
    expect(mapBrevoEvent('hard_bounce')).toBe('bounced')
    expect(mapBrevoEvent('spam')).toBe('unsubscribed')
    expect(mapBrevoEvent('request')).toBeNull()
    expect(mapBrevoEvent('deferred')).toBeNull()
  })

  it('withdraws consent only on unsubscribe or spam complaint', () => {
    expect(brevoEventWithdrawsConsent('unsubscribed')).toBe(true)
    expect(brevoEventWithdrawsConsent('spam')).toBe(true)
    expect(brevoEventWithdrawsConsent('hard_bounce')).toBe(false)
  })
})
