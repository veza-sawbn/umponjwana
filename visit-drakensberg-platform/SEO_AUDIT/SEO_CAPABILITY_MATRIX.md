# Visit Drakensberg — SEO Capability Matrix
*Maps every SEO objective against the current architecture*

Status codes: ✅ SUPPORTED | ⚠️ PARTIALLY SUPPORTED | ❌ NOT SUPPORTED

---

## 1. Technical SEO Foundations

| Objective | Status | Evidence | Action Required |
|---|---|---|---|
| Title tag on all public pages | ⚠️ PARTIAL | Root layout + section layouts set titles for listing pages only. Detail pages have no titles. | Add `generateMetadata` to all detail pages |
| Meta description on all public pages | ⚠️ PARTIAL | Same as above | Same |
| Canonical URL on all public pages | ⚠️ PARTIAL | Listing pages have canonicals via layout. Detail pages do not. Several static pages missing. | Add canonical to all pages |
| robots meta (index/noindex) | ⚠️ PARTIAL | Root allows all; `robots.ts` protects admin routes. Several pages that should be noindex are not. | Add noindex to search, compare, request, cart, invoice, quote, print pages |
| Open Graph metadata | ⚠️ PARTIAL | Root OG works. Detail pages inherit generic root OG (wrong). | Add entity-specific OG to detail pages |
| Twitter/X Card | ⚠️ PARTIAL | Same as OG | Same |
| sitemap.xml | ⚠️ PARTIAL | Exists and covers static routes + editorial articles. No dynamic entity pages included. | Add dynamic entity URLs to sitemap |
| robots.txt | ✅ SUPPORTED | Correctly excludes admin/supplier/account/checkout/api | None required |
| 404 handling | ✅ SUPPORTED | `not-found.tsx` with proper metadata exists | None |
| metadataBase set | ✅ SUPPORTED | Root layout sets `metadataBase` | None |
| Title template | ✅ SUPPORTED | `%s \| Visit Drakensberg` pattern configured | None |
| hreflang | ❌ NOT SUPPORTED | English only, no i18n planned | Not needed currently |
| Pagination | ✅ SUPPORTED | No pagination URLs exist; filters are client-side | None |
| Image metadata | ❌ NOT SUPPORTED | `next/image` not used; `<img>` tags used. No systematic alt text strategy. | Move to `next/image` for optimization |

---

## 2. Programmatic SEO — Entity Pages

| Entity Page Type | Status | Evidence | Blocker | Action Required |
|---|---|---|---|---|
| Trail detail page | ⚠️ PARTIAL | Route exists, trail data exists. Client component, no metadata. | Client-only rendering | Convert to server component + generateMetadata |
| Property detail page | ⚠️ PARTIAL | Route exists, data exists. UUID URLs, no metadata. | Client-only + no slug | Add slug field + server component + generateMetadata |
| Activity detail page | ⚠️ PARTIAL | Route exists, data exists. UUID URLs, no metadata. | Client-only + no slug | Same as property |
| Guide profile page | ⚠️ PARTIAL | Route exists, data exists. UUID URLs. | Client-only + no slug | Same |
| Operator profile page | ⚠️ PARTIAL | Route exists, data exists. UUID URLs. | Client-only + no slug | Same |
| Package detail page | ⚠️ PARTIAL | Route exists, data exists. UUID URLs. | Client-only + no slug | Same |
| Destination/Region page | ❌ NOT SUPPORTED | Regions listing exists. No individual region pages. | Route does not exist | Add `/regions/[slug]` server page |
| Tour product page | ❌ NOT SUPPORTED | Tours are supplier products shown on trail pages only | No route exists | Lower priority — covered by experience pages |
| Shuttle route page | ❌ NOT SUPPORTED | Shuttle is a booking tool, not entity pages | No route + no editorial content | Phase 3 |
| Event detail page | ❌ NOT SUPPORTED | Events listing exists. No individual event pages. | No route | Phase 2 |
| Itinerary page | ❌ NOT SUPPORTED | No editorial itinerary type | No route + no content type | Phase 2 (map to packages) |
| Nature reserve page | ❌ NOT SUPPORTED | Reserves listing exists. No individual pages. | No route | Phase 2 |
| Article/Story detail page | ⚠️ PARTIAL | Route exists (`/mydrakensberg/[slug]`). Articles are hardcoded in code, not in database. No metadata. | Client component + hardcoded data | Migrate to database + server component + generateMetadata |

---

## 3. Destination-Commerce Page Objective

*Can a single page combine information + inventory for a destination/entity?*

| Component | Trail Page | Property Page | Destination Page |
|---|---|---|---|
| Entity information | ✅ Rich data (distance, elevation, difficulty, etc.) | ✅ Description, amenities, location | ❌ No page exists |
| Gallery | ✅ | ✅ | ❌ |
| Map | ✅ (via TrailPlanner) | ✅ (via GPS coords) | ❌ |
| GPX / elevation profile | ✅ | N/A | N/A |
| Available departures | ✅ (UpcomingDepartures component) | N/A | ❌ |
| Book this guide / CTA | ✅ (links to /guides) | ✅ (room booking) | ❌ |
| Nearby accommodation | ❌ Not linked | N/A | ❌ |
| Related trails | ✅ (partial — same region, random) | ❌ | ❌ |
| Reviews | ❌ (mock/empty) | ❌ | ❌ |
| Related articles | ❌ | ❌ | ❌ |
| Safety information | ✅ (what_to_bring) | N/A | ❌ |
| Activities nearby | ❌ | ❌ | ❌ |

**Assessment**: Trail pages are the most complete destination-commerce pages in the system. They already assemble information + commercial inventory (guided departures + trekking experiences). Properties are purely informational + bookable. Destination/region pages do not exist yet.

---

## 4. Internal Linking

| Linking Relationship | Status | Notes |
|---|---|---|
| Trail → related trails (same region) | ⚠️ PARTIAL | Shows 2 related trails by region filter, randomly sorted |
| Trail → guide CTA | ✅ | Links to /guides (not trail-specific guide list) |
| Trail → experiences | ✅ | TrailExperiences component shows live departures |
| Property → region page | ❌ | Properties show region string but no link to /regions/[slug] |
| Activity → region page | ❌ | Same |
| Guide → trails they operate | ❌ | Guide pages don't link to associated trails |
| Package → component entities | ❌ | Package page doesn't link to individual property/trail/activity pages |
| Article → entity pages | ⚠️ PARTIAL | Hardcoded `relatedListings` in articles link to listings generically |
| Navigation → all major sections | ✅ | Main nav covers stays/hikes/activities/regions/guides/stories/plan |

---

## 5. Structured Data

| Schema Type | Status | Evidence |
|---|---|---|
| Organization | ✅ SUPPORTED | TravelAgency schema in root layout |
| TouristDestination | ❌ NOT SUPPORTED | No region/destination schema |
| Hike / Outdoor Activity | ❌ NOT SUPPORTED | No trail structured data |
| LodgingBusiness | ❌ NOT SUPPORTED | No accommodation schema |
| Activity / TouristAttraction | ❌ NOT SUPPORTED | No activity schema |
| Person (Guide profile) | ❌ NOT SUPPORTED | No guide person schema |
| Product (Package/Tour) | ❌ NOT SUPPORTED | No product schema |
| BreadcrumbList | ❌ NOT SUPPORTED | No breadcrumbs anywhere |
| Review / AggregateRating | ❌ NOT SUPPORTED | Reviews are mocked |
| FAQPage | ❌ NOT SUPPORTED | No FAQ blocks |
| Event | ❌ NOT SUPPORTED | No event schema |

---

## 6. Content Architecture

| Objective | Status | Notes |
|---|---|---|
| Admin controls page title | ⚠️ PARTIAL | Admin SEO panel exists but doesn't save |
| Admin controls H1 | ✅ via `/admin/editor` | Visual editor on homepage content |
| Admin controls introduction | ✅ via `/admin/editor` | EditablePageHeader component |
| Admin controls body content | ✅ for homepage | For entity pages — not yet |
| Admin controls SEO title | ❌ | Admin SEO panel doesn't persist |
| Admin controls meta description | ❌ | Same |
| Admin controls canonical | ❌ | Same |
| Admin controls featured image | ✅ for properties/trails | MediaPicker in admin forms |
| Admin controls OG image | ❌ | Not exposed in any admin panel |
| Admin controls indexability | ❌ | No per-page robots control |
| Admin controls breadcrumbs | ❌ | Breadcrumbs don't exist |
| Admin controls structured data | ❌ | No schema management |
| Admin controls related content | ❌ | No relationship manager |
| Admin controls page visibility | ✅ PARTIAL | status (published/draft) on trails and entities |
| Admin controls FAQ | ❌ | No FAQ blocks |

---

## 7. Summary Verdict by Objective Category

| Category | Overall Status |
|---|---|
| Technical SEO foundations | ⚠️ PARTIALLY SUPPORTED — works for static pages only |
| Dynamic entity metadata | ❌ NOT SUPPORTED — zero generateMetadata implementations |
| Destination pages | ❌ NOT SUPPORTED — no /regions/[slug] route |
| Canonical URL strategy | ⚠️ PARTIALLY SUPPORTED — listing pages only |
| Structured data | ⚠️ MINIMALLY SUPPORTED — Organisation only |
| Sitemap completeness | ⚠️ PARTIALLY SUPPORTED — static routes only |
| Faceted navigation safety | ✅ SUPPORTED — filters are client-side only |
| Internal linking | ⚠️ PARTIALLY SUPPORTED — limited ad-hoc links |
| Content management | ⚠️ PARTIALLY SUPPORTED — editor for homepage, not entities |
| Entity-level SEO control | ❌ NOT SUPPORTED — no per-entity metadata fields |
| Programmatic SEO generation | ⚠️ PARTIALLY SUPPORTED — routes exist, data exists, rendering broken |
| Breadcrumbs | ❌ NOT SUPPORTED |
| Commercial + information fusion on entity pages | ⚠️ PARTIAL — trail pages are best example |
