/**
 * Derive the canonical site origin from an incoming Next.js route request.
 *
 * WHY THIS IS SECURITY-SENSITIVE
 *   The origin returned here becomes the host in links we EMAIL, and several
 *   of those links carry a credential: the password-reset token_hash
 *   (/api/auth/request-password-reset), a waiver signing token
 *   (/api/waivers/send), an invite or supplier-transfer password-set link.
 *   Whoever controls the host in those links receives the credential the
 *   moment the recipient clicks — so the host must never be chosen by the
 *   request.
 *
 *   It used to be. x-forwarded-host was read first, unvalidated, on the
 *   reasoning that a proxy always sets it and "cannot be wrong in the same
 *   way" a misconfigured env var can. But any client may send that header and
 *   Vercel forwards it rather than overwriting it, so
 *
 *       POST /api/auth/request-password-reset
 *       X-Forwarded-Host: attacker.example
 *       {"email":"admin@visitdrakensberg.com"}
 *
 *   mailed a genuine, correctly-signed reset email — from our own mailbox,
 *   passing SPF and DKIM — pointing at the attacker's host. That route builds
 *   its link by hand precisely to bypass Supabase's redirect allow-list, so
 *   nothing downstream caught it either. One click was full account takeover.
 *
 * THE RULE NOW
 *   A forwarded host is honoured only if it is one we already trust. The trust
 *   set is derived on the server: NEXT_PUBLIC_SITE_URL's own host, anything in
 *   TRUSTED_SITE_HOSTS, the Vercel deployment host, and localhost for dev.
 *   Preview deploys are covered by allowing *.vercel.app subdomains of the
 *   configured host's registrable domain — see isTrustedHost.
 *
 *   An untrusted forwarded host is not an error: we simply fall back to the
 *   configured origin, so the request still succeeds and the email still goes
 *   out — just to the real site. That keeps a proxy misconfiguration from
 *   taking password resets down, while never letting a header pick the host.
 *
 * PRIORITY
 *   1. x-forwarded-host, IF trusted (plus x-forwarded-proto, first value)
 *   2. NEXT_PUBLIC_SITE_URL, normalised to include a scheme and no trailing /
 *   3. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL
 *   4. req.url's own origin — last resort, correct for local dev without a proxy
 */

import { alertEvent, EVENTS } from './observability'

/** Hosts we will accept from a forwarded header, lowercased, no port. */
function trustedHosts(): string[] {
  const hosts: string[] = []

  const push = (value: string | undefined) => {
    if (!value) return
    const withScheme = value.startsWith('http') ? value : `https://${value}`
    try {
      hosts.push(new URL(withScheme).hostname.toLowerCase())
    } catch {
      /* an unparseable entry simply isn't trusted */
    }
  }

  push(process.env.NEXT_PUBLIC_SITE_URL)
  push(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  push(process.env.VERCEL_URL)
  // Escape hatch for a second public domain or a staging host, comma-separated.
  for (const entry of (process.env.TRUSTED_SITE_HOSTS ?? '').split(',')) {
    push(entry.trim())
  }
  hosts.push('localhost', '127.0.0.1')

  return hosts
}

/**
 * Is `host` one we trust to appear in a credential-bearing link?
 *
 * Exact match, or a *.vercel.app sibling of a trusted *.vercel.app host —
 * which is how Vercel names preview deploys of the same project. The suffix
 * check is deliberately anchored on a leading dot so "evilvercel.app" and
 * "notourproject.vercel.app.attacker.example" both fail.
 */
export function isTrustedHost(host: string, allowed: string[] = trustedHosts()): boolean {
  const candidate = host.trim().toLowerCase().split(':')[0]
  if (!candidate) return false
  if (allowed.includes(candidate)) return true

  // Preview deploys: any *.vercel.app is trusted only if a *.vercel.app host
  // is itself configured, so a project that never deploys to Vercel gains
  // nothing from this branch.
  if (candidate.endsWith('.vercel.app')) {
    return allowed.some(a => a === 'vercel.app' || a.endsWith('.vercel.app'))
  }
  return false
}

/** The origin we fall back to when no trusted forwarded host is present. */
export function configuredOrigin(req?: Request): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
  if (raw) {
    const withScheme = raw.startsWith('http') ? raw : `https://${raw}`
    return withScheme.replace(/\/+$/, '')
  }
  if (req) {
    try {
      return new URL(req.url).origin
    } catch {
      /* fall through */
    }
  }
  return 'http://localhost:3000'
}

export function getSiteOrigin(req: Request): string {
  const fwdHost = req.headers.get('x-forwarded-host')
  if (fwdHost) {
    const host = fwdHost.split(',')[0].trim()
    if (isTrustedHost(host)) {
      const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
      // Only ever http or https — a forwarded proto of "javascript" or "data"
      // would otherwise be pasted straight into an href.
      const scheme = proto === 'http' ? 'http' : 'https'
      return `${scheme}://${host.toLowerCase()}`
    }
    // Nobody sends this header by accident to a host we do not own: it is
    // either a proxy misconfiguration or an attempt at the C3 reset-link
    // poisoning attack. Either way somebody should look.
    void alertEvent({
      event: EVENTS.UNTRUSTED_FORWARDED_HOST,
      severity: 'warn',
      fields: { host, path: (() => { try { return new URL(req.url).pathname } catch { return null } })() },
    })
  }

  return configuredOrigin(req)
}
