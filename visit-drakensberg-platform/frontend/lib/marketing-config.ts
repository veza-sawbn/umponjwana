// SERVER ONLY — reads process.env. Never import from a client component.
//
// One place that answers "is this deployment allowed to send promotional
// email, and as whom?". A real send refuses to start unless every item here is
// present, so a half-configured environment fails loudly in the admin UI
// instead of mailing real customers from a wrong sender, without a postal
// address, or with unsubscribe links nobody can verify.

export type MarketingConfig = {
  /** True only when every required setting is present AND sends are switched on. */
  ready: boolean
  /** Human-readable reasons `ready` is false. Never contains a secret value. */
  missing: string[]
  apiKey: string
  senderEmail: string
  senderName: string
  replyTo: string | null
  postalAddress: string
  tokenSecret: string
  webhookSecret: string
  /** Max promotional emails delivered per UTC day — the sender-warm-up brake. */
  dailyCap: number
  /** Recipients claimed per dispatcher pass. */
  batchSize: number
}

function intFromEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw)
  if (!raw || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

export function getMarketingConfig(env: NodeJS.ProcessEnv = process.env): MarketingConfig {
  const apiKey = env.BREVO_API_KEY?.trim() ?? ''
  const senderEmail = env.MARKETING_FROM_EMAIL?.trim() ?? ''
  const postalAddress = env.EMAIL_POSTAL_ADDRESS?.trim() ?? ''
  const tokenSecret = env.MARKETING_TOKEN_SECRET?.trim() ?? ''
  const webhookSecret = env.BREVO_WEBHOOK_SECRET?.trim() ?? ''

  const missing: string[] = []
  if (!apiKey) missing.push('BREVO_API_KEY')
  if (!senderEmail) missing.push('MARKETING_FROM_EMAIL')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) missing.push('MARKETING_FROM_EMAIL (not a valid address)')
  if (!postalAddress) missing.push('EMAIL_POSTAL_ADDRESS')
  // The unsubscribe links are HMAC-signed; a short secret is a forgeable one.
  if (tokenSecret.length < 32) missing.push('MARKETING_TOKEN_SECRET (at least 32 characters)')
  if (!webhookSecret) missing.push('BREVO_WEBHOOK_SECRET')
  if (env.MARKETING_SENDS_ENABLED?.trim().toLowerCase() !== 'true') missing.push('MARKETING_SENDS_ENABLED=true')

  return {
    ready: missing.length === 0,
    missing,
    apiKey,
    senderEmail,
    senderName: env.MARKETING_FROM_NAME?.trim() || 'Visit Drakensberg',
    replyTo: env.MARKETING_REPLY_TO?.trim() || null,
    postalAddress,
    tokenSecret,
    webhookSecret,
    dailyCap: intFromEnv(env.MARKETING_DAILY_CAP, 300, 1, 100_000),
    batchSize: intFromEnv(env.MARKETING_BATCH_SIZE, 40, 1, 200),
  }
}
