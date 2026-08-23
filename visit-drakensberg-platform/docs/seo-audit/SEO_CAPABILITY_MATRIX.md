# SEO CAPABILITY MATRIX

Each objective from Part 12 is rated against **the architecture as it exists today**.

**Legend**
- **SUPPORTED** — works now, or works with content entry only (no code)
- **PARTIAL** — data and/or route exists; delivery layer incomplete
- **NOT SUPPORTED** — route or data does not exist

**Effort key:** XS = config/content only · S = < 1 day · M = 1–3 days · L = 1 week+

---

## 1. Destination / region pages

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/regions` listing | **SUPPORTED** | `app/regions/page.tsx` + `layout.tsx` metadata + canonical | — | — |
| `/regions/[slug]` detail | **PARTIAL** | Route exists, real slugs, `Region.seoTitle`/`seoDescription` **already populated** | No `generateMetadata` → generic title; SEO fields never read; not in sitemap; no `TouristDestination` schema | S |
| `/destinations/drakensberg` (parent hub) | **NOT SUPPORTED** | No parent-destination entity | Needs one hub page; `/regions` can serve or a new hub added | S |
| N/C/S Drakensberg sub-destinations | **SUPPORTED (data)** | `DEFAULT_REGIONS` = north-berg, central-berg, south-berg with slugs, taglines, overviews, highlights | Same delivery gap as above | S |

**Note:** naming differs from the brief — the platform uses `/regions/north-berg`, not `/destinations/northern-drakensberg`. **Recommendation: keep `/regions`.** It is live, indexed, internally linked, and `regionsMatch()` normalises the naming variants. Renaming buys nothing and risks ranking loss.

## 2. Attraction pages

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/destinations/tugela-falls` etc. | **PARTIAL** | **`Reserve` entity has `slug` + `regionSlug` + `seoTitle` + `seoDescription` + `peaks[]` + `permits` + `bestTime` + `facilities` — all populated** | **No detail route exists at all.** `/nature-reserves` is listing-only | S |
| Cathedral Peak / Giants Castle / Mafadi | **PARTIAL** | Present as `Reserve.peaks[]` (name, elevation, difficulty) and in `SUBREGION_ALIASES` | Peaks are nested, not addressable entities | M |
| Towns as destinations | **PARTIAL** | `Town` entity has `slug` + SEO fields, admin CRUD at `/admin/towns` | No detail route; `/towns` listing-only | S |

**This is the highest-value finding in the audit.** Reserves and towns are fully authored, slugged, SEO-populated content with zero search visibility. Adding `/nature-reserves/[slug]` and `/towns/[slug]` is a small, self-contained change that unlocks content the team has *already written*.

## 3. Trail pages

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/hikes` listing | **SUPPORTED** | Rich filters, metadata, canonical | — | — |
| `/hikes/[slug]` detail | **PARTIAL** | Route live at `/hikes/[id]`; `Trail` has name, region, distance, elevation, duration, difficulty, `trail_type`, `speciality_type`, `permit_required`, GPX, route artwork, start GPS | ID-based URL; no `generateMetadata`; no sitemap entry; no schema | M |
| Trail stats / elevation / GPX on page | **SUPPORTED** | Already rendered client-side (`RouteArtwork`, `lib/gpx.ts`) | Not in server HTML | S |
| Trail → related inventory | **PARTIAL** | Derivable via `regionsMatch()` + GPS + `departure.trailId` | Computed for UI only, not crawlable | M |
| Slug URLs (`/hikes/tugela-falls`) | **PARTIAL** | `Trail.slug?` field **already declared** (`lib/trails.ts:48`) but optional and unused | Populate + resolve with ID fallback | S |

## 4. Accommodation

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/accommodation` listing | **SUPPORTED** (as `/stays`) | Full filters, metadata, canonical | Naming differs — **keep `/stays`** | — |
| `/accommodation/[supplier-slug]` | **PARTIAL** | `/stays/[id]` live, rich page (rooms, amenities, GPS, gallery, booking) | URL is `prop-<uuid>`; no slug; no `generateMetadata`; no `LodgingBusiness` schema; not in sitemap | M |
| Room-level pages | **NOT SUPPORTED** | `room` kind exists under property | Deliberately out of scope — see `SEO_GAPS.md` §Do-Not-Build | — |

## 5. Activities

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/activities` listing | **SUPPORTED** | Category tabs + region filter (added this cycle) | — | — |
| `/activities/[slug]` | **PARTIAL** | `/activities/[id]` live; rich data (category, difficulty, duration, GPS, meeting point, price, inclusions, safety) | UUID URL; no `generateMetadata`; no `Product`/`Offer` schema; not in sitemap | M |

## 6. Tours

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/tours` listing | **NOT SUPPORTED** | `tour` kind exists in `vd_entities`, supplier CRUD at `/supplier/tours` | No public listing route | M |
| `/tours/[slug]` | **PARTIAL** | Surfaces indirectly via `/experiences/[id]` (departure-centric) | No tour-centric public page | M |

Tours are currently modelled as *dated departures* (`/experiences/[id]`), which is commercially correct but SEO-weak — a dated departure is transient, whereas an evergreen tour page accrues authority. Worth addressing, but after the higher-value items.

## 7. Guides

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/guides` listing | **SUPPORTED** | `app/guides/page.tsx` + metadata | — | — |
| `/guides/[slug]` | **PARTIAL** | `/guides/[id]` + `/guides/operators/[id]` both live; `operator_profile` verified-guide data (`20260708_public_verified_guides.sql`) | UUID URLs; no `generateMetadata`; no `Person`/`Organization` schema; not in sitemap | M |

## 8. Shuttles

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/shuttles` listing | **SUPPORTED** | `app/shuttles/page.tsx` + metadata | — | — |
| `/shuttles/[route-slug]` | **NOT SUPPORTED** | Transport marketplace data exists (`20260718_transport_marketplace.sql`, routes/vehicles/drivers CRUD) | No public per-route page or slug | M |

Route pages (`sani-pass-shuttle`, `airport-transfer-drakensberg`) map to real high-intent search demand. Good opportunity, but requires new routes — schedule after Phase 1–2.

## 9. Itineraries

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/itineraries` + `/itineraries/[slug]` | **NOT SUPPORTED** | `/plan` and `/trip` exist (planner UI); `app/itinerary/[id]/print` is private/auth | No public evergreen itinerary content type | L |

## 10. Packages

| Objective | Rating | Evidence | Gap | Effort |
|---|---|---|---|---|
| `/packages` listing | **SUPPORTED** | `app/packages/page.tsx` + metadata | — | — |
| `/packages/[slug]` | **PARTIAL** | `/packages/[id]` live; `package` kind with inclusions/pricing | UUID URL; no `generateMetadata`; no `Product`/`Offer` schema; not in sitemap | M |

---

## 11. Cross-cutting technical objectives

| Objective | Rating | Notes |
|---|---|---|
| Per-entity title/description | **NOT SUPPORTED** | Zero `generateMetadata`. **The single highest-impact gap.** |
| Per-entity canonical | **NOT SUPPORTED** | Root canonical only |
| Per-entity OG/Twitter image | **NOT SUPPORTED** | Root defaults only; entity `photos[0]`/`image` available |
| Entity URLs in sitemap | **NOT SUPPORTED** | 17 static + 6 hardcoded slugs; zero DB entities |
| `TouristAttraction`/`Trail` schema | **NOT SUPPORTED** | Root `TravelAgency` only |
| `LodgingBusiness` schema | **NOT SUPPORTED** | All fields available (name, address, geo, amenities, price) |
| `Product`/`Offer` schema | **NOT SUPPORTED** | Price/availability available on activities, packages, departures |
| `BreadcrumbList` schema | **NOT SUPPORTED** | Visual breadcrumb on `/regions/[slug]` only, unmarked |
| `FAQPage` schema | **NOT SUPPORTED** | No FAQ content model |
| Faceted-nav canonical policy | **NOT SUPPORTED** | No canonical, no noindex, no robots query rules |
| Redirects | **NOT SUPPORTED** | No `redirects()` in `next.config.js`, no DB table |
| ISR / revalidation | **NOT SUPPORTED** | Not configured (all detail routes dynamic per-request) |
| `robots.txt` correctness | **SUPPORTED** | Private areas correctly disallowed |
| `metadataBase` + title template | **SUPPORTED** | Correct |
| Listing-page metadata | **SUPPORTED** | 14 routes, good copy |
| Org structured data | **SUPPORTED** | `TravelAgency` at root |
| 404 handling | **SUPPORTED** | `app/not-found.tsx` |
| Heading hierarchy | **PARTIAL** | Generally single `h1` + `h2` sections; not audited per-page |
| Image optimisation | **PARTIAL** | `next/image` + remote patterns + lazy loading; `alt` coverage incomplete on decorative/hero images |
| Internal linking (crawlable) | **PARTIAL** | Rich relationship logic exists but renders client-side only |
| Pagination | **NOT APPLICABLE** | Listings render full sets client-side; no paginated URLs today |

---

## 12. Score summary

| Rating | Count |
|---|---|
| SUPPORTED | 12 |
| PARTIAL | 17 |
| NOT SUPPORTED | 14 |

**Interpretation.** Almost nothing is rated NOT SUPPORTED because *the data or route is missing* — the recurring cause is that **`generateMetadata`, sitemap inclusion and structured data are absent**. A single delivery-layer pattern, applied once and repeated across eight existing detail routes, converts the majority of PARTIAL ratings to SUPPORTED without touching the database or changing a single live URL.

The genuinely absent items — tours listing, shuttle route pages, itineraries, FAQ model, redirect manager — are **additive new features**, not corrections to a flawed architecture.
