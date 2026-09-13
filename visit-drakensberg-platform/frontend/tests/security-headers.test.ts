import { describe, it, expect } from 'vitest'
import {
  securityHeaders,
  BASE_SECURITY_HEADERS,
  ENFORCED_CSP,
  REPORT_ONLY_CSP,
  CREDENTIAL_URL_ROUTES,
} from '../security-headers.mjs'

/**
 * Regression tests for H2 — the application shipped with no security headers
 * at all. These assert the policy exists and keeps its two load-bearing
 * properties: the consoles are not framable, and capability URLs do not leak
 * through Referer.
 */

type Header = { key: string; value: string }
const base = new Map(BASE_SECURITY_HEADERS.map((h: Header) => [h.key, h.value]))

describe('base security headers', () => {
  it.each([
    'Content-Security-Policy',
    'Content-Security-Policy-Report-Only',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
  ])('sends %s', key => {
    expect(base.get(key)).toBeTruthy()
  })

  it('forbids framing the site from another origin', () => {
    expect(base.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(ENFORCED_CSP).toContain("frame-ancestors 'self'")
  })

  it('still allows the admin editor to frame public pages same-origin', () => {
    expect(base.get('X-Frame-Options')).not.toBe('DENY')
    expect(ENFORCED_CSP).not.toContain("frame-ancestors 'none'")
  })

  it('does not send the path cross-origin', () => {
    expect(base.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('blocks MIME sniffing', () => {
    expect(base.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('sets HSTS for at least a year, without preload', () => {
    const hsts = base.get('Strict-Transport-Security')!
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1])
    expect(maxAge).toBeGreaterThanOrEqual(31536000)
    expect(hsts).toContain('includeSubDomains')
    // preload is a one-way door for the apex domain — not ours to set here.
    expect(hsts).not.toContain('preload')
  })

  it('denies the device APIs the app never uses', () => {
    const pp = base.get('Permissions-Policy')!
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(pp).toContain(`${feature}=()`)
    }
  })
})

describe('enforced CSP is limited to directives that cannot break a page', () => {
  it('enforces only frame-ancestors, object-src and base-uri', () => {
    const directives = ENFORCED_CSP.split(';').map(d => d.trim().split(' ')[0]).sort()
    expect(directives).toEqual(['base-uri', 'frame-ancestors', 'object-src'])
  })

  it('does not enforce script-src yet — that is the Report-Only policy\'s job', () => {
    expect(ENFORCED_CSP).not.toContain('script-src')
    expect(REPORT_ONLY_CSP).toContain('script-src')
  })

  it('pins base-uri so injected markup cannot re-point relative URLs', () => {
    expect(ENFORCED_CSP).toContain("base-uri 'self'")
  })
})

describe('report-only CSP covers the hosts the app actually talks to', () => {
  it.each([
    'https://*.supabase.co',
    'https://api.mapbox.com',
    'https://maps.googleapis.com',
  ])('allows connecting to %s', host => {
    expect(REPORT_ONLY_CSP).toContain(host)
  })

  it('allows the blob workers Mapbox GL creates', () => {
    expect(REPORT_ONLY_CSP).toContain("worker-src 'self' blob:")
  })

  it('restricts form submissions to our own origin', () => {
    expect(REPORT_ONLY_CSP).toContain("form-action 'self'")
  })
})

describe('capability URLs do not leak through Referer', () => {
  const rules = securityHeaders()

  it.each(CREDENTIAL_URL_ROUTES)('sends no-referrer on %s', (source: string) => {
    const rule = rules.find(r => r.source === source)
    expect(rule).toBeDefined()
    expect(rule!.headers.find((h: Header) => h.key === 'Referrer-Policy')?.value).toBe('no-referrer')
  })

  it('covers every route family whose URL is the credential', () => {
    // /invoices/inv-<uuid>, /waiver/<token> and /quotes/<id> all open without a
    // session — the URL is the only thing proving the holder was given it.
    expect(CREDENTIAL_URL_ROUTES).toEqual(
      expect.arrayContaining(['/invoices/:path*', '/waiver/:path*', '/quotes/:path*']),
    )
  })

  it('applies the base headers to every route', () => {
    const catchAll = rules.find(r => r.source === '/:path*')
    expect(catchAll).toBeDefined()
    expect(catchAll!.headers).toBe(BASE_SECURITY_HEADERS)
  })
})
