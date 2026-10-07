// Pure parsing of Brevo transactional webhook payloads, kept apart from the
// route so it can be unit-tested without a network or a database.

import { normalizeMessageId } from './brevo'

export type EmailEventType =
  | 'delivered' | 'bounced' | 'soft_bounced' | 'blocked' | 'invalid' | 'deferred'
  | 'opened' | 'clicked' | 'unsubscribed' | 'complaint'

// Brevo has spelled these differently across API generations and webhook
// types (hard_bounce / hardBounce, unique_opened / uniqueOpened), so match on a
// normalised key. "request"/"sent" are ignored on purpose: we record our own
// 'sent' when Brevo accepts the message.
const EVENT_MAP: Record<string, EmailEventType> = {
  delivered: 'delivered',
  hardbounce: 'bounced',
  softbounce: 'soft_bounced',
  blocked: 'blocked',
  invalid: 'invalid',
  invalidemail: 'invalid',
  deferred: 'deferred',
  spam: 'complaint',
  complaint: 'complaint',
  opened: 'opened',
  uniqueopened: 'opened',
  proxyopen: 'opened',
  loadedbyproxy: 'opened',
  click: 'clicked',
  clicked: 'clicked',
  unsubscribed: 'unsubscribed',
  unsubscribe: 'unsubscribed',
}

export type ParsedEmailEvent = {
  key: string
  type: EmailEventType
  email: string
  messageId: string | null
  occurredAt: string | null
  metadata: Record<string, unknown>
}

export function mapBrevoEvent(raw: unknown): EmailEventType | null {
  if (typeof raw !== 'string') return null
  return EVENT_MAP[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? null
}

function occurredAt(p: Record<string, unknown>): string | null {
  const epoch = Number(p.ts_event ?? p.ts_epoch ?? p.ts)
  if (Number.isFinite(epoch) && epoch > 0) {
    // Brevo sends seconds; tolerate milliseconds.
    return new Date(epoch < 1e12 ? epoch * 1000 : epoch).toISOString()
  }
  if (typeof p.date === 'string') {
    const d = new Date(p.date.replace(' ', 'T'))
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

export function parseBrevoPayload(body: unknown): ParsedEmailEvent[] {
  const list = Array.isArray(body) ? body : [body]
  const out: ParsedEmailEvent[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    const type = mapBrevoEvent(p.event)
    const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : ''
    if (!type || !email) continue
    const messageId = normalizeMessageId(String(p['message-id'] ?? p.messageId ?? ''))
    const when = occurredAt(p)
    const link = typeof p.link === 'string' ? p.link : ''
    out.push({
      // A redelivery of the same webhook must hash to the same key; two real
      // opens (or clicks on different links) at different times must not.
      key: [type, messageId ?? '', email, when ?? String(p.id ?? ''), link].join('|'),
      type,
      email,
      messageId,
      occurredAt: when,
      metadata: {
        ...(typeof p.reason === 'string' ? { reason: p.reason.slice(0, 500) } : {}),
        ...(link ? { link: link.slice(0, 500) } : {}),
        ...(typeof p.tag === 'string' ? { tag: p.tag.slice(0, 200) } : {}),
        brevo_event: p.event,
      },
    })
  }
  return out
}
