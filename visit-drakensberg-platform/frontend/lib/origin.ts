/**
 * Derive the canonical site origin from an incoming Next.js route request.
 *
 * Priority (most → least reliable):
 *   1. x-forwarded-host + x-forwarded-proto
 *      Vercel, Render, nginx and virtually every proxy set these. They reflect
 *      the public URL the browser used — exactly what we need for email links.
 *      x-forwarded-proto may be a comma-separated list; we take the first value.
 *   2. NEXT_PUBLIC_SITE_URL env var
 *      Always normalised to include "https://" (the env var is sometimes
 *      configured without a scheme, e.g. "umponjwana.vercel.app"). Trailing
 *      slashes are stripped.
 *   3. req.url host
 *      Last resort. In production this is often an internal container address,
 *      but it is never wrong for local dev without a proxy.
 *
 * WHY NOT NEXT_PUBLIC_SITE_URL FIRST?
 *   If that variable is misconfigured — e.g. pointing at the Supabase REST API
 *   URL (https://project.supabase.co/rest/v1/) instead of the site — every
 *   email link ends up redirecting to the REST API, which responds with
 *   {"message":"No API key found in request",...}.
 *   The forwarded headers reflect the actual public URL the caller used and
 *   cannot be wrong in the same way.
 */
export function getSiteOrigin(req: Request): string {
  // 1. Forwarded headers — most reliable in production
  const fwdHost = req.headers.get('x-forwarded-host')
  if (fwdHost) {
    const host = fwdHost.split(',')[0].trim() // take first if comma-separated
    const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
    return `${proto}://${host}`
  }

  // 2. NEXT_PUBLIC_SITE_URL env var — normalised
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  if (rawSiteUrl) {
    const withScheme = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`
    return withScheme.replace(/\/+$/, '') // strip trailing slashes
  }

  // 3. Derive from the request URL itself
  return new URL(req.url).origin
}
