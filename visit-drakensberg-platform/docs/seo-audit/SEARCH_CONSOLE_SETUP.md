# Getting indexed — Search Console setup and the crawl surface

**Companion to:** the 2026-08-13 audit in this folder. That audit asked
*"can this site rank?"*; this file covers the narrower, more immediate
question — **is Google able to find, fetch and keep every public page?** — and
records the answer as it stands after the indexing pass.

Everything in §2 is code and is already deployed with this change. §1 is the
part code cannot do: a human has to click it once.

---

## 1. The one-time console setup

### Google Search Console

1. Set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in the Vercel **Production**
   environment and redeploy.
   - Search Console → **Add property** → **URL prefix** → `https://visitdrakensberg.com`
   - Choose the **HTML tag** method. Copy only the `content="…"` value, not
     the whole `<meta>` tag.
   - The root layout renders it (`app/layout.tsx`, `verification.google`). When
     the variable is unset, no tag is emitted at all — so preview deploys and
     local dev stay clean.
2. Press **Verify**. Leave the variable in place afterwards: Google re-checks
   it periodically, and losing verification takes sitemap submission and the
   Indexing report with it.
3. **Sitemaps** → submit `sitemap.xml`. It lives at
   `https://visitdrakensberg.com/sitemap.xml` and is also advertised in
   `robots.txt`.
4. **URL Inspection** → paste the homepage and a couple of the money pages
   (`/stays`, `/hikes`) → **Request indexing**. This is worth doing once for
   the top of each section; it is not worth doing per listing — the sitemap
   handles those.
5. Choose a **domain property** instead of a URL-prefix property only if you
   also want to cover `www.` and `http://`. That method verifies via a DNS TXT
   record rather than the meta tag, and the env var is then unnecessary.

### Bing (optional)

`NEXT_PUBLIC_BING_SITE_VERIFICATION` emits `msvalidate.01` the same way. Bing
Webmaster Tools can also just import a verified Google property, which is less
work.

### What to watch afterwards

In **Pages** (the indexing report), these are the labels that mean something
is wrong with the crawl surface rather than with the content:

| Label | What it means here |
|---|---|
| *Excluded by 'noindex' tag* on a submitted URL | The sitemap and the page disagree. Both are generated, so this means a route gained a `robots: { index: false }` without leaving `lib/seo-routes.ts`. |
| *Alternate page with proper canonical tag* | The page is pointing its canonical somewhere else. See §2.2 — this was the site-wide failure mode before this change. |
| *Discovered – currently not indexed* | Google knows the URL and has not fetched it yet. Normal for a large sitemap; a persistent backlog points at thin pages or slow responses, not at configuration. |
| *Indexed, though blocked by robots.txt* | Something links to a disallowed path. Add a `noindex` to that route instead of widening the disallow (see §2.4). |

---

## 2. What the code now guarantees

### 2.1 Every public page is in the sitemap, and the sitemap is fresh

`app/sitemap.ts` emits static routes, both editorial sources (published
`blog_posts` rows **and** the articles still compiled into
`app/mydrakensberg/[slug]/page.tsx`, deduplicated by slug), published field
guides, and every indexable entity — trails, stays, activities, packages,
tours, regions, reserves, towns and shuttle routes.

It revalidates hourly (`export const revalidate = 3600`). Before, it was
prerendered once per deploy: a lodge a supplier published on Tuesday stayed
out of the sitemap until something unrelated triggered a build.

The static list lives in `lib/seo-routes.ts` because the admin **Sitemap
Control** tool (`/admin/seo/sitemap`) reports on the same set and used to keep
a hand-copied count — which had already drifted to 19 against 22 emitted
routes. Both read the module now.

**Adding a public page?** Add it to `STATIC_ROUTES` in that module, and give
the route its own canonical (see next).

### 2.2 Every indexable page sets its own canonical

The root layout sets `alternates: { canonical: '/' }`, and Next merges
metadata *down* the segment tree — so any route that does not set its own
inherits the homepage's. A page in that state tells Google it is a duplicate
of the homepage, which is a request not to index it.

Every indexable route now sets its own canonical, via its `page.tsx`
(server routes) or a sibling `layout.tsx` (the `'use client'` listing pages,
which cannot export metadata themselves). `/report-a-concern` was the last one
missing: it was in the sitemap *and* canonicalised to `/`.

### 2.3 Pages that should not rank say so on the page

`/search`, `/trip`, `/experiences/compare`, `/experiences/request`,
`/unsubscribe`, `/waiver/[token]`, `/maintenance`, `/invoices/[id]`,
`/quotes/[id]` and `/itinerary/[id]/print` carry `robots: { index: false }`.
`/search` was also removed from the sitemap — submitting a noindex URL spends
crawl budget to be told to drop the result.

`/maintenance` matters more than the rest: while the toggle is on,
`middleware.ts` redirects every public URL to it.

### 2.4 noindex and Disallow are not interchangeable

`robots.txt` disallows the private consoles only — `/admin/`, `/supplier/`,
`/operations/` (added with this change; it was the one console prefix
missing), `/account/`, `/dashboard/`, `/checkout/`, `/api/`, `/auth/`,
`/invoices/`, `/itinerary/`, `/quotes/`.

Public-but-not-rankable pages are handled with `noindex` instead, because a
crawler has to be *allowed to fetch* a page to read a `noindex` off it. A
disallowed URL that something links to can still be indexed URL-only — that is
what *"Indexed, though blocked by robots.txt"* reports.

### 2.5 Result appearance

- `max-image-preview:large` in the `googleBot` directive — without it, listing
  photos are capped at a thumbnail in Google Images and Discover.
- A `WebSite` node in the root JSON-LD graph, which is what Google reads for
  the **site name** shown above a mobile result; otherwise it guesses from the
  domain or the `<title>`.
- `app/opengraph-image.tsx` — a generated 1200×630 fallback share card. The
  site had no OG image at all, so every share of the homepage or a category
  page rendered as a bare grey link. Detail pages still use their own listing
  photo; this only fills the gap.

---

## 3. Known, deliberate limits

**Listing pages render client-side.** `/stays`, `/hikes`, `/activities`, the
homepage and the other index pages are `'use client'` and fetch in `useEffect`,
so their card grids are not in the server HTML. Google executes JavaScript and
does index them, but rendering is a second, slower queue, and it is the weakest
part of the crawl surface that remains. The fix is the server-shell pattern the
detail routes already use (`docs/destination-graph/PHASE_B.md`) — a server
component that fetches and renders the existing client component as an island.
That is a per-route change and was left out of this pass deliberately.

**Maintenance mode answers 302, not 503.** `middleware.ts` redirects to
`/maintenance`, which is now `noindex`, so the stub itself will not be indexed.
But the correct signal for a temporary outage is `503 Service Unavailable`
with `Retry-After`: a long window served as a 302 to a 200 page risks Google
treating the redirect as permanent site structure. Fine for short windows;
worth changing before any long one.

**UUID URLs persist on commercial entities.** `/stays/prop-8f3a2b1c-…` where a
slug has not been set. The sitemap emits the same `slug || id` form the route
canonicalises to, so nothing is inconsistent — but the keyword signal is
missing. `/admin/seo/sitemap` lists these as "slug gaps"; filling one in the
entity editor fixes that URL immediately.
