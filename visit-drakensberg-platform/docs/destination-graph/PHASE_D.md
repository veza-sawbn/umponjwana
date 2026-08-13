# Destination Graph — Phase D: ISR / `revalidate`

Every converted server-shell detail route (Phase B + C) rendered fully per-request — correct, but every hit paid a live Supabase round-trip even though most of this content changes on an admin/supplier edit cadence, not a per-second one. This phase adds `export const revalidate = N` to each one, tiered by how often the underlying content actually changes. `npm run build` passes throughout.

## Tiers

| Interval | Routes | Rationale |
|---|---|---|
| `3600` (1h) | `/regions/[slug]`, `/nature-reserves/[slug]`, `/towns/[slug]` | Admin-edited copy; changes on the order of days/weeks, not minutes. |
| `1800` (30m) | `/hikes/[id]`, `/guides/[id]`, `/guides/operators/[id]`, `/transport/[slug]` | Still admin/supplier-edited, but slightly more likely to be updated (route pricing, guide availability notes) than region/reserve/town copy. |
| `300` (5m) | `/activities/[id]`, `/stays/[id]`, `/packages/[id]`, `/tours/[id]` | Supplier-editable pricing and status — the fields most likely to change day-to-day. Live, date-specific state (room inventory on `/stays/[id]`, departure seats on `/tours/[id]`) was already a client-side fetch inside the detail island (Phase B/C), unaffected by this — `revalidate` only governs how fresh the server-rendered shell (entity fields, JSON-LD, metadata) is. |
| *(none — fully dynamic)* | `/experiences/[id]` | Deliberately excluded. An experience is one dated departure: booked-seat counts, sold-out state, and the noindex-when-past logic in `generateMetadata` are all time-sensitive in a way a cached page would misreport (a cached "3 seats left" after a booking would be actively wrong, not just stale). Left as Next's default fully-dynamic per-request render. |

`/regions/[slug]` was already the Phase B keystone route with a client-side data-fetching island for stays/trails/activities (its own booking-context-dependent content) layered on top of the server shell; `revalidate` here only affects the server-rendered shell, same as the other pricing-tier routes.

## What this doesn't change

- No `generateStaticParams` was added to any route — these stay on-demand rendered per unique slug/id on first hit, then cached for the configured window (Next's Incremental Static Regeneration for dynamic segments), rather than every possible slug being pre-rendered at build time. Given the catalog is admin/supplier-authored and grows continuously, pre-enumerating every id at build time isn't the right model here.
- Listing pages (`/tours`, `/transport`, `/towns`, etc.) are unchanged — they're `'use client'` pages that fetch their own data after mount; `revalidate` applies to the server-rendered route segment output, and these pages' actual content already isn't part of that (the initial HTML is the loading state).
- `notFound()`/404 responses are not cached by `revalidate` the way a 200 is — an id that starts resolving later (a supplier publishes a previously-draft listing) picks up correctly on its next real request, not stuck at 404 for the rest of the window.

## Verified

`npm run build` — 3 new lines only in the route summary vs. Phase C (no route type changed: dynamic detail routes stay `λ`, since there is still no `generateStaticParams`; `revalidate` changes the cache lifetime of that on-demand render, not the build-time route classification).

Runtime, against a placeholder Supabase project (this environment has no reachable one — see Phase C's note on what this does and doesn't prove):
```
GET /                          → 200
GET /regions/north-berg        → 200
GET /towns/winterton           → 200
GET /hikes/tugela-falls        → 200
GET /activities/x, /stays/x,
    /packages/x, /tours/x,
    /guides/x, /operators/x,
    /experiences/x, /transport/x → 404 (no crash under a genuine backend failure)
GET /transport                 → 200
GET /sitemap.xml               → 200
GET /shuttles                  → 200
```
All routes regression-checked as unaffected by the shared-lib changes from this and prior phases.

## What's still queued

- Wiring `DESTINATION_GRAPH_NAV`/the 7-primary IA into the live `Navbar` and mobile drill-down.
- Slug population — the `slug || id` fallback is everywhere already; only the admin UI to *set* a slug and a backfill pass remain.
- Admin SEO panel (Tool 1) and the rest of `docs/seo-audit/INTERNAL_SEO_TOOLS.md`.
- Curated/hybrid module overrides — `ModuleConfig`'s non-automatic modes remain unread by any page.
- On-demand revalidation (`revalidatePath`/`revalidateTag`) triggered from the relevant admin/supplier save actions, so an edit reflects immediately instead of waiting out the tier window — not implemented in this pass; every route currently relies on time-based revalidation only.
