/**
 * Structured logging and alerting.
 *
 * WHY (audit finding M7)
 *   Observability was `console.error` into Vercel function logs. No error
 *   tracker, no aggregation, no alerting, and `vd_audit_log` written
 *   diligently and read by nobody. Specifically unmonitored: a payment webhook
 *   returning non-2xx, which means the money settled at the gateway and not in
 *   our database and NOBODY IS TOLD — the route returns 500 and relies on
 *   iKhokha retrying.
 *
 *   Several handlers also logged whole Supabase error objects, which can carry
 *   query fragments and row data, and nothing redacted PII on the way out.
 *
 * WHAT THIS IS, AND IS NOT
 *   A JSON log line plus an optional webhook post. It is not Sentry — that
 *   needs a DSN and an account, and is tracked as ☐ 4.1 in
 *   docs/security/RESILIENCE_RUNBOOK.md. What it does give is: one shape for
 *   every operational event, so a log drain can filter on it; redaction that
 *   happens by default rather than by remembering; and alerts that reach a
 *   human without waiting for someone to open the function logs.
 *
 *   `ALERT_WEBHOOK_URL` takes any endpoint accepting a JSON POST — a Slack
 *   incoming webhook, a Discord webhook, PagerDuty Events v2, or your own.
 *   Unset, alerts still appear in the structured log; nothing breaks.
 */

/** Keys whose VALUES are replaced wholesale, at any depth. */
const SECRET_KEYS = new Set([
  'password', 'token', 'token_hash', 'access_token', 'refresh_token',
  'share_token', 'secret', 'authorization', 'apikey', 'api_key', 'key',
  'servicerolekey', 'service_role_key', 'cookie', 'set-cookie',
  'email', 'customer_email', 'phone', 'customer_phone', 'full_name',
  'customer_name', 'participant_email', 'participant_name', 'address',
])

/** Values that look like a credential wherever they appear. */
const SECRET_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, // a JWT
  /\bsk_(live|test)_[A-Za-z0-9]+/g,                              // Stripe
  /\bre_[A-Za-z0-9]{16,}/g,                                      // Resend
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,         // an address
  /postgres(?:ql)?:\/\/[^\s'"]+/g,                               // a DSN
]

const REDACTED = '[redacted]'

/**
 * Strip credentials and personal data from anything about to be logged.
 *
 * Recursive and depth-bounded. Applied to EVERY field by default rather than
 * at call sites, because "remember to redact" is a control that fails the
 * first time somebody is in a hurry.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[too deep]'
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    let out = value
    for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED)
    return out
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value

  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message, depth + 1) }
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(v => redact(v, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.has(k.toLowerCase()) ? REDACTED : redact(v, depth + 1)
    }
    return out
  }
  return String(value)
}

export type Severity = 'info' | 'warn' | 'error' | 'critical'

export type OperationalEvent = {
  /** Stable dotted name — what a log drain filters and alerts on. */
  event: string
  severity: Severity
  /** Anything useful. Redacted before it leaves this function. */
  fields?: Record<string, unknown>
}

/**
 * One JSON line per event. Vercel and Render both forward stdout/stderr to
 * whatever drain is configured, and JSON is what makes those searchable
 * instead of grep-able.
 */
export function logEvent({ event, severity, fields }: OperationalEvent): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    severity,
    event,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  })
  if (severity === 'error' || severity === 'critical') console.error(line)
  else if (severity === 'warn') console.warn(line)
  else console.info(line)
}

// ── Alert de-duplication ────────────────────────────────────────────────────
// Module scope, so it survives between invocations on a warm instance. An
// attack that trips the same alert a thousand times a minute should page once,
// not a thousand times — an alert channel nobody can read is the same as no
// alert channel.
const lastAlertAt = new Map<string, number>()
const DEDUPE_WINDOW_MS = 5 * 60 * 1000

function shouldSend(event: string, now: number): boolean {
  if (lastAlertAt.size > 500) {
    for (const [k, t] of lastAlertAt) if (now - t > DEDUPE_WINDOW_MS) lastAlertAt.delete(k)
  }
  const previous = lastAlertAt.get(event)
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return false
  lastAlertAt.set(event, now)
  return true
}

/** Exposed for tests; also useful in a long-lived dev server. */
export function resetAlertDedupe(): void {
  lastAlertAt.clear()
}

/**
 * Log an event and, for anything at warn or above, try to reach a human.
 *
 * Never throws and never blocks the caller on the network: an alert that fails
 * must not fail the request that raised it. Awaiting it is optional — the
 * promise is returned so a test (or a handler that is about to exit) can wait.
 */
export async function alertEvent(input: OperationalEvent): Promise<void> {
  logEvent(input)

  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return
  if (input.severity === 'info') return
  if (!shouldSend(input.event, Date.now())) return

  const safeFields = input.fields ? (redact(input.fields) as Record<string, unknown>) : {}
  const summary = `[${input.severity.toUpperCase()}] ${input.event}`

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` is what Slack and Discord render; the rest is there for
      // anything that parses the body properly.
      body: JSON.stringify({
        text: `${summary}\n\`\`\`${JSON.stringify(safeFields, null, 2)}\`\`\``,
        severity: input.severity,
        event: input.event,
        fields: safeFields,
        source: 'visit-drakensberg',
      }),
      signal: AbortSignal.timeout(5_000),
    })
  } catch (e) {
    // Deliberately only a log line: an unreachable alert endpoint must not
    // turn into a 500 on a customer's payment.
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      severity: 'error',
      event: 'alert.delivery_failed',
      original: input.event,
      reason: e instanceof Error ? e.message : String(e),
    }))
  }
}

/**
 * The events worth waking someone for, named once so the alert rules in
 * docs/security/RESILIENCE_RUNBOOK.md §4.2 and the code that raises them
 * cannot drift apart.
 */
export const EVENTS = {
  /** A payment settled at the gateway and not in our database. */
  PAYMENT_RECONCILIATION_FAILED: 'payment.reconciliation_failed',
  /** The gateway status check itself failed. */
  PAYMENT_GATEWAY_UNREACHABLE: 'payment.gateway_unreachable',
  /** Redis is down, so the credential-guarding limits are failing closed. */
  RATE_LIMITER_DEGRADED: 'ratelimit.degraded',
  /** Someone is guessing ADMIN_RECOVERY_SECRET. */
  ADMIN_RECOVERY_DENIED: 'admin.recovery_denied',
  /** The backdoor was used. Should be near-never. */
  ADMIN_RECOVERY_USED: 'admin.recovery_used',
  /** Someone is attempting the C3 link-poisoning attack. */
  UNTRUSTED_FORWARDED_HOST: 'security.untrusted_forwarded_host',
  /** An admin_redirects row points off-site. */
  UNTRUSTED_REDIRECT_TARGET: 'security.untrusted_redirect_target',
  /** An account is trying to mailshot other users. */
  NOTIFICATION_FLOOD: 'abuse.notification_flood',
  /** The daily audit-log digest. */
  AUDIT_DIGEST: 'audit.digest',
} as const
