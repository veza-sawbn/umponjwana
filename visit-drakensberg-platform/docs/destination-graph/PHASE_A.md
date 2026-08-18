# Destination Graph — Phase A

Foundation work for the graph-first IA (7 primaries: Explore · Hikes · Stay · Things to Do · Tours · Plan Your Trip · Transport). Per the strategic reassessment: navigation is a discovery layer over an entity graph, not a 1:1 list of pages. This phase ships schema, vocabulary and type-contract foundations — **no new public routes, no rendered navigation change**. `npm run build` passes (115/115 pages) after every change below.

## 1. Resolved decisions

| Question | Decision |
|---|---|
| Peaks | Nested attribute of `Reserve.peaks[]`. No separate `Peak` entity, no detail page — peaks render as anchors on their parent reserve page (Phase B). |
| Events | Genuine new entity (`lib/events.ts`), populated exclusively by suppliers via `/supplier/events`. `/events` is correctly empty until suppliers publish — that's the honest state of a real catalogue, not a bug. |
| New vocabulary (§14) | Added as real enum values, wired everywhere they're consumed (not just added to satisfy the nav list) — see §3. |

## 2. Region rename: North/Central/South Berg → Northern/Central/Southern Drakensberg

**Decision:** display name changes; `id`/`slug` do not (`/regions/north-berg` etc. stay live — no URL change, per the SEO audit's "preserve existing URLs" principle).

**Changed:** `lib/regions.ts` (`DEFAULT_REGIONS.name/tagline/overview/seoTitle/seoDescription`), `lib/destination-ia.ts` (`DESTINATIONS`/`DESTINATION_RECOMMENDATIONS` region values — kept in sync with each other since `buildDestinationRecommendations()` filters by exact `===`, not `regionsMatch()`), `lib/site-content.ts` (homepage region cards + essentials copy), `components/layout/Footer.tsx`, `app/admin/trails/page.tsx` (region dropdown + new-trail default), `app/admin/website/page.tsx` (region filter dropdown), `app/stays/layout.tsx` / `app/regions/layout.tsx` (SEO meta descriptions), `lib/trails.ts` / `lib/towns.ts` / `lib/reserves.ts` (seed-data region/gateway/tagline values that render publicly on `/hikes`, `/towns`, `/nature-reserves`).

**Safety mechanism — `SUBREGION_ALIASES`:** `regionsMatch()` is used throughout the codebase to fuzzy-match free-text `region` fields against canonical `Region.name`. Renaming the canonical name breaks every existing alias mapping unless the alias *targets* are updated in the same change — this was verified with a real test run (`tsx` against the live `lib/regions.ts`, 22 assertions, all passing) before considering this done:

- Every existing park/subregion alias (`cathedral peak` → `central berg`, `sani pass` → `south berg`, etc.) retargeted to the new canonical form
- **Backward-compatibility bridge added:** `'north berg' → 'north drakensberg'`, `'central berg' → 'central drakensberg'`, `'south berg' → 'south drakensberg'`. Any entity whose free-text `region` field still literally says "North Berg" — perfectly valid existing supplier/admin-entered data — continues to resolve correctly with **no data migration**.

**Deliberately left unchanged** (mock/demo data or low-traffic cosmetic copy, not canonical or SEO-bearing): `app/supplier/property/page.tsx` (pre-`vd_entities` mock array), `app/supplier/listings/[id]/edit/page.tsx` (form placeholder default), `app/supplier/routes/[id]/edit/page.tsx` (mock route data), `lib/transport.ts` (`'Underberg & Southern Berg'` transport-hub label — a different concept from `Region`, used only for shuttle radius calc), `components/panorama/PanoramaViewer.tsx` (flavour text), `app/plan/PlanContent.tsx` (itinerary prose), `app/mydrakensberg/[slug]/page.tsx` (related-content labels), `app/admin/towns/page.tsx` / `app/supplier/company/page.tsx` (input placeholder hint text). None of these feed `regionsMatch()` or public SEO metadata. Flag for a follow-up pass if full consistency is wanted.

**Pre-existing data note (not introduced by this change):** `lib/trails.ts`'s `cathedral-peak` trail was already tagged `region: 'Northern Berg'` before this rename, while every other reference to Cathedral Peak in the codebase (`reserves.ts`, `destination-ia.ts`, `SUBREGION_ALIASES`) treats it as Central. This rename preserved that existing categorization exactly (renamed the *label*, not the *assignment*) since correcting which region an entity belongs to is a data decision, not a naming one. Worth a separate look.

## 3. New vocabulary — added and wired, not just listed

**Accommodation (`lib/properties.ts` `PROPERTY_TYPES`):** added `Resort`, `Glamping`, `Farm Stay`. Consumed via `.map()` in `/supplier/properties/new`, `/supplier/properties/[id]/edit`, `/list-your-property` — extending the exported array was the entire change; no per-form edits needed.

**Activities (`lib/activities.ts`, new `ACTIVITY_CATEGORIES` export):** this also fixed a live defect — the supplier form's category list (`Adventure, Nature, Water, Cultural, Wellness, Family`) and the public `/activities` filter tabs (`Adventure, Wildlife, Cultural, Family, Wellness`) had **drifted into two different lists**. Activities tagged `Nature` or `Water` were unreachable from the public page; `Wildlife` was a public filter tab no supplier could ever select, so it always returned zero results. `ACTIVITY_CATEGORIES` is their union plus the new values: `Adventure, Nature, Water, Wildlife, Cultural, Wellness, Family, Photography, Horse Riding, Fishing, Rock Climbing, Cycling`. Both supplier forms (`new`/`[id]/edit`) and the public page now import this single source.

**Events region/GPS capture:** `/supplier/events` gained a region selector and a `GoogleAddressField`-backed venue field (capturing GPS), matching the pattern already used on the activity supplier form — needed so events can eventually participate in region pages and "nearby" recommendation modules the same way trails/activities/properties do.

## 4. Destination-graph foundation types (new files, unused by any route yet)

- **`lib/graph-fields.ts`** — `GraphFields`: `slug`, `seoTitle`, `seoDescription`, `regionSlug`, `related{Trail,Property,Activity,Tour}Ids[]`, `robotsIndex`. Mixed via intersection into `Trail`, `Property`, `Activity`, `Tour`, `Event` (`Trail`'s pre-existing inline `slug?` was folded into this shared type rather than duplicated). All fields optional, all storage is JSONB — zero migrations, and no existing constructor of these types needed to change.
- **`lib/page-composition.ts`** — `ModuleConfig` / `PageComposition` type contract for Phase B's reusable page modules (automatic / curated / hybrid population, matching the `home_cards` + `section_order` pattern already proven on the homepage editor). Types only; no renderer consumes them yet.
- **`lib/destination-ia.ts`** — new `NavNode` / `DESTINATION_GRAPH_NAV` export: the reframed 7-primary IA, classified per node as `entity` / `landing_page` / `content_page` and marked `live` or `planned` with a `requires` note. Facets and taxonomies (difficulty, duration, property type, etc.) are deliberately **not** represented as nodes — those live in the Phase B filter module, not the nav tree. This is additive: the existing `PRIMARY_NAVIGATION` export is untouched and still drives the live `Navbar`.

## 5. Verification

```
npx tsx verify-region-rename.mjs   → 22/22 checks pass (self-match, legacy-term
                                      compatibility, park aliases, cross-region
                                      rejection, substring checks in
                                      getDestinationForContext)
npm run build                      → ✓ Compiled successfully, 115/115 pages
```

## 6. What Phase A does not include (by design)

No new public routes (`/tours`, `/nature-reserves/[slug]`, `/towns/[slug]`, `/transport/[slug]`). No Navbar rewiring to the 7-primary structure — `DESTINATION_GRAPH_NAV` is committed as data for review, not yet rendered. No admin module-configuration UI. No relationship-field backfill (the fields exist; nothing populates or reads them yet). All of the above are Phase B, which this phase's schema and vocabulary work was a prerequisite for.
