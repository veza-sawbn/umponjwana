import { supabase } from './auth'
import type { ChannelId } from './channels'

/* ────────────────────────────────────────────────────────────────────────────
 * Communications Hub — channel connection credentials.
 *
 * Each external provider is configured here (WhatsApp Cloud API, Meta
 * Messenger, Instagram, TikTok, email, SMS). Credentials live in the
 * admin-only `vd_channel_connections` table, never in the public site_content.
 * The settings UI collects `config` (non-secret ids) and `secret` (tokens)
 * per the field schema below.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ChannelField = {
  key: string
  label: string
  secret?: boolean
  placeholder?: string
  help?: string
}

export type ChannelSetup = {
  fields: ChannelField[]
  /** relative webhook path to register with the provider for inbound messages. */
  webhookPath?: string
  docsUrl?: string
  docsNote?: string
  /** whether outbound delivery is implemented for this channel. */
  canSend: boolean
}

// Channels with no setup (built-in) are omitted; only configurable providers appear.
export const CHANNEL_SETUP: Partial<Record<ChannelId, ChannelSetup>> = {
  whatsapp: {
    canSend: true,
    webhookPath: '/api/channels/whatsapp/webhook',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    docsNote: 'Create a WhatsApp app in the Meta for Developers console, add the WhatsApp product, then copy the Phone Number ID and a permanent System User access token.',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '1093...', help: 'WhatsApp → API Setup → From (phone number ID).' },
      { key: 'businessAccountId', label: 'WhatsApp Business Account ID', placeholder: '1023...' },
      { key: 'displayPhone', label: 'Display Phone Number', placeholder: '+27 82 000 0000' },
      { key: 'accessToken', label: 'Permanent Access Token', secret: true, help: 'A System User token with whatsapp_business_messaging permission.' },
      { key: 'appSecret', label: 'App Secret', secret: true, help: 'Used to verify inbound webhook signatures.' },
      { key: 'verifyToken', label: 'Webhook Verify Token', secret: true, help: 'Any string you choose — paste the same value in the Meta webhook config.' },
    ],
  },
  messenger: {
    canSend: true,
    webhookPath: '/api/channels/messenger/webhook',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform/getting-started',
    docsNote: 'Create a Meta app, add Messenger, connect your Facebook Page and generate a Page access token.',
    fields: [
      { key: 'pageId', label: 'Facebook Page ID', placeholder: '1015...' },
      { key: 'appId', label: 'Meta App ID', placeholder: '7788...' },
      { key: 'pageAccessToken', label: 'Page Access Token', secret: true },
      { key: 'appSecret', label: 'App Secret', secret: true },
      { key: 'verifyToken', label: 'Webhook Verify Token', secret: true },
    ],
  },
  instagram: {
    canSend: true,
    webhookPath: '/api/channels/instagram/webhook',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram',
    docsNote: 'Link an Instagram professional account to your Facebook Page, then use the Page access token with instagram_manage_messages.',
    fields: [
      { key: 'igBusinessAccountId', label: 'Instagram Business Account ID', placeholder: '1784...' },
      { key: 'pageId', label: 'Linked Facebook Page ID', placeholder: '1015...' },
      { key: 'pageAccessToken', label: 'Page Access Token', secret: true },
      { key: 'verifyToken', label: 'Webhook Verify Token', secret: true },
    ],
  },
  tiktok: {
    canSend: false,
    docsUrl: 'https://business-api.tiktok.com/portal',
    docsNote: 'TikTok Business Messaging is invite-only. Save your app credentials here; delivery activates once TikTok grants Messaging API access.',
    fields: [
      { key: 'appId', label: 'TikTok App ID' },
      { key: 'advertiserId', label: 'Advertiser / Business ID' },
      { key: 'appSecret', label: 'App Secret', secret: true },
      { key: 'accessToken', label: 'Access Token', secret: true },
    ],
  },
  email: {
    canSend: false,
    docsNote: 'Connect a transactional email provider (e.g. Resend). Inbound email-to-thread requires an inbound/parse webhook from the provider.',
    fields: [
      { key: 'fromAddress', label: 'From Address', placeholder: 'hello@visitdrakensberg.com' },
      { key: 'provider', label: 'Provider', placeholder: 'resend' },
      { key: 'apiKey', label: 'API Key', secret: true },
    ],
  },
  sms: {
    canSend: false,
    docsNote: 'Connect an SMS gateway (e.g. Twilio, Clickatell). Delivery and inbound depend on the gateway.',
    fields: [
      { key: 'sender', label: 'Sender ID / Number', placeholder: 'VisitBerg' },
      { key: 'gateway', label: 'Gateway', placeholder: 'twilio' },
      { key: 'apiKey', label: 'API Key', secret: true },
    ],
  },
}

export type ChannelConnectionRow = {
  channel: ChannelId
  connected: boolean
  config: Record<string, string>
  secret: Record<string, string>
  updated_at?: string
}

const empty = (channel: ChannelId): ChannelConnectionRow => ({ channel, connected: false, config: {}, secret: {} })

export async function getConnections(): Promise<Record<string, ChannelConnectionRow>> {
  const out: Record<string, ChannelConnectionRow> = {}
  try {
    const { data } = await supabase.from('vd_channel_connections').select('*')
    for (const row of (data ?? []) as any[]) {
      out[row.channel] = { channel: row.channel, connected: row.connected, config: row.config ?? {}, secret: row.secret ?? {}, updated_at: row.updated_at }
    }
  } catch { /* table may not exist yet — treat as unconfigured */ }
  return out
}

export async function getConnection(channel: ChannelId): Promise<ChannelConnectionRow> {
  try {
    const { data } = await supabase.from('vd_channel_connections').select('*').eq('channel', channel).maybeSingle()
    if (data) return { channel, connected: (data as any).connected, config: (data as any).config ?? {}, secret: (data as any).secret ?? {}, updated_at: (data as any).updated_at }
  } catch {}
  return empty(channel)
}

/** channel → connected flag, for reflecting live status in the Hub. */
export async function getConnectionStatuses(): Promise<Record<string, boolean>> {
  const conns = await getConnections()
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(conns)) out[k] = v.connected
  return out
}

/** Save config + only the secret keys the admin actually re-entered (blank =
 *  keep existing), and set the connected flag. */
export async function saveConnection(
  channel: ChannelId,
  config: Record<string, string>,
  secretUpdates: Record<string, string>,
  connected: boolean,
): Promise<ChannelConnectionRow> {
  const existing = await getConnection(channel)
  const secret = { ...existing.secret }
  for (const [k, v] of Object.entries(secretUpdates)) {
    if (v && v.trim()) secret[k] = v.trim()
  }
  const { data: userData } = await supabase.auth.getUser()
  const row = {
    channel, connected, config,
    secret,
    updated_at: new Date().toISOString(),
    updated_by: userData.user?.id ?? null,
  }
  const { error } = await supabase.from('vd_channel_connections').upsert(row, { onConflict: 'channel' })
  if (error) throw error
  return { channel, connected, config, secret }
}

export async function disconnectChannel(channel: ChannelId): Promise<void> {
  const { error } = await supabase.from('vd_channel_connections').update({ connected: false, updated_at: new Date().toISOString() }).eq('channel', channel)
  if (error) throw error
}

/** Which config/secret fields are still missing for a channel to be usable. */
export function missingRequired(channel: ChannelId, config: Record<string, string>, secretPresent: Record<string, boolean>): string[] {
  const setup = CHANNEL_SETUP[channel]
  if (!setup) return []
  return setup.fields
    .filter(f => f.secret ? !secretPresent[f.key] : !(config[f.key] && config[f.key].trim()))
    .map(f => f.label)
}
