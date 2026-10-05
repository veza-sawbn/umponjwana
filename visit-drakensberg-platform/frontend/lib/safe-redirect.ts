/**
 * Validate a caller-supplied post-auth redirect target.
 *
 * WHY
 *   /api/auth/callback took ?next= and did:
 *
 *       return NextResponse.redirect(new URL(next, request.url))
 *
 *   new URL('https://attacker.example/x', base) returns the ABSOLUTE url — the
 *   base is ignored entirely. So ?next=https://attacker.example exchanged the
 *   auth code, set the session cookie, and then forwarded the user off-site
 *   from our own domain at the end of a flow they trust. Anything in the URL
 *   fragment travelled with them.
 *
 *   /auth/login?redirect= is fed the same shape by the middleware's login
 *   bounce, so the check lives here rather than in one route.
 *
 * THE RULE
 *   Same-origin paths only. A valid target starts with a single '/', is not
 *   protocol-relative ('//host' and '/\host' are both treated as absolute by
 *   browsers), carries no scheme, and holds no control characters. Both the
 *   raw value and its fully-decoded form must pass, so an encoded
 *   '%2f%2fattacker.example' cannot survive a later decode step.
 */

const DEFAULT_TARGET = '/auth/reset-password'

/** Anything at or below U+0020, plus DEL. Built from escapes, never literals. */
const CONTROL_OR_SPACE = new RegExp('[\\u0000-\\u0020\\u007f]')

/** Decode repeatedly so a double-encoded separator can't hide. */
function fullyDecode(value: string): string {
  let current = value
  for (let i = 0; i < 3; i++) {
    let next: string
    try {
      next = decodeURIComponent(current)
    } catch {
      return current
    }
    if (next === current) return current
    current = next
  }
  return current
}

export function isSafeRedirectPath(target: unknown): target is string {
  if (typeof target !== 'string' || target === '') return false

  for (const form of [target, fullyDecode(target)]) {
    // Control characters (NUL, CR and LF split headers) and whitespace are
    // never legitimate in a path we generated.
    if (CONTROL_OR_SPACE.test(form)) return false

    // Must be a rooted path, and not protocol-relative: browsers treat both
    // '//host' and '/\host' as absolute.
    if (!form.startsWith('/')) return false
    if (form.startsWith('//') || form.startsWith('/\\')) return false

    // Any scheme at all — 'https:', 'javascript:', 'data:' — disqualifies it.
    if (/^[a-z][a-z0-9+.-]*:/i.test(form)) return false

    // Belt and braces: resolved against a throwaway origin, it must stay there.
    try {
      if (new URL(form, 'https://redirect-probe.invalid').origin !== 'https://redirect-probe.invalid') {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

/** The validated target, or `fallback` when the caller supplied something unsafe. */
export function safeRedirectPath(target: unknown, fallback: string = DEFAULT_TARGET): string {
  return isSafeRedirectPath(target) ? target : fallback
}
