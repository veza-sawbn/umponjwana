import type { Conversation } from './conversations'
import type { CustomerProfile } from './crm'
import { applyTemplate, type MessageTemplate } from './message-templates'

/* ────────────────────────────────────────────────────────────────────────────
 * Communications Hub — assistant.
 *
 * Provides in-conversation assistance: summary, intent detection, urgency and
 * a suggested reply. This is a deterministic, on-device implementation so it
 * works with no external key; it is designed as a drop-in seam for a real LLM
 * (route a request to the Claude API and return the same shapes). It NEVER
 * sends a message — every suggestion is inserted into the composer for a human
 * to review, edit and send.
 * ──────────────────────────────────────────────────────────────────────────── */

export type Intent = 'availability' | 'pricing' | 'booking' | 'payment' | 'amendment' | 'complaint' | 'general'

export type AssistResult = {
  summary: string
  intent: Intent
  urgent: boolean
  requirements: string[]
  suggestedReply: string
  suggestedTemplateId?: string
}

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  availability: ['available', 'availability', 'dates', 'when', 'vacancy', 'open', 'book for'],
  pricing: ['price', 'cost', 'how much', 'quote', 'rate', 'per person', 'budget', 'discount'],
  booking: ['book', 'reserve', 'confirm', 'secure', "let's do it", 'go ahead', 'proceed'],
  payment: ['pay', 'payment', 'deposit', 'invoice', 'eft', 'card', 'refund', 'balance', 'outstanding'],
  amendment: ['change', 'move', 'reschedule', 'cancel', 'amend', 'update my', 'different date'],
  complaint: ['unhappy', 'complaint', 'refund', 'disappointed', 'terrible', 'problem', 'issue', 'angry', 'wrong'],
  general: [],
}

const URGENT_KEYWORDS = ['urgent', 'asap', 'today', 'tomorrow', 'now', 'immediately', 'emergency', 'complaint', 'angry', 'refund']

function customerMessages(conv: Conversation) {
  return conv.messages.filter(m => m.from === 'visitor')
}

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase()
  let best: Intent = 'general'
  let bestScore = 0
  for (const intent of Object.keys(INTENT_KEYWORDS) as Intent[]) {
    const score = INTENT_KEYWORDS[intent].reduce((n, kw) => n + (lower.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = intent }
  }
  return best
}

function firstName(name: string) {
  return (name || '').trim().split(/\s+/)[0] || 'there'
}

const INTENT_REPLY: Record<Intent, { template?: string; reply: (name: string) => string }> = {
  availability: { template: 'tpl-greeting', reply: n => `Hi ${n}, thanks for your enquiry! Could you confirm your preferred travel dates and group size so I can check availability and put together some options for you?` },
  pricing: { template: 'tpl-quote-followup', reply: n => `Hi ${n}, happy to help with pricing. If you can share your dates, number of travellers and what you'd like to include (stays, hikes, activities), I'll build a tailored quote for you.` },
  booking: { template: 'tpl-booking-confirmation', reply: n => `Wonderful, ${n}! I'll get everything ready to confirm. I'll send an invoice with the deposit — once that's paid I'll lock in your accommodation and activities and share your itinerary.` },
  payment: { template: 'tpl-payment-reminder', reply: n => `Hi ${n}, thanks for checking in on payment. I'll send a secure payment link and your latest invoice with the outstanding balance so you can settle whenever you're ready.` },
  amendment: { template: undefined, reply: n => `Hi ${n}, no problem at all — I can look into changing that for you. Could you confirm exactly what you'd like to adjust and your new preferred dates? I'll check availability and let you know any difference in cost.` },
  complaint: { template: undefined, reply: n => `Hi ${n}, I'm really sorry to hear this and I want to put it right. Let me look into it straight away — could you share a little more detail so I can resolve it as quickly as possible?` },
  general: { template: 'tpl-greeting', reply: n => `Hi ${n}, thank you for getting in touch with Visit Drakensberg! How can I help you plan your trip?` },
}

export function assist(conv: Conversation, profile: CustomerProfile | null, consultantName: string, templates: MessageTemplate[]): AssistResult {
  const custMsgs = customerMessages(conv)
  const allText = custMsgs.map(m => m.body).join(' ')
  const intent = detectIntent(allText || conv.addonTitle)
  const urgent = URGENT_KEYWORDS.some(k => allText.toLowerCase().includes(k))

  const requirements: string[] = []
  const lower = allText.toLowerCase()
  const dateMatch = allText.match(/\b(\d{1,2}\s*(?:-|to|–)\s*\d{1,2}\s*\w+|\d{1,2}\s+\w+|\w+\s+\d{4}|next \w+)\b/i)
  if (dateMatch) requirements.push(`Dates mentioned: ${dateMatch[0]}`)
  const paxMatch = allText.match(/\b(\d{1,2})\s*(people|pax|adults|guests|travellers|of us)\b/i)
  if (paxMatch) requirements.push(`Group size: ${paxMatch[1]}`)
  if (/\bhik(e|ing)\b/i.test(lower)) requirements.push('Interested in hiking')
  if (/\b(stay|lodge|accommodation|cabin|camp)\b/i.test(lower)) requirements.push('Needs accommodation')
  if (/\b(shuttle|transfer|airport|pickup)\b/i.test(lower)) requirements.push('Needs transport / transfer')
  if (/\b(sani pass|amphitheatre|tugela|cathedral|giant)\b/i.test(lower)) requirements.push('Named a specific attraction')

  const name = firstName(conv.customerName || profile?.name || '')
  const rule = INTENT_REPLY[intent]
  let suggestedReply = rule.reply(name).replace('{{ConsultantName}}', consultantName)

  // Prefer a real template body if one matches the detected intent, filling placeholders.
  const tpl = rule.template ? templates.find(t => t.id === rule.template) : undefined
  if (tpl) {
    suggestedReply = applyTemplate(tpl.body, {
      FirstName: name,
      CustomerName: conv.customerName || name,
      ConsultantName: consultantName,
      Destination: profile?.regionsVisited[0] || 'the Drakensberg',
      OutstandingBalance: profile ? `R${Math.round(profile.outstandingBalance).toLocaleString()}` : '',
      BookingReference: conv.bookingRef || '',
    })
  }

  const msgCount = conv.messages.length
  const spendNote = profile && profile.lifetimeSpend > 0
    ? ` This is a returning customer (${profile.tripCount} trip${profile.tripCount === 1 ? '' : 's'}, R${Math.round(profile.lifetimeSpend).toLocaleString()} lifetime).`
    : profile?.isLead ? ' This is a new lead with no prior bookings.' : ''
  const summary = `${custMsgs.length} customer message${custMsgs.length === 1 ? '' : 's'} across ${msgCount} total. Detected intent: ${intent}.${urgent ? ' Flagged URGENT.' : ''}${spendNote}${requirements.length ? ' Requirements: ' + requirements.join('; ') + '.' : ''}`

  return { summary, intent, urgent, requirements, suggestedReply, suggestedTemplateId: rule.template }
}
