# Destination Graph — Phase C

Two of Phase B's queued items (§9): module composition (automatic mode) and `/transport/[slug]`. `npm run build` passes throughout. Runtime verification for this phase used a placeholder Supabase URL/anon key (this test environment has no reachable Supabase project or `.env.local`) — this exercises the full render path including every fetch's catch/fallback branch, confirming graceful degradation rather than a genuine 200-with-real-data check. Where a prior Phase B session had live data reachable, its verified output is quoted as-is below.

## 1. Module composition (automatic mode)

`lib/page-composition.ts`'s `ModuleConfig`/`ModuleMode` contract (Phase A) existed but nothing read it. No admin UI exists yet to set `curated`/`hybrid` overrides (that needs the SEO panel's page-composition editor), so every module here ships in `'automatic'` mode only: region-matched at render time (`regionsMatch()`), GPS-sorted where coordinates exist — the same relationship logic `components/booking/SmartRecommendations.tsx` already uses client-side, now formalised into reusable, server-rendered components.

- **`lib/modules.ts`** (new) — `getNearbyTrails()`, `getNearbyStays()`, `getNearbyActivities()`. Each takes a region name, an options bag (`limit`, `excludeId`, `originLat`/`originLng`), and an optional `SupabaseClient`; filters to published/active status and a matching region, sorts by distance when origin coordinates are given.
- **`components/modules/RelatedTrailsModule.tsx`**, **`NearbyStaysModule.tsx`** (new) — pure presentational, no `'use client'` directive. Content is server-fetched and passed in as props, so it's present in the initial server-rendered HTML and crawlable — unlike `SmartRecommendations`, which fetches after mount and is invisible to a crawler.
- Wired into **`/nature-reserves/[slug]`** and **`/towns/[slug]`** (previously only had CTA buttons to filtered listing pages — no actual inline cross-links existed) and **`/tours/[id]`** (nearby accommodation; a Tour has no region field of its own, so the region is derived from the trail it runs on via `resolveTourRegion()`).

This directly answers a real gap: entity detail pages had no genuine crawlable cross-links to other entities, only CTAs into listing pages a crawler treats as a dead end for topical relevance.

**Verified live** (prior session, real Supabase data reachable): `/nature-reserves/royal-natal` linked to 3 real trails (`tugela-falls`, `amphitheatre`, `cathedral-peak`, resolved via the `SUBREGION_ALIASES` compatibility bridge from Phase A); `/towns/winterton` linked to 3 trails in its region. Properties/activities rendered empty in that same environment (no seed data for those kinds) — the empty-state path, not a bug.

## 2. `/transport/[slug]` — shuttle-route detail page

SEO audit finding G17: named shuttle routes were real, supplier-authored data (`app/supplier/routes/*`, stored as the `supplier_routes` entity kind) with nowhere public to render. `/shuttles` is a separate, on-demand quote tool (`estimateTransferPrice` from live-typed pickup/dropoff) that never reads this data — the two are genuinely different features, not a duplicate.

- **`lib/transport-routes.ts`** (new) — typed `Route` wrapper around the `supplier_routes` kind, `& GraphFields`, mirroring `lib/events.ts`'s pattern for `supplier_events`. `getRoutes()`, `getPublishedRoutes()`, `getRoutesBySupplier()`, `getRouteById()`, each taking an optional `SupabaseClient`; helpers `routeDurationLabel()`, `routePrice()`, `routeSlug()` (`slug || id`, same fallback as every other entity).
- **`lib/supplier-entities.ts`** — `getSupplierEntities()`/`getSupplierEntity()` extended with the same optional-client parameter as `lib/entities.ts`'s `listEntities()`/`getEntity()` (which they wrap). Every existing 2-arg call site (supplier dashboards, session-bound) is unaffected.
- **`lib/transport.ts`** — `getTransportCompanies()`/`getMyTransportCompany()` given the same optional-client parameter, so the public route can resolve a route's operator display name (`companyName`) without a signed-in supplier session.
- **`app/transport/page.tsx`** + **`layout.tsx`** (new) — listing page, `'use client'` matching the site's established listing convention, `EditablePageHeader section="transport_page"` (new entry added to `lib/site-content.ts`, same shape as `tours_page`).
- **`app/transport/[slug]/page.tsx`** (new) — pure server component, same shape as `/nature-reserves/[slug]`/`/towns/[slug]` (no client-side data needed — everything is resolved before render). `generateMetadata` + `Service` + `BreadcrumbList` JSON-LD. A route with no admin-set `slug` yet resolves by `id`, same `slug || id` fallback as everywhere else. Non-active routes keep resolving (a supplier previewing a draft route via direct link) but carry `robots: {index:false, follow:false}`.
- **`app/sitemap.ts`** — routes added, filtered to `status === 'active'` and `robotsIndex !== false`, falling back to `[]` on a read failure (routes have no `DEFAULT_*` seed data, consistent with properties/activities/packages/tours).
- **`DESTINATION_GRAPH_NAV`'s "Shuttle Routes" node** flipped from `'planned'` to `'live'` in `lib/destination-ia.ts` — its `requires` condition (the detail route existing) is now met. Still not wired into the rendered `Navbar` — that's the separate, larger IA decision, not something this phase does unilaterally (same caveat Phase B logged for the Tours node).
- **Discoverability** — `/transport` added to `Footer.tsx`'s "Discover" column, and `/shuttles`'s hero gained a "Browse fixed-price routes" link to `/transport`, so the new routes are reachable by an actual link, not just present in the sitemap (same principle Phase B applied to `/tours`).

**Verified live** (this session, placeholder Supabase credentials — every fetch's network call fails and falls through to the existing `try`/`catch` → `[]`/`null` path, which is the behavior being verified):
```
GET /                        → 200 (regression check — middleware/global render unaffected)
GET /transport                → 200, header renders "Shuttle Routes", empty state renders
                                 ("No fixed routes listed yet" + link to /shuttles)
GET /transport/some-fake-slug → 404 via not-found.tsx
GET /towns/[any], /tours      → 200 (regression check — shared lib changes didn't break existing routes)
GET /shuttles                  → 200, contains the new "Browse fixed-price routes" link
GET /sitemap.xml               → 200
```
A full 200-with-real-route-data check needs a reachable Supabase project with at least one `supplier_routes` row, which this test environment doesn't have — same limitation Phase B logged for `/activities/[id]`/`/stays/[id]`.

## 3. What's still queued

- ISR/`revalidate` on the converted dynamic routes — everything still renders per-request.
- Wiring `DESTINATION_GRAPH_NAV`/the 7-primary IA into the live `Navbar` and mobile drill-down.
- Slug population — the `slug || id` fallback is everywhere already; only the admin UI to *set* a slug and a backfill pass remain. Routes specifically have no slug-setting UI at all yet (`app/supplier/routes/new/page.tsx` doesn't collect one).
- Admin SEO panel (Tool 1) and the rest of `docs/seo-audit/INTERNAL_SEO_TOOLS.md`.
- Curated/hybrid module overrides — `ModuleConfig`'s non-automatic modes remain unread by any page.
