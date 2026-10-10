// SERVER ONLY — talks to Brevo's transactional email API (v3).
//
// Why the *transactional* endpoint for marketing: our audience, consent
// rules, personalisation and per-recipient state all live in Postgres, so
// Brevo is used purely as the delivery layer — one fully rendered message per
// recipient. That keeps a single source of truth for who may be mailed (Brevo
// lists/segments would be a second one to keep in sync) and lets the merge-tag
// engine in lib/email-merge-tags.ts render each message exactly as the admin
// previewed it.
//
// Marketing mail is sent from a dedicated subdomain/sender (MARKETING_FROM_EMAIL)
// so a reputation problem there can never touch booking confirmations, which
// keep using lib/mailer.ts.

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export type BrevoSendInput = {
  apiKey: string
  fromEmail: string
  fromName: string
  replyTo?: string | null
  to: string
  toName?: string | null
  subject: string
  html: string
  text?: string
  /** Extra MIME headers — List-Unsubscribe lives here. */
  headers?: Record<string, string>
  tags?: string[]
}

export type BrevoSendResult =
  | { ok: true; messageId: string }
  | {
      ok: false; error: string; retryable: boolean
      /** The key/account is the problem, not this recipient — stop the whole run. */
      fatal: boolean
      /** Brevo is throttling us — back off for this run, retry later. */
      rateLimited: boolean
    }

/** Brevo reports ids as "<abc@smtp-relay.mailin.fr>" in one place and bare in another. */
export function normalizeMessageId(id: string | null | undefined): string | null {
  const v = id?.trim().replace(/^<|>$/g, '')
  return v ? v : null
}

export async function sendBrevoEmail(
  input: BrevoSendInput,
  fetchImpl: typeof fetch = fetch,
): Promise<BrevoSendResult> {
  const body = {
    sender: { name: input.fromName, email: input.fromEmail },
    to: [input.toName ? { email: input.to, name: input.toName } : { email: input.to }],
    ...(input.replyTo ? { replyTo: { email: input.replyTo } } : {}),
    subject: input.subject,
    htmlContent: input.html,
    ...(input.text ? { textContent: input.text } : {}),
    ...(input.headers && Object.keys(input.headers).length ? { headers: input.headers } : {}),
    ...(input.tags?.length ? { tags: input.tags } : {}),
  }

  let res: Response
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': input.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    // Network error / timeout: the message may or may not have been accepted.
    // Retrying risks one duplicate in the rare timeout-after-accept case, which
    // is the right side to err on for a promotional email.
    return { ok: false, error: e instanceof Error ? e.message : 'network error', retryable: true, fatal: false, rateLimited: false }
  }

  const raw = await res.text().catch(() => '')
  let json: { messageId?: string; message?: string; code?: string } = {}
  try { json = raw ? JSON.parse(raw) : {} } catch { /* non-JSON error page */ }

  if (res.ok) {
    const id = json.messageId
    if (!id) return { ok: false, error: 'Brevo accepted the request but returned no messageId', retryable: false, fatal: false, rateLimited: false }
    return { ok: true, messageId: normalizeMessageId(id) ?? id }
  }

  const detail = `Brevo ${res.status}${json.code ? ` ${json.code}` : ''}: ${json.message ?? (raw.slice(0, 200) || 'no body')}`
  // 401/403: bad or revoked key, or the account/sender is not permitted to send.
  // Every remaining recipient would fail identically — stop the whole run.
  if (res.status === 401 || res.status === 403) return { ok: false, error: detail, retryable: false, fatal: true, rateLimited: false }
  if (res.status === 429) return { ok: false, error: detail, retryable: true, fatal: false, rateLimited: true }
  if (res.status >= 500) return { ok: false, error: detail, retryable: true, fatal: false, rateLimited: false }
  return { ok: false, error: detail, retryable: false, fatal: false, rateLimited: false }
}
