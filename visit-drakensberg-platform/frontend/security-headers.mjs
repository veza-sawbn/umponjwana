/**
 * Security response headers.
 *
 * Kept in its own module so next.config.mjs stays readable and so the policy
 * can be asserted in tests (tests/security-headers.test.ts) rather than only
 * observed in a browser.
 *
 * WHAT SHIPPED BEFORE THIS
 *   Nothing. No CSP, no HSTS, no frame-ancestors, no Referrer-Policy, no
 *   nosniff. The admin and supplier consoles — where a single click approves a
 *   supplier, records a payment or revokes an invoice link — were framable by
 *   any site.
 *
 * THE REFERRER POLICY IS THE IMPORTANT ONE
 *   This application's whole customer document model is capability URLs:
 *   /invoices/inv-<uuid>, /waiver/<token>, /quotes/<id>. The URL *is* the
 *   credential (see 20260810_invoice_open_by_id.sql, which says so plainly).
 *   Under the browser default, every outbound link, image and analytics
 *   request from one of those pages put the full URL in the Referer header —
 *   and those pages load Mapbox, Google Maps and Unsplash assets. The
 *   credential leaked to third parties on render.
 *
 *   Site-wide we send strict-origin-when-cross-origin, which drops the path
 *   cross-origin. On the document routes themselves we send no-referrer, so
 *   not even the origin travels.
 *
 * WHY THE CSP IS SPLIT
 *   Only directives that cannot break rendering are enforced today:
 *   frame-ancestors (clickjacking), object-src (legacy plugin embedding) and
 *   base-uri (stops injected markup re-pointing every relative URL on the
 *   page). The full policy ships as Report-Only because this app needs
 *   'unsafe-inline' unwound first — Next's bootstrap scripts, the JSON-LD
 *   blocks, Tailwind/framer-motion inline styles and Mapbox's blob workers all
 *   need accounting for, and guessing at that in a security patch is how you
 *   take a production site down. Collect reports, tighten, then promote it to
 *   Content-Security-Policy.
 */

/** Hosts the app genuinely talks to, for the Report-Only policy. */
const CONNECT_SRC = [
  "'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'https://api.mapbox.com',
  'https://events.mapbox.com',
  'https://maps.googleapis.com',
]

const IMG_SRC = [
  "'self'",
  'data:',
  'blob:',
  'https://*.supabase.co',
  'https://images.unsplash.com',
  'https://plus.unsplash.com',
  'https://api.mapbox.com',
  'https://*.tile.openstreetmap.org',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
]

/** Enforced now — none of these can break a working page. */
export const ENFORCED_CSP = [
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

/** Reported now, enforced once the inline-script work is done. */
export const REPORT_ONLY_CSP = [
  "default-src 'self'",
  // 'unsafe-inline'/'unsafe-eval' are present deliberately: this is a
  // measurement policy, and a report stream full of violations the app cannot
  // avoid yet would drown the ones that matter.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src ${IMG_SRC.join(' ')}`,
  "font-src 'self' data:",
  `connect-src ${CONNECT_SRC.join(' ')}`,
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  'upgrade-insecure-requests',
].join('; ')

export const BASE_SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: ENFORCED_CSP },
  { key: 'Content-Security-Policy-Report-Only', value: REPORT_ONLY_CSP },
  // Belt and braces with frame-ancestors, for anything that still reads it.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    // The app uses none of these. Geolocation is included: nothing in the
    // codebase calls getCurrentPosition, and the maps are address-driven.
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    // Two years, subdomains included. Not preloaded — that is a one-way door
    // and belongs to whoever owns the apex domain, not to this config.
    value: 'max-age=63072000; includeSubDomains',
  },
]

/**
 * Routes whose URL is itself the credential. These must not leak even the
 * origin, because the Referer of a request from /waiver/<token> tells a third
 * party that a waiver flow is in progress for a visitor it can fingerprint.
 */
export const CREDENTIAL_URL_ROUTES = ['/invoices/:path*', '/waiver/:path*', '/quotes/:path*']

export function securityHeaders() {
  return [
    { source: '/:path*', headers: BASE_SECURITY_HEADERS },
    ...CREDENTIAL_URL_ROUTES.map(source => ({
      source,
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    })),
  ]
}
