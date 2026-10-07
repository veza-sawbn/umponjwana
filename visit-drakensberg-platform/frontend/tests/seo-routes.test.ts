import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { STATIC_ROUTES, EDITORIAL_FALLBACK_SLUGS } from '@/lib/seo-routes'

/**
 * Regression tests for the two ways a page ends up submitted to Google and
 * then dropped, both of which this repo has actually shipped:
 *
 *   1. A route in the sitemap that sets no canonical of its own. Next merges
 *      metadata down the segment tree, so it inherits the root layout's
 *      `alternates: { canonical: '/' }` — telling Google it is a duplicate of
 *      the homepage. /report-a-concern sat in the sitemap in exactly that
 *      state. Search Console reports it as "Alternate page with proper
 *      canonical tag", which reads like a correct answer rather than a bug.
 *
 *   2. A route in the sitemap that is noindex. /search was listed with
 *      priority 0.8 while app/search/layout.tsx set `robots: { index: false }`
 *      — crawl budget spent to be told to drop the result.
 *
 * Both are invisible in review (the sitemap and the metadata are different
 * files, and neither is wrong on its own) and invisible in the build. They
 * surface weeks later in a console nobody has open. So they are asserted here
 * against the real files instead.
 */

const APP = path.resolve(__dirname, '..', 'app')

/** Every file whose metadata applies to a route, nearest segment first. */
function metadataSourcesFor(routePath: string): string[] {
  const segments = routePath.split('/').filter(Boolean)
  const files: string[] = []
  for (let depth = segments.length; depth >= 0; depth--) {
    const dir = path.join(APP, ...segments.slice(0, depth))
    for (const name of ['page.tsx', 'layout.tsx']) {
      const file = path.join(dir, name)
      if (existsSync(file)) files.push(file)
    }
  }
  return files
}

/** The nearest file that declares its own canonical, if any. */
function canonicalSource(routePath: string): string | null {
  for (const file of metadataSourcesFor(routePath)) {
    // Skip the root layout: its canonical is the inherited '/' that is the
    // whole problem, and counting it would make every route look covered.
    if (file === path.join(APP, 'layout.tsx')) continue
    if (/alternates:\s*\{[^}]*canonical/.test(readFileSync(file, 'utf8'))) return file
  }
  return null
}

describe('every route in the sitemap sets its own canonical', () => {
  // The homepage is the one route the root layout's canonical is correct for.
  const routes = STATIC_ROUTES.filter(r => r.path !== '')

  it.each(routes.map(r => r.path))('%s', routePath => {
    expect(canonicalSource(routePath), `${routePath} is in STATIC_ROUTES (lib/seo-routes.ts) but no page.tsx or layout.tsx on its path sets alternates.canonical, so it inherits the root layout's canonical of "/" and tells Google it duplicates the homepage`).not.toBeNull()
  })

  it('the homepage is covered by the root layout', () => {
    const root = readFileSync(path.join(APP, 'layout.tsx'), 'utf8')
    expect(root).toMatch(/alternates:\s*{\s*canonical:\s*'\/'\s*}/)
  })
})

describe('nothing in the sitemap is noindex', () => {
  it.each(STATIC_ROUTES.map(r => r.path))('%s', routePath => {
    for (const file of metadataSourcesFor(routePath)) {
      const source = readFileSync(file, 'utf8')
      // `robots: { index: false }`, however it is spelled out.
      const noindex = /robots:\s*\{[^}]*index:\s*false/.test(source)
      expect(noindex, `${file} sets robots.index = false, which applies to ${routePath || '/'} — remove the route from STATIC_ROUTES in lib/seo-routes.ts rather than submitting a page Google is told to drop`).toBe(false)
    }
  })
})

describe('the route list itself is well formed', () => {
  it('has no duplicate paths', () => {
    const paths = STATIC_ROUTES.map(r => r.path)
    expect(paths).toHaveLength(new Set(paths).size)
  })

  it('uses rooted paths with no trailing slash', () => {
    for (const { path: p } of STATIC_ROUTES) {
      if (p === '') continue
      expect(p.startsWith('/'), `${p} must start with /`).toBe(true)
      expect(p.endsWith('/'), `${p} must not end with /`).toBe(false)
    }
  })

  it('keeps priorities in the range sitemaps.org defines', () => {
    for (const { path: p, priority } of STATIC_ROUTES) {
      expect(priority, `${p || '/'}`).toBeGreaterThan(0)
      expect(priority, `${p || '/'}`).toBeLessThanOrEqual(1)
    }
  })

  it('still matches the articles compiled into the journal route', () => {
    // EDITORIAL_FALLBACK_SLUGS stands in for the ARTICLES record in
    // app/mydrakensberg/[slug]/page.tsx. A slug removed there and left here
    // puts a 404 in the sitemap; one added there and not here is simply never
    // submitted. Neither shows up anywhere else.
    const route = readFileSync(
      path.join(APP, 'mydrakensberg', '[slug]', 'page.tsx'), 'utf8',
    )
    const compiled = [...route.matchAll(/^ {2}'([a-z0-9-]+)': {$/gm)].map(m => m[1])

    expect(compiled.length).toBeGreaterThan(0)   // guard the regex itself
    expect([...EDITORIAL_FALLBACK_SLUGS].sort()).toEqual([...compiled].sort())
  })
})
