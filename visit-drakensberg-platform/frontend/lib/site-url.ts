/**
 * The site's public origin, for building links that leave the building —
 * invoice URLs in email, and the callback/return URLs handed to the payment
 * gateway.
 *
 * NEXT_PUBLIC_SITE_URL is set by hand on the host, and the two ways it gets
 * set wrong both fail quietly:
 *   * no scheme ('umponjwana.vercel.app') — every emailed invoice link
 *     becomes relative and dead, and iKhokha gets a callbackUrl it cannot
 *     post to, so real payments complete at the gateway and never reconcile;
 *   * a trailing slash — every URL built from it gets a double slash.
 * Neither shows up in testing on localhost, where the request origin is used
 * instead. So normalise here rather than trusting the value.
 */
export function siteOrigin(req?: { url: string }): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (configured) {
    // A bare hostname is the common mistake; assume https rather than
    // discarding an otherwise usable value.
    const withScheme = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
    try {
      return new URL(withScheme).origin
    } catch {
      // Unparseable — fall through to the request's own origin, which is
      // always right on Vercel even when the env var is not.
    }
  }

  if (req) {
    try {
      return new URL(req.url).origin
    } catch {}
  }

  return ''
}
