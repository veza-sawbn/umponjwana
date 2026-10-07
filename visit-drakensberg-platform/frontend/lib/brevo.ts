// SERVER ONLY — only ever import from app/api/*/route.ts handlers.
//
// Brevo (formerly Sendinblue) is the marketing ESP for admin campaigns
// (app/admin/campaigns). lib/mailer.ts stays the transport for transactional
// mail; it is a single SMTP mailbox and was never meant for bulk sends — see
// supabase/migrations/20260825_email_campaign_foundation.sql.
//
// Each recipient's email is rendered on our side (merge tags + the branded
// shell), so Brevo receives finished HTML per recipient through the
// transactional API's messageVersions — one HTTP call per batch rather than
// one per person, and no contact sync needed before a send.
//
// Required env vars: BREVO_API_KEY, BREVO_SENDER_EMAIL (a sender verified in
// Brevo → Senders, Domains & Dedicated IPs). Optional: BREVO_SENDER_NAME
// (defaults to "Visit Drakensberg"), BREVO_REPLY_TO.

const API = 'https://api.brevo.com/v3'

/** Brevo accepts up to 1000 message versions per call; staying well under it
 *  keeps each request small enough to retry cheaply. */
export const BREVO_BATCH_SIZE = 500

export type BrevoMessage = {
  email: string
  name?: string
  subject: string
  html: string
}

export function brevoConfigured(): boolean {
  return !!(process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim())
}

function sender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL!.trim(),
    name: process.env.BREVO_SENDER_NAME?.trim() || 'Visit Drakensberg',
  }
}

/**
 * Sends one batch. `campaignId` travels as Brevo's X-Mailin-custom header,
 * which Brevo echoes on every webhook event for the message — that is how
 * app/api/webhooks/brevo attributes opens, clicks and bounces to a campaign.
 */
export async function sendBrevoBatch(o: {
  messages: BrevoMessage[]
  campaignId: string
  unsubscribeUrl: string
}): Promise<{ sent: number; error: string | null }> {
  if (!brevoConfigured()) return { sent: 0, error: 'Brevo not configured (BREVO_API_KEY, BREVO_SENDER_EMAIL)' }
  if (o.messages.length === 0) return { sent: 0, error: null }
  if (o.messages.length > 1000) return { sent: 0, error: 'Brevo batch larger than 1000 messages' }

  const replyTo = process.env.BREVO_REPLY_TO?.trim()
  // The top-level subject/htmlContent are required by the API even when every
  // version overrides them, so the first message stands in.
  const [first] = o.messages
  const body = {
    sender: sender(),
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    subject: first.subject,
    htmlContent: first.html,
    messageVersions: o.messages.map(m => ({
      to: [{ email: m.email, ...(m.name ? { name: m.name } : {}) }],
      subject: m.subject,
      htmlContent: m.html,
    })),
    tags: ['campaign', `campaign:${o.campaignId}`],
    headers: {
      'X-Mailin-custom': o.campaignId,
      // Headers are shared by every version, so this points at the public
      // opt-out page rather than a per-recipient link; the per-recipient
      // link is in each email's footer.
      'List-Unsubscribe': `<${o.unsubscribeUrl}>`,
    },
  }

  try {
    const res = await fetch(`${API}/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!.trim(),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      // Brevo answers {"code":"…","message":"…"}; the message is the useful part.
      let message = detail
      try { message = JSON.parse(detail)?.message ?? detail } catch { /* not JSON */ }
      return { sent: 0, error: `Brevo ${res.status}: ${message || res.statusText}` }
    }
    return { sent: o.messages.length, error: null }
  } catch (e) {
    return { sent: 0, error: e instanceof Error ? e.message : 'Brevo request failed' }
  }
}

/**
 * Brevo transactional webhook event → our vd_email_events.event_type, or null
 * for events we don't record. 'request' (Brevo accepted the message) is
 * skipped because the send route already records 'sent' itself.
 */
export function mapBrevoEvent(event: string): 'delivered' | 'bounced' | 'opened' | 'clicked' | 'unsubscribed' | null {
  switch (event) {
    case 'delivered': return 'delivered'
    case 'opened':
    case 'unique_opened':
    case 'proxy_open':
    case 'unique_proxy_open': return 'opened'
    case 'click': return 'clicked'
    case 'hard_bounce':
    case 'soft_bounce':
    case 'blocked':
    case 'invalid_email': return 'bounced'
    case 'unsubscribed':
    case 'spam': return 'unsubscribed'
    default: return null
  }
}

/** Events that mean the person no longer wants marketing email from us. */
export function brevoEventWithdrawsConsent(event: string): boolean {
  return event === 'unsubscribed' || event === 'spam'
}
