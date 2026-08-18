# Destination Graph — Phase H: Getting There readability + shuttle module

Requested: the region page's "Getting There" section was a single wall of unformatted text, with an idea that it could double as a shuttle-planning entry point. Feedback was given and confirmed before building (recommended scope: list matching shuttle routes + a CTA button, not an embedded quote form). `npm run build` passes.

## 1. Readability

- **Paragraph breaks are now preserved.** `region.gettingThere` (and each `gettingThereSections[].body`) is split on blank lines and rendered as separate `<p>` tags with real spacing between them — previously the whole field was dumped into one `<p>`, so any paragraph breaks an admin had typed collapsed into a single run-on block. Works retroactively on whatever's already stored, no admin action required.
- **Its own full-width section**, pulled out of the cramped `sm:grid-cols-2` box it used to share with "Best Time to Visit" (which now lives as its own callout in the stats column instead).
- **New structured, opt-in fields on `Region`** (`lib/regions.ts`), additive alongside the original free-text `gettingThere`:
  - `gettingThereSections: { id, title, body }[]` — named subsections (e.g. "By Road," "By Air," "By Shuttle") an admin can add, each rendered with a real heading.
  - `gettingThereRoutes: { id, from, distance, duration }[]` — a distance/duration table, rendered as an actual `<table>`.
  - Both default to `[]` via `normalizeRegion()`, so existing regions (or ones that never adopt the richer fields) keep working exactly as before — nothing is required to render the plain-text intro.
- **`app/admin/regions/page.tsx`** updated with add/remove UI for both new fields, matching the array-editing pattern already used there for Key Attractions/Subregions — no new UI paradigm introduced.

## 2. Shuttle module

Per the confirmed scope (list real routes + a CTA, not an embedded quote form):

- **`lib/modules.ts`**: new `getNearbyRoutes(regionName, opts, client)`, matching the same automatic-mode pattern as `getNearbyTrails`/`getNearbyStays`/`getNearbyActivities` — filters `/transport`'s real named routes (`lib/transport-routes.ts`) by `regionsMatch()` against either endpoint (`from` or `to`), reusing the exact fuzzy region-matching every other module already relies on rather than adding a `regionSlug` field to `Route` just for this.
- **`components/modules/ShuttleRoutesModule.tsx`** (new): pure presentational component, same shape as `RelatedTrailsModule`/`NearbyStaysModule` — renders nothing when there are no matching routes (no empty-state clutter; most regions won't have any yet).
- **"Get a Shuttle Here" CTA** → `/shuttles`, pre-filled with the region's **gateway town** as the destination — not the region name itself, since a broad area name like "Northern Drakensberg" isn't a specific-enough address for Google's Distance Matrix, while a real town is. Resolved as the first `Town` filed under that region (`lib/towns.ts`'s `regionSlug`).
- **`app/shuttles/page.tsx`**: now reads a `?to=` query param to seed the destination field, added behind a `<Suspense>` boundary (`useSearchParams()` requires one in the App Router) — falls back to the existing booking-context stay prefill when absent, so nothing changes for anyone arriving without the param.

## Verified

`npm run build` passes. Runtime-verified against a placeholder Supabase project:
- `/shuttles?to=Bergville%2C%20South%20Africa` → the destination field is pre-filled with `"Bergville, South Africa"` on load (confirmed via Playwright).
- Temporarily seeded `DEFAULT_REGIONS`' first entry with sample `gettingThere`/`gettingThereSections`/`gettingThereRoutes` content, rebuilt, and confirmed via `curl` that: two intro paragraphs render as two separate `<p>` tags (not one run-on block), the "By Road" section renders with its own heading, the distance table renders `Johannesburg / 380 km / 4h 30m` as table cells, and the "Get a Shuttle Here" CTA renders. Reverted the test content immediately after (confirmed via diff against a backup) — no test data shipped.
- With genuinely empty getting-there content (the real `DEFAULT_REGIONS` fallback), the whole section correctly renders nothing rather than an empty shell.

A live check against real admin-authored `gettingThereSections`/`gettingThereRoutes` content, and real matching `/transport` routes, needs a reachable Supabase project — this environment doesn't have one.

## What's still queued

- The embedded mini quote widget (live estimate without leaving the region page) was explicitly scoped out this round in favor of the CTA-button approach — worth reconsidering once there's usage data on how often visitors follow the CTA through to `/shuttles`.
- Slug population's admin-editable form (Tool 1) and curated/hybrid module overrides remain unbuilt, as in every prior phase doc.
