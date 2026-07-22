/* ────────────────────────────────────────────────────────────────────────────
 * Communications Hub — channel abstraction
 *
 * Every communication source (WhatsApp, Messenger, website chat, email…) is
 * modelled as a ChannelAdapter implementing a common interface, so new
 * channels can be added without touching the inbox UI. Channels that route
 * through an internal store (website chat, contact form, phone/manual log)
 * are "connected" and deliver immediately. External provider channels
 * (WhatsApp Cloud API, Meta Graph, TikTok…) are declared here as adapters
 * that report `connected: false` until credentials + a webhook are wired in
 * — the UI shows them as sources but blocks sending through them.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ChannelId =
  | 'website-chat'
  | 'contact-form'
  | 'phone'
  | 'whatsapp'
  | 'messenger'
  | 'instagram'
  | 'tiktok'
  | 'email'
  | 'sms'

export type OutboundMessage = {
  conversationId: string
  to: string           // customer handle for the channel (phone / email / psid…)
  body: string
  senderName: string
}

export interface ChannelAdapter {
  id: ChannelId
  label: string
  /** lucide icon name resolved by the UI. */
  icon: string
  /** brand-ish accent for the channel badge. */
  color: string
  /** true when the adapter can actually deliver (internal store or wired API). */
  connected: boolean
  /** one-line note on what's needed to connect an external provider. */
  note?: string
  /** Deliver an outbound message. Internal adapters resolve immediately; the
   *  Hub still records the message on the thread. External adapters throw
   *  until connected. */
  send(msg: OutboundMessage): Promise<{ delivered: boolean; providerRef?: string }>
}

function internalAdapter(id: ChannelId, label: string, icon: string, color: string): ChannelAdapter {
  return {
    id, label, icon, color, connected: true,
    async send() {
      // Internal channels are delivered by recording the message on the
      // conversation thread (handled by lib/conversations.sendReply).
      return { delivered: true }
    },
  }
}

function externalAdapter(id: ChannelId, label: string, icon: string, color: string, note: string): ChannelAdapter {
  return {
    id, label, icon, color, connected: false, note,
    // Delivery is attempted server-side (/api/channels/send), which reads the
    // admin-only stored credentials and calls the provider API. If the channel
    // isn't connected the route returns 409 and this throws a clear message.
    async send(msg: OutboundMessage) {
      const res = await fetch('/api/channels/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: id, to: msg.to, body: msg.body }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `The ${label} channel could not deliver this message.`)
      return { delivered: true, providerRef: json?.providerRef }
    },
  }
}

export const CHANNELS: Record<ChannelId, ChannelAdapter> = {
  'website-chat': internalAdapter('website-chat', 'Website Live Chat', 'MessageSquare', '#2d6a4f'),
  'contact-form': internalAdapter('contact-form', 'Website Contact Form', 'Inbox', '#2d6a4f'),
  'phone': internalAdapter('phone', 'Phone / Walk-in', 'Phone', '#6b7280'),
  'whatsapp': externalAdapter('whatsapp', 'WhatsApp Business', 'MessageCircle', '#25D366',
    'Connect the WhatsApp Business Cloud API (Meta) with a phone number ID and permanent token.'),
  'messenger': externalAdapter('messenger', 'Facebook Messenger', 'Facebook', '#0084FF',
    'Connect the Meta Graph API with a Page access token and Messenger webhook.'),
  'instagram': externalAdapter('instagram', 'Instagram Direct', 'Instagram', '#E1306C',
    'Connect the Instagram Messaging API via the linked Meta business account.'),
  'tiktok': externalAdapter('tiktok', 'TikTok Business', 'Music2', '#000000',
    'Connect TikTok Business Messaging once official API access is granted.'),
  'email': externalAdapter('email', 'Email', 'Mail', '#8B6914',
    'Connect an email provider (e.g. Resend inbound) to thread email replies.'),
  'sms': externalAdapter('sms', 'SMS', 'Smartphone', '#6b7280',
    'Connect an SMS gateway to send and receive text messages.'),
}

export const CHANNEL_LIST: ChannelAdapter[] = Object.values(CHANNELS)

export function getChannel(id: string | undefined): ChannelAdapter {
  return (id && CHANNELS[id as ChannelId]) || CHANNELS['website-chat']
}

/** Route an outbound message through its channel adapter. */
export async function sendViaChannel(channelId: ChannelId, msg: OutboundMessage) {
  return getChannel(channelId).send(msg)
}
