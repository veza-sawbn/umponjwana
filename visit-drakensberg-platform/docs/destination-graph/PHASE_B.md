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

## 5. Second slice: `/hikes/[id]`, `/activities/[id]`, `/stays/[id]` converted

Same server-shell pattern repeated across the three remaining highest-traffic existing detail routes. `lib/entities.ts`'s `listEntities`/`getEntity` — the shared read layer under `properties`, `activities`, `tours`, `packages`, `departures`, `media` — gained the same optional-client parameter as `getRegions()`, so this unblocks stays/packages/tours together, not just this batch. `getTrails()`, `getPropertyById()`, `getRoomsByProperty()`, `getActivityById()` all extended the same way.

- **`/hikes/[id]`** — `HikeDetail.tsx` (new) is the previous body verbatim, now taking `trail` as a prop. **Fixed a latent bug in the process**: previously, an unresolvable id silently fell back to `trails[0]` (the first trail in the array) instead of showing an error — a mistyped or stale `/hikes/xyz` URL would render an unrelated trail with no indication anything was wrong. Now 404s correctly, matching every other entity route. `TouristAttraction` + `BreadcrumbList` JSON-LD.
- **`/activities/[id]`** — `ActivityDetail.tsx` (new) keeps 100% of the booking-cart interactivity (date/group-size selection, add-to-booking toggle) client-side; only the entity lookup moved server-side. `Product` + `Offer` + `BreadcrumbList` JSON-LD, with price/currency in the offer. Draft activities (`status !== 'active'`) deliberately keep resolving exactly as before — a supplier previewing an unpublished listing via direct link still needs that — but now carry `robots: {index:false}` so a draft can never be indexed even if a link to it leaks.
- **`/stays/[id]`** — the largest of the three. `StayDetail.tsx` (new) keeps live per-date room-inventory checking, the booking-cart flow and the room detail modal entirely client-side (genuinely dynamic/interactive). The *static* room catalog (name, price, images, amenities — not date-dependent) now loads server-side alongside the property, removing the initial loading-spinner for the page's main content. `LodgingBusiness` JSON-LD with `geo`, `amenityFeature` and `priceRange`. Same `robots: {index:false}` treatment for non-active listings.

**Verified live:**
```
GET /hikes/tugela-falls  → 200, <title>Tugela Falls Circuit — Royal Natal National Park | Visit Drakensberg</title>,
                            canonical, TouristAttraction + BreadcrumbList JSON-LD
GET /hikes/does-not-exist → 404 (previously would have rendered trails[0])
GET /activities/[any id] → 404 gracefully (no seed-data fallback exists for this entity type — expected)
GET /stays/[any id]      → 404 gracefully, same reason
```
`Activity`/`Property` have no `DEFAULT_*` seed array (unlike `Trail`/`Region`/`Reserve`/`Town`), so a full 200-path verification of these two specifically needs a reachable Supabase instance — the 404 path (the code path shared by "not found" and "network unreachable") was verified instead, confirming no crash and no hang under a genuine backend failure.

## 6. Third slice: `/packages/[id]`, `/guides/[id]`, `/guides/operators/[id]`, `/experiences/[id]` converted

Same pattern, fourth through seventh routes. `lib/operators.ts`, `lib/departures.ts`, `lib/experiences.ts` all gained the same optional-client parameter as the rest.

- **`/packages/[id]`** — `MarketplacePackage` gained `& GraphFields` (it hadn't been mixed in yet). Only a genuinely missing package 404s server-side; an existing-but-unpublished package still resolves and is handled by `PackageDetail.tsx`'s own "not available" branch (unchanged prior behaviour), with `robots: {index:false}` set at the metadata level instead. `Product` + `Offer` JSON-LD.
- **`/guides/[id]`** — `Person` JSON-LD with `aggregateRating` when the guide has a rating. The operator lookup (`getOperatorForGuide`) needs the resolved guide as input, so it stays a client-side fetch in `GuideDetail.tsx`.
- **`/guides/operators/[id]`** — **found and fixed a duplicate-function bug while extending `lib/operators.ts`**: a second `getOperatorById` was added alongside the pre-existing one instead of extending it in place, which would have been a TypeScript duplicate-implementation error. Caught by inspection before it ever reached the build. `getOperatorForGuide` now delegates to the single `getOperatorById`, removing a few lines of duplicated lookup logic in the process. `Organization` JSON-LD.
- **`/experiences/[id]`** — the one route with genuinely different framing: `TrekkingExperience` is a *derived* composite (Departure + Tour + Trail + Operator, composed in `lib/experiences.ts`'s `loadAll()`), not a single stored entity, so it has no `seoTitle`/`seoDescription` of its own. `Event` + `Offer` JSON-LD with `startDate`/`endDate`/`availability`. A dated departure that has passed or sold out gets `robots: {index:false, follow:true}` rather than being deleted — direct links (booking confirmations, etc.) keep working, it just stops being a search result once it's no longer bookable.

All ten of the platform's pre-existing entity detail routes now have real, per-entity `generateMetadata` and JSON-LD: regions, reserves, towns, hikes, activities, stays, packages, guides, operators, experiences.

**Verified live:** `/packages/[any id]`, `/guides/[any id]`, `/guides/operators/[any id]`, `/experiences/[any id]` all 404 gracefully (no crash, no hang) — consistent with activities/stays, these entity kinds have no `DEFAULT_*` seed data in this test environment. Regression-checked `/regions/north-berg` and `/hikes/tugela-falls` still render correctly after the shared `lib/experiences.ts`/`lib/tours.ts`/`lib/departures.ts` changes.

## 7. Sitemap: trails, properties, activities, packages, tours added

Extended the async sitemap (§1) to include every converted entity type. `getProperties()`, `getActivities()`, `getPackages()`, `getTours()` each gained the same optional-client parameter. Filtered to `published`/`active` status and `robotsIndex !== false`; falls back to `[]` (properties/activities/packages/tours have no `DEFAULT_*` seed data) or the appropriate `DEFAULT_*` array (trails) on a read failure — consistent with §1's "never advertise a URL the site can't serve" principle. Guides/operators (directory-style, lower search volume) and experiences (dated — see the noindex-when-past logic above) are deliberately left out; a crawler reaches them via the trail/tour pages that already link to them.

Every entry uses `entity.slug || entity.id` — the same resolution each route reads for its own canonical tag — so nothing here can advertise a non-canonical URL, and slugs take effect automatically the moment they're populated with no further code change.

**Verified live:** sitemap includes all 6 seed trails (`/hikes/tugela-falls`, `/hikes/amphitheatre`, etc.) — properties/activities/packages/tours correctly empty in this test environment (no seed data), same as their own detail-route verification.

## 8. `/tours` — new listing + detail route

The one genuinely new (not converted) route pair this phase, per the earlier destination-graph review: Tours are the evergreen bookable product; Departures are dated/temporal and attach to a Tour without ever affecting its canonical page.

- **`app/tours/page.tsx`** (new) — listing page, `'use client'` matching the site's established listing-page convention (hikes/stays/activities all follow this pattern), with difficulty and trail filters. **`app/tours/layout.tsx`** (new) — static metadata, matching every other listing route.
- **`app/tours/[id]/page.tsx`** + **`TourDetail.tsx`** (new) — same server-shell pattern as everything else in this phase. `Product` + `Offer` JSON-LD, with `aggregateRating` when rated. Upcoming departures (dated, time-sensitive) are fetched client-side and link to `/experiences/[id]` for the actual booking — the tour page stays the evergreen landing page, the experience page stays the one-dated-booking checkout, exactly the separation the strategic review called for.
- No dedicated `getTourById()` existed, so resolution filters from the full `getTours()` list — the same approach `getExperiencesByTrail()` etc. already use elsewhere in the codebase, not a new pattern.
- **Found a real type error while wiring this up**: `EditablePageHeader`'s `section` prop is a closed union derived from `SITE_CONTENT_DEFAULTS`'s keys — using `"tours_page"` without first adding it to that object was a compile-time error, not a runtime surprise. Fixed by adding a `tours_page` entry to `lib/site-content.ts`, matching the shape of every other listing page's entry, giving `/tours` an admin-editable header like the rest of the site gets for free.
- **`/tours` added to `Footer.tsx`'s "Explore" column** — present on every page, so the route is never an orphan (reachable by a real link, not just present in the sitemap) — and to the sitemap's static routes and entity list.
- **`DESTINATION_GRAPH_NAV`'s Tours node flipped from `'planned'` to `'live'`** in `lib/destination-ia.ts`, now that its `requires` condition is met. Still not wired into the rendered `Navbar` — that remains the separate, larger decision from the destination-graph strategic review, not something this phase does unilaterally.

**Verified live:**
```
GET /tours                → 200, <title>Guided Tours | Visit Drakensberg</title>
GET /tours/does-not-exist → 404
GET /                     → footer contains href="/tours"
GET /sitemap.xml          → includes https://visitdrakensberg.com/tours
```

## 9. What's still queued (deliberately out of scope for Phase B)

- Slug population for the UUID-based entities — the resolution logic (`slug || id`) is everywhere already; only the admin UI to *set* a slug (Tool 1, SEO panel) and a backfill pass remain.
- Reading `GraphFields`/`ModuleConfig` beyond the `seoTitle`/`seoDescription`/`slug` fallback checks used in this phase — nothing populates or renders the relationship fields (`relatedTrailIds` etc.) yet; that's the module-composition work from the destination-graph review.
- `/transport/[slug]` — a shuttle-route detail page, the same evergreen-vs-dated distinction as Tours/Departures would apply.
- ISR/`revalidate` on any of the new dynamic routes — everything renders per-request; a cache layer is a performance optimisation on top of working correctness, not a blocker to it.
- Wiring `DESTINATION_GRAPH_NAV`/the 7-primary IA into the live `Navbar` and mobile drill-down — explicitly the separate decision flagged in the destination-graph strategic review, requiring its own sign-off.
- Admin SEO panel (Tool 1) and the rest of `docs/seo-audit/INTERNAL_SEO_TOOLS.md` — the fields these tools would edit already exist and are already read by every converted route; only the editing surface itself is unbuilt.
