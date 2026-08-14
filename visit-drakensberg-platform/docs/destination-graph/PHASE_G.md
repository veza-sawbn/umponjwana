# Destination Graph — Phase G: region pages 404 fix

Reported: region pages 404 for content filled in via `/admin/regions`. Root cause found and fixed; `/regions/[slug]` rebuilt as a pure server component matching `/nature-reserves/[slug]`'s architecture, as requested. `npm run build` passes.

## Root cause

`app/admin/regions/page.tsx` never went through `lib/regions.ts` — the module the public site actually reads from. It used a parallel, disconnected path: `getAdminRegions()`/`saveAdminRegions()` in `lib/admin-supabase.ts`, backed by an `AdminRegion` type that **had no `slug` field at all**, ever.

`lib/regions.ts`'s `getRegions()` derives a slug on *read* when one isn't already stored (`normalizeRegion()`: `slug = region.slug || slugifyRegion(region.name)`). Because the admin write path never persisted a `slug`, every region an admin created or edited had its slug **re-derived from `name` on every single read, forever** — never stabilized. Two concrete failure modes followed:

1. **One bad row poisoned every region.** `getRegions()`'s `data.value.items.map(normalizeRegion)` had no per-item error handling. If any single stored region had a shape `normalizeRegion()` choked on, the exception propagated out of `.map()`, the surrounding `try/catch` swallowed it, and the function fell all the way back to `DEFAULT_REGIONS` — every admin-authored region vanished from the public site at once, silently, with nothing in the UI to explain it.
2. **Renaming a region silently moved its URL.** Since the slug was never pinned in storage, editing a region's `name` and saving changed the slug the very next time `getRegions()` was called — any existing link, bookmark, nav entry, or already-crawled URL to the old slug now 404s, with no redirect.

`lib/reserves.ts` (which `/nature-reserves` already correctly builds on) doesn't have either problem: its admin console (`app/admin/reserves/page.tsx`) imports `getReserves`/`saveAllReserves` directly from `lib/reserves.ts`, and `saveAllReserves()` runs every item through `normalizeReserve()` **before** writing — so a reserve's slug is computed once, persisted, and stays stable through every future save. This is the "similar build" the fix below copies.

## Fixes

### 1. `lib/regions.ts`
- `getRegions()`: each item is now normalized independently (`try { normalizeRegion(item) } catch { null }`, then filtered) — one malformed row is dropped, not fatal to the whole list.
- New `saveAllRegions(regions)` (mirrors `saveAllReserves`): normalizes every item before persisting, so a save call is what actually stabilizes a region's slug going forward.
- `updateRegion()`: now explicitly pins `slug: previous?.slug` (matching `updateReserve()`), so the single-region update path can't drift a slug either.

### 2. `lib/admin-supabase.ts`
- Removed the parallel `AdminRegion` type and `getAdminRegions`/`createAdminRegion`/`updateAdminRegion`/`saveAdminRegions`/`deleteAdminRegion` functions — the actual source of the bug. Nothing else referenced them.

### 3. `app/admin/regions/page.tsx`
- Rewritten to import `getRegions`/`saveAllRegions`/`type Region` from `@/lib/regions` directly — the same module the public site reads from, and the same structure `app/admin/reserves/page.tsx` already uses. No UI/field changes for the admin — same form, same fields; only the read/write path changed underneath it.

### 4. `app/regions/[slug]/page.tsx` (+ deleted `RegionDetail.tsx`)
Per the explicit ask — rebuilt to the same shape as `app/nature-reserves/[slug]/page.tsx`: **one pure server component**, no separate client-fetching island.

- Previously: a server shell (`page.tsx`, resolving the region for `generateMetadata`/JSON-LD only) handed off to `RegionDetail.tsx`, a `'use client'` component that ran its *own*, entirely separate fetch of `getRegions()`/`getProperties()`/`getTrails()`/`getActivities()` via `useParams()` and the plain browser client — a second, disconnected read path for the same region, duplicating the resolution logic and offering another place for the two to disagree.
- Now: the region, its region-matched stays (with computed min room price), trails and activities are all resolved server-side in one pass via `publicSupabase`, and rendered directly — same visual output (hero, overview, highlights, stat counts, stay/trail/activity card grids, subregions, CTA strip) as before, plus the region's `gettingThere`/`bestTime`/`keyAttractions` fields (present in the data model and the admin form since Phase A, but never actually rendered anywhere) now have their own sections.
- `StayDistance` (a small `'use client'` leaf that reads the visitor's chosen stay from `booking-context` for the "distance from your lodge" chips) is used as-is inside the server-rendered tree — the one genuinely interactive piece, unchanged, same as it's used everywhere else on the site.
- Card links now use `entity.slug || entity.id` (stays/trails/activities), matching the canonical-URL convention every other converted route already follows, instead of always linking by raw `id`.

## Verified

`npm run build` passes. Runtime-verified against a placeholder Supabase project (this environment has no reachable one):
```
GET /                        → 200
GET /regions                 → 200
GET /regions/north-berg      → 200 (renders "Northern Drakensberg", "Tugela Falls Circuit")
GET /regions/central-berg    → 200
GET /regions/does-not-exist  → 404
GET /admin/regions           → 307 (auth redirect — expected, unauthenticated)
```
A live check against real admin-authored region content needs a reachable Supabase project with actual `admin_regions` rows, which this environment doesn't have — the fix itself is a straight port of the exact pattern already proven working for reserves in production.

## What's still queued

- The same `getAdminRegions`-style disconnected-write-path bug is worth auditing for on any other admin console that doesn't already share its data module with the public read path (towns' admin console already matches the reserves/regions-fixed pattern — confirmed while investigating this).
- Slug population's admin-editable form (Tool 1) remains unbuilt — slugs are still derived automatically, not admin-settable, for every entity type including regions.
