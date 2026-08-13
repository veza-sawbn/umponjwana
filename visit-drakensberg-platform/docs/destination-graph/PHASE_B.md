# Destination Graph — Phase B (first slice)

First real delivery-layer work: the server-shell metadata pattern, proven on one existing route and used to ship two new ones. Every claim below was verified by building the app and hitting real HTTP requests against `next start` — not just `npm run build` succeeding. `npm run build` passes (115/115 pages) throughout.

## 1. The keystone: `/regions/[slug]` converted to a server shell

Per `docs/seo-audit/ARCHITECTURE_CHANGE_DECISION.md`: the blocker to per-entity SEO was that every detail page is `'use client'`, so `generateMetadata` couldn't be exported. Fixed for regions first — it already had `seoTitle`/`seoDescription` populated (Phase A / audit G5), so it validated the pattern with the least new data risk.

- **`app/regions/[slug]/page.tsx`** — now a server component. Resolves the region server-side, exports `generateMetadata` (title, description, canonical, OG, Twitter), emits `TouristDestination` + `BreadcrumbList` JSON-LD, calls `notFound()` for an unknown slug.
- **`app/regions/[slug]/RegionDetail.tsx`** (new) — the *exact* previous page body, moved verbatim, now receiving `region` as a prop instead of fetching it client-side. Its own client-side fetch for stays/trails/activities is unchanged — those depend on `regionsMatch()` joins across multiple entity kinds and `StayDistance`'s client-only booking context, so they stay a client-rendered island rather than being forced server-side in this pass.
- **No URL changed.** `/regions/north-berg` etc. still resolve — only the render mechanism changed.

**Verified live** (`next start` + `curl`, not just build):
```
GET /regions/north-berg    → 200, <title>Northern Drakensberg | Visit Drakensberg</title>,
                              canonical, OG image, TouristDestination + BreadcrumbList JSON-LD
GET /regions/central-berg  → 200, correct per-region title/description
GET /regions/does-not-exist → 404 via not-found.tsx
```

## 2. New routes: Reserve and Town detail pages

The audit's highest-value, lowest-risk finding (`SEO_GAPS.md` G4): `Reserve` and `Town` already had `slug` + `seoTitle` + `seoDescription` + admin CRUD, but no detail page — fully authored content with zero search visibility.

- **`app/nature-reserves/[slug]/page.tsx`** (new) — pure server component (no client island needed; unlike regions, every field a reserve page needs — description, peaks, permits, best time, facilities — is already resolved server-side, so there's no hydration boundary at all). `generateMetadata` + `TouristAttraction` + `BreadcrumbList` JSON-LD.
- **`app/towns/[slug]/page.tsx`** (new) — same shape, `TouristDestination` + `BreadcrumbList`.
- **`app/towns/layout.tsx`** (new) — `/towns` never had listing-page metadata (unlike every comparable listing route); added while touching this area.
- **Listing pages wired to link to the new detail pages** — `app/nature-reserves/page.tsx` gained a "Full Reserve Guide" CTA per reserve and a linked heading; `app/towns/page.tsx`'s cards now link to their detail page. Without this, the new routes would only be reachable via the sitemap, not by an actual visitor or crawler following a link — internal linking, not just indexation.

**Verified live:**
```
GET /nature-reserves/ukhahlamba   → 200, <title>uKhahlamba-Drakensberg Park | Visit Drakensberg</title>,
                                     canonical, TouristAttraction + BreadcrumbList JSON-LD
GET /nature-reserves/does-not-exist → 404
GET /towns/winterton              → 200, correct title/description/canonical, TouristDestination JSON-LD
GET /towns/nonexistent            → 404
GET /towns                        → 200, new layout metadata present
GET /nature-reserves               → every reserve links to its /nature-reserves/[slug] page
GET /towns                         → every town card links to its /towns/[slug] page
```

## 3. Supporting infrastructure

- **`lib/supabase-public.ts`** (new) — a plain anon-key `createClient` (not the browser client-component client, not the cookie-bound server client) for reading public catalog data from Server Components / `generateMetadata`. Session-less by design, so it's safe to construct in any render context.
- **`getRegions()`, `getReserves()`, `getTowns()`** — each extended with an optional injectable `SupabaseClient` parameter, defaulting to the existing browser client. Zero behavior change for the ~20 existing call sites across the app; the new server routes are the only callers passing `publicSupabase`.
- **`app/sitemap.ts`** — converted from a static array to an `async function`, now including every region, reserve and town. Both `getReserves()`/`getTowns()` fall back to `DEFAULT_RESERVES`/`DEFAULT_TOWNS` on a read failure, matching what the live pages themselves fall back to — the sitemap never advertises a URL the site can't actually serve, and never silently drops one either.

## 4. A real bug found and fixed by testing at runtime, not just building

`npm run build` succeeding proved nothing about whether these pages actually render correctly — Next.js doesn't execute `generateMetadata` against real data at build time for a route with no `generateStaticParams`. Two genuine issues only surfaced by running `next start` and making real requests:

**Missing error handling.** `getRegions()` catches internally and falls back to `DEFAULT_REGIONS` on any Supabase read failure. `getReserves()`/`getTowns()` do not — they `throw`. The first version of the new reserve/town pages called these without a `try`/`catch`, so a transient read failure would have 500'd the entire page instead of gracefully falling back to the same default content the rest of the site already relies on. Fixed by catching and falling back to `DEFAULT_RESERVES`/`DEFAULT_TOWNS` in both the new pages and the sitemap.

**Doubled page title.** `/towns/winterton` initially rendered `<title>Winterton | Visit Drakensberg | Visit Drakensberg</title>` — the root layout's title template (`%s | Visit Drakensberg`) was being applied on top of `Town.seoTitle`, which already includes that suffix. `/regions/[slug]` did not exhibit this with the same code shape, apparently because `/regions` has an intermediate `layout.tsx` and `/towns` (before this change) did not, which changes how Next resolves the template chain. Rather than depend on that resolution behavior, fixed by using `title: { absolute: title }` in all three `generateMetadata` functions (regions, reserves, towns) — `seoTitle` already contains the exact desired title, so it should never be templated further, regardless of which layouts exist above it.

Both were caught before commit, not after.

## 5. What Phase B does not include yet (queued)

- The same server-shell pattern for the remaining five existing detail routes (`/stays/[id]`, `/hikes/[id]`, `/activities/[id]`, `/packages/[id]`, `/guides/[id]`, `/experiences/[id]`) — same recipe as regions, not yet repeated.
- Structured data beyond `TouristDestination`/`TouristAttraction`/`BreadcrumbList` (`LodgingBusiness`, `Product`/`Offer`, `Event`, `Person`/`Organization` per the audit's schema mapping).
- Slug resolution for the UUID-based entities (`prop-<uuid>` etc.) — `URL_ARCHITECTURE.md` §4.
- Reading `GraphFields`/`ModuleConfig` (Phase A's foundation types) anywhere — nothing populates or renders against them yet.
- `/tours`, `/transport/[slug]` — new listing + detail routes, not started.
- ISR/`revalidate` on the new dynamic routes.
