# Visit Drakensberg — URL Architecture
*Current routes, assessment, and recommended target state*

---

## Current Routes — Full Inventory

### Public Visitor Routes

| Current route | Purpose | Dynamic? | Indexable? | Canonical set? | SEO-ready? | Assessment |
|---|---|---|---|---|---|---|
| `/` | Homepage | Static | ✅ | ✅ (root layout) | ⚠️ | Client component — global metadata from layout works but page has no entity metadata |
| `/stays` | Accommodation listing | Static | ✅ | ✅ (layout) | ✅ | Section layout metadata works |
| `/stays/[id]` | Property detail | Dynamic (UUID-style id) | ✅ | ❌ | ❌ | Client component, no metadata, UUID-based URL |
| `/hikes` | Trail/hike listing | Static | ✅ | ✅ (layout) | ✅ | Section layout metadata works |
| `/hikes/[id]` | Trail detail | Dynamic (slug-style for defaults) | ✅ | ❌ | ❌ | Client component, no metadata |
| `/activities` | Activities listing | Static | ✅ | ✅ (layout) | ✅ | Section layout metadata works |
| `/activities/[id]` | Activity detail | Dynamic (UUID-style) | ✅ | ❌ | ❌ | Client component, no metadata |
| `/guides` | Guides directory | Static | ✅ | ✅ (layout) | ✅ | Section layout metadata works |
| `/guides/[id]` | Individual guide profile | Dynamic (UUID-style) | ✅ | ❌ | ❌ | Client component, no metadata |
| `/guides/operators/[id]` | Operator/company profile | Dynamic (opr-uuid) | ✅ | ❌ | ❌ | Client component, no metadata |
| `/packages` | Packages listing | Static | ✅ | ✅ (layout) | ✅ | Section layout metadata works |
| `/packages/[id]` | Package detail | Dynamic (UUID-style) | ✅ | ❌ | ❌ | Client component, no metadata |
| `/experiences/[id]` | Departure booking page | Dynamic (departure-id) | ✅ | ❌ | ❌ | Client component, commercial page |
| `/experiences/compare` | Comparison page | Static (query params) | ⚠️ | ❌ | ❌ | Should be noindex — query-param page |
| `/experiences/request` | Custom trip request | Static (query params) | ⚠️ | ❌ | ❌ | Should be noindex — form page |
| `/regions` | Regions listing | Static | ✅ | ✅ (layout) | ✅ | Works, but no individual region pages |
| `/nature-reserves` | Nature reserves listing | Static | ✅ | ⚠️ | ⚠️ | No canonical set in layout |
| `/towns` | Towns listing | Static | ✅ | ⚠️ | ⚠️ | No canonical set in layout |
| `/events` | Events listing | Static | ✅ | ✅ (layout) | ✅ | Section layout metadata works |
| `/shuttles` | Shuttle/transfer booking | Static | ✅ | ✅ (layout) | ✅ | Informational + booking tool |
| `/mydrakensberg` | Editorial hub | Static | ✅ | ⚠️ | ⚠️ | Client component — no layout metadata |
| `/mydrakensberg/[slug]` | Article detail | Dynamic (slug) | ✅ | ❌ | ❌ | Client component, hardcoded articles, no metadata |
| `/search` | Search results | Static + query params | ⚠️ | ❌ | ❌ | Should be noindex — parameterised |
| `/plan` | Trip planner | Static | ✅ | ⚠️ | ⚠️ | No canonical |
| `/stories` | Stories page | Static | ✅ | ⚠️ | ⚠️ | May be duplicate of /mydrakensberg |
| `/about` | About page | Static | ✅ | ⚠️ | ⚠️ | No layout metadata found |
| `/list-your-property` | Supplier signup landing | Static | ✅ | ⚠️ | ⚠️ | No canonical |
| `/privacy` | Privacy policy | Static | ✅ | ⚠️ Low | ⚠️ | In sitemap at 0.2 — correct |
| `/terms` | Terms of service | Static | ✅ | ⚠️ Low | ⚠️ | In sitemap at 0.2 — correct |
| `/invoices/[id]` | Printable invoice | Dynamic | ❌ | ❌ | ❌ | Should be noindex |
| `/itinerary/[id]/print` | Printable itinerary | Dynamic | ❌ | ❌ | ❌ | Should be noindex |
| `/quotes/[id]` | Quote page | Dynamic | ❌ | ❌ | ❌ | Should be noindex |
| `/trip` | Booking cart | Static | ❌ | ❌ | ❌ | Should be noindex |

### Auth Routes (correctly excluded from robots.txt)
`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`

### Account Routes (correctly excluded from robots.txt)
`/account/*`, `/dashboard/*`

### Supplier Routes (correctly excluded from robots.txt)
`/supplier/*`

### Admin Routes (correctly excluded from robots.txt)
`/admin/*`

### Checkout Routes (correctly excluded from robots.txt)
`/checkout/*`

---

## URL Gap Analysis — Strategic Routes

### Destination Pages

| Target URL | Status | Gap |
|---|---|---|
| `/destinations` | ❌ MISSING | Could reuse `/regions` (equivalent content) |
| `/destinations/[slug]` | ❌ MISSING | `/regions` shows a listing but `/regions/[slug]` does not exist |
| `/regions/[slug]` | ❌ MISSING | Region data + slug exists; page does not |

**Recommendation**: Add `/regions/[slug]` route using existing `Region` data. Do NOT create a parallel `/destinations/[slug]` structure — map `/destinations` → `/regions` and create `/regions/[slug]` as the canonical destination page.

### Trail/Hike Pages

| Target URL | Status | Gap |
|---|---|---|
| `/hikes` | ✅ EXISTS | Working listing — section layout metadata ✅ |
| `/hikes/[slug]` | ⚠️ PARTIAL | Route exists as `/hikes/[id]`. Default trail IDs are slug-style (`tugela-falls`). Live trail IDs may be inconsistent. No metadata. |

**Recommendation**: The route already exists and default trails use slug-style IDs. Priority is converting the page to a server component with `generateMetadata`. Enforce slug-style IDs for all new trails.

### Accommodation Pages

| Target URL | Status | Gap |
|---|---|---|
| `/stays` | ✅ EXISTS | Working listing — section layout metadata ✅ |
| `/stays/[slug]` | ⚠️ PARTIAL | Route exists as `/stays/[id]`. Current IDs are `prop-<uuid>`. No metadata. |

**Recommendation**: Add a `slug` field to `Property`. Generate slugs from property name + region on creation. Add redirect from old UUID URL to new slug URL for existing properties.

### Activities Pages

| Target URL | Status | Gap |
|---|---|---|
| `/activities` | ✅ EXISTS | Section layout metadata ✅ |
| `/activities/[slug]` | ⚠️ PARTIAL | Route exists as `/activities/[id]`. UUIDs. No metadata. |

**Recommendation**: Same pattern as accommodation — add slug field, generateMetadata.

### Guides Pages

| Target URL | Status | Gap |
|---|---|---|
| `/guides` | ✅ EXISTS | Section layout metadata ✅ |
| `/guides/[id]` | ⚠️ PARTIAL | Route exists. UUIDs. No metadata. |
| `/guides/operators/[id]` | ⚠️ PARTIAL | Route exists. UUIDs. No metadata. |

**Recommendation**: Add slug to operator profiles (company name slug). Add generateMetadata.

### Tours

| Target URL | Status | Gap |
|---|---|---|
| `/tours` | ❌ MISSING | Tours are supplier products, not editorial content. Currently surfaced on trail pages only. |
| `/tours/[slug]` | ❌ MISSING | No public tour pages exist |

**Recommendation**: Tours are commercial products not editorial content. The `/experiences/[id]` page (departure-level) covers the commercial use case. Adding a tour-level page may be valuable but is lower priority than destination/trail/accommodation pages.

### Shuttle Pages

| Target URL | Status | Gap |
|---|---|---|
| `/shuttles` | ✅ EXISTS | Google Maps API based booking tool. Section layout metadata ✅ |
| `/shuttles/[route-slug]` | ❌ MISSING | No route-level pages. Dispatch engine has no editorial route entities. |

**Recommendation**: The current /shuttles page with the Google Distance Matrix API is a good tool. Route-specific SEO pages (e.g. `/shuttles/johannesburg-to-drakensberg`) would require creating editorial content for key corridor routes. This is a medium-term opportunity, not an immediate requirement.

### Itinerary Pages

| Target URL | Status | Gap |
|---|---|---|
| `/itineraries` | ❌ MISSING | No public itinerary pages |
| `/itineraries/[slug]` | ❌ MISSING | Itinerary content is customer-specific trip data |

**Recommendation**: Editorial itineraries (e.g. "3-Day Northern Berg Traverse") are different from customer trip data. The `packages` entity is the closest equivalent. Map `/itineraries` → `/packages` for now. Create editorial itinerary pages as a Phase 2 content type.

### Packages Pages

| Target URL | Status | Gap |
|---|---|---|
| `/packages` | ✅ EXISTS | Working, section layout metadata ✅ |
| `/packages/[id]` | ⚠️ PARTIAL | Route exists. UUIDs. No metadata. |

---

## URL Mapping — SEO Target Architecture

```
/regions                              → Destination hub (EXISTS, rename to /destinations? — NO, keep /regions)
/regions/[slug]                       → Destination page (ADD THIS)
  e.g. /regions/north-berg
  e.g. /regions/central-berg
  e.g. /regions/south-berg

/hikes                                → Trail listing (EXISTS ✅)
/hikes/[slug]                         → Trail detail (EXISTS, fix metadata)
  e.g. /hikes/tugela-falls
  e.g. /hikes/cathedral-peak

/stays                                → Accommodation listing (EXISTS ✅)
/stays/[slug]                         → Accommodation detail (EXISTS, add slug + metadata)
  e.g. /stays/cathedral-peak-lodge
  e.g. /stays/monks-cowl-resort

/activities                           → Activities listing (EXISTS ✅)
/activities/[slug]                    → Activity detail (EXISTS, add slug + metadata)

/guides                               → Guides directory (EXISTS ✅)
/guides/[slug]                        → Guide profile (EXISTS, add slug + metadata)
/guides/operators/[slug]              → Operator profile (EXISTS, add slug + metadata)

/packages                             → Packages listing (EXISTS ✅)
/packages/[slug]                      → Package detail (EXISTS, add slug + metadata)

/experiences/[id]                     → Commercial departure page (EXISTS, noindex or low-priority)

/shuttles                             → Shuttle booking tool (EXISTS ✅)

/mydrakensberg                        → Editorial hub (EXISTS ✅)
/mydrakensberg/[slug]                 → Article (EXISTS, add metadata + move to DB)

/nature-reserves                      → Reserves listing (EXISTS, add canonical)
/towns                                → Towns listing (EXISTS, add canonical)
/events                               → Events listing (EXISTS ✅)
```

---

## Faceted Navigation Audit

### Current Filter Implementation

Filters are implemented as **client-side React state** on all listing pages. They do NOT affect the URL.

- `/hikes` — filters: difficulty, region, route type, max distance, category (all in `useState`)
- `/stays` — filters: type, amenities, region (in `useState`)
- `/activities` — filters: category, region (in `useState`)
- `/guides` — operator/guide filters (in `useState`)

**Result**: No filter URLs exist. No duplicate filter URLs exist. No crawlable filter combinations.

### Assessment

This is the **correct behaviour for SEO**. Client-side filters that don't affect URLs cannot:
- Create duplicate content
- Cause crawl budget waste
- Generate thin parameterised pages

The current implementation is SEO-safe by accident.

### Recommendation

Do NOT add URL-based filters to standard listing pages unless deliberately creating SEO landing pages.

For deliberate SEO landing pages, create **separate static routes**, not URL parameters:
- `/hikes/day-hikes` — Day hikes in the Drakensberg
- `/hikes/multi-day` — Multi-day trails
- `/stays/self-catering` — Self-catering accommodation
- `/stays/northern-berg` — Northern Berg accommodation

These should be genuinely useful editorial pages, not thin filter shells.

---

## URLs That Need Immediate Attention

### Must add `noindex` (not in robots.txt, potentially indexable)
- `/experiences/compare` — comparison tool, query-param driven
- `/experiences/request` — form page
- `/search` — search results
- `/trip` — cart page
- `/invoices/[id]` — private financial document
- `/itinerary/[id]/print` — private document
- `/quotes/[id]` — private quote

### Must add canonical
- `/nature-reserves` — add `alternates: { canonical: '/nature-reserves' }` to layout
- `/towns` — same
- `/about` — same
- `/list-your-property` — same
- `/plan` — same
- `/mydrakensberg` — same

### Stories page
- `/stories` exists but may duplicate `/mydrakensberg` — investigate and either consolidate or differentiate
