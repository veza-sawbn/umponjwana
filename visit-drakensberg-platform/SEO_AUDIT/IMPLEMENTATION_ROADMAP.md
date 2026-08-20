# Visit Drakensberg — SEO Implementation Roadmap
*Phased by impact, complexity, and dependency order*

---

## Governing Principles

1. **Do not touch production URLs without a redirect in place.**
2. **Fix the rendering layer before adding more content.** Metadata first, pages second.
3. **One entity type at a time.** Trails before accommodation before activities.
4. **Admin tools follow, not lead.** Wire the tools that support the entity type you just fixed.
5. **Measure before and after each phase.** Track indexed pages in Google Search Console.

---

## PHASE 0 — Zero-Risk Immediate Fixes
*1–2 days. No architectural changes. Pure additions.*

These can be deployed immediately with no risk to existing functionality or URLs.

### 0.1 — Fix admin SEO panel persistence
**Files**: `app/admin/seo/page.tsx`
**Change**: Wire `handleSave` to call `setSiteContent('seo_overrides', data)`. The `setSiteContent` function already exists in `lib/site-content.ts`. The SEO panel data should persist to `site_content` under a new key `seo_overrides`.
**Time**: 2 hours.

### 0.2 — Add missing canonicals to static pages
**Files**: Add `layout.tsx` with metadata to `app/about/`, `app/nature-reserves/`, `app/towns/`, `app/plan/`, `app/mydrakensberg/`, `app/list-your-property/`, `app/stories/`
**Change**: Each directory gets a layout.tsx with `export const metadata: Metadata = { alternates: { canonical: '/about' }, title: '...', description: '...' }`
**Time**: 2 hours.

### 0.3 — Add noindex to non-content pages
**Files**: `app/experiences/compare/page.tsx`, `app/experiences/request/page.tsx`, `app/search/page.tsx`, `app/trip/page.tsx`, `app/invoices/[id]/page.tsx`, `app/itinerary/[id]/print/page.tsx`, `app/quotes/[id]/page.tsx`
**Change**: Each gets a layout.tsx with `robots: { index: false }` OR, since these are client pages, add a `<meta name="robots" content="noindex">` via a dedicated `<NoIndex />` component rendered in the page.
**Note**: For 'use client' pages, use a layout.tsx sibling — metadata in a layout applies to all pages in that segment.
**Time**: 2 hours.

### 0.4 — Resolve /stories duplication
**Files**: `app/stories/page.tsx`
**Change**: Inspect page content. If it duplicates `/mydrakensberg`, add a canonical pointing to `/mydrakensberg` or implement a redirect.
**Time**: 1 hour.

### 0.5 — Extend robots.ts for additional private routes
**Files**: `app/robots.ts`
**Change**: Add `/invoices/`, `/itinerary/`, `/quotes/` to the disallow list.
**Time**: 30 minutes.

---

## PHASE 1 — Destination Pages
*2–4 days. High impact. No data changes required.*

The data already exists. This is a routing and rendering change only.

### 1.1 — Add `/regions/[slug]` server page
**Files**: Create `app/regions/[slug]/page.tsx` and `app/regions/[slug]/layout.tsx`
**Implementation**:

```typescript
// app/regions/[slug]/page.tsx — SERVER COMPONENT
import type { Metadata } from 'next'
import { getRegions } from '@/lib/regions'
import { notFound } from 'next/navigation'
import RegionDetailContent from '@/components/regions/RegionDetailContent'

export async function generateStaticParams() {
  const regions = await getRegions()
  return regions.map(r => ({ slug: r.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const regions = await getRegions()
  const region = regions.find(r => r.slug === params.slug)
  if (!region) return {}
  return {
    title: region.seoTitle || `${region.name} | Visit Drakensberg`,
    description: region.seoDescription || region.tagline,
    alternates: { canonical: `/regions/${region.slug}` },
    openGraph: {
      title: region.seoTitle || region.name,
      description: region.seoDescription || region.tagline,
      images: [{ url: region.heroImage }],
    },
  }
}

export default async function RegionDetailPage({ params }: { params: { slug: string } }) {
  const regions = await getRegions()
  const region = regions.find(r => r.slug === params.slug)
  if (!region) notFound()
  return <RegionDetailContent region={region} />
}
```

**Data already available**: name, tagline, heroImage, overview, highlights, keyAttractions, subregions, seoTitle, seoDescription.

**Content to add dynamically**: Trails in this region (query trails by region), properties in this region, activities in this region.

**JSON-LD**: Add `TouristDestination` schema.

**Internal links from**: 
- Each property listing → its region page
- Each trail → its region page
- Homepage → all region pages
- `/regions` listing → individual pages (already possible once route exists)

### 1.2 — Update sitemap to include region pages
**Files**: `app/sitemap.ts`
**Time**: 30 minutes.

### 1.3 — Add breadcrumbs to region pages
**Files**: New `components/ui/Breadcrumbs.tsx` + add to region detail page
**Time**: 2 hours.

---

## PHASE 2 — Trail Pages (generateMetadata)
*3–5 days. High impact. Requires trail ID strategy decision.*

### 2.1 — Enforce trail slug consistency
**Decision required**: Trail default IDs are already slug-style (`tugela-falls`). Live trails created via admin use whatever name-derived string the admin types as ID. Enforce that new trails are saved with `id = slugify(name)` OR add a separate `slug` field and decouple from `id`.

**Recommendation**: Add `slug` field to Trail type. Keep `id` as-is. Generate slug from name on save in admin. Use slug for URL routing. This avoids breaking any existing `/hikes/[id]` URLs.

**Files**: `lib/trails.ts`, `app/admin/trails/page.tsx`
**Time**: 3 hours.

### 2.2 — Convert hikes/[id] to server component with generateMetadata
**Files**: `app/hikes/[id]/page.tsx`
**Key change**: The page is currently one large client component. Split it:

```
app/hikes/[slug]/
  page.tsx              ← SERVER COMPONENT (metadata + initial data fetch)
  HikeDetailClient.tsx  ← 'use client' (interactive elements: lightbox, etc.)
```

The server component fetches trail data, renders the static structure, and injects client components for interactive sections.

**generateMetadata**:
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const trail = await getTrailBySlug(params.slug) // new function
  if (!trail) return {}
  return {
    title: trail.seoTitle || `${trail.name}: ${trail.difficulty} Hike in the Drakensberg`,
    description: trail.seoDescription || `${trail.distance} · ${trail.duration} · ${trail.difficulty}. ${trail.description.slice(0, 120)}...`,
    alternates: { canonical: `/hikes/${trail.slug}` },
    openGraph: {
      title: trail.name,
      images: [{ url: trail.image }],
    },
  }
}
```

**JSON-LD**: Add HikingTrail / SportsActivityLocation schema.
**Breadcrumbs**: Home → Hikes → {Trail Name}.
**Time**: 2–3 days.

### 2.3 — Migrate trails to vd_entities (longer-term)
**Note**: This is NOT required to get generateMetadata working (Phase 2.2 can read from site_content). This is a database architecture improvement for Phase 3+.
**Time**: 1–2 days when ready.

---

## PHASE 3 — Accommodation Pages (generateMetadata + slugs)
*3–5 days.*

### 3.1 — Add slug to Property type
```typescript
// lib/properties.ts — extend Property type
export type Property = {
  // ... existing fields
  slug?: string   // human-readable URL segment
}
```

**Slug generation**: On `addProperty`, generate `slug = slugify(name + '-' + region.slice(0,2))` if no slug provided. Check for uniqueness in existing properties.

### 3.2 — Update stays/[id] routing to support slugs
**Strategy**: Support both:
- `/stays/[slug]` — new slug-based URL (canonical)
- `/stays/prop-<uuid>` — legacy URL (redirect to canonical)

In the page: if `params.id` matches a UUID prefix format, load by ID and redirect to `/stays/${property.slug}`.

### 3.3 — Convert stays/[id] to server component with generateMetadata
Same pattern as trail pages. Static content in server component, booking widget + gallery in client child components.

**generateMetadata**:
```typescript
title: `${property.name} | ${property.region} | Visit Drakensberg`
description: `${property.type} in ${property.region}. ${property.description.slice(0,120)}...`
canonical: `/stays/${property.slug}`
OG image: property.photos[0]
JSON-LD: LodgingBusiness
```

### 3.4 — Add redirect infrastructure (Tool 11)
Before deploying slug URLs for existing properties, set up the redirect manager so existing UUID-based URLs redirect correctly.

---

## PHASE 4 — Activity Pages
*2–3 days. Same pattern as Phase 3.*

Add slug to Activity. Convert activities/[id] to server component. generateMetadata. JSON-LD: TouristAttraction.

---

## PHASE 5 — Guides & Operator Pages
*2–3 days.*

Add slug to OperatorProfile (from companyName). Convert guides/[id] and guides/operators/[id] to server components. generateMetadata. JSON-LD: Person (guide), LocalBusiness (operator).

---

## PHASE 6 — Articles (blog_posts database)
*3–4 days.*

Wire `/admin/blog` to the existing `blog_posts` table. Migrate 6 hardcoded articles to database. Convert `/mydrakensberg/[slug]` to server component reading from `blog_posts`. Add `generateMetadata`. Add `Article` JSON-LD. Wire `related_listing_ids` to show linked entity cards.

---

## PHASE 7 — Package Pages + Admin SEO Tools
*3–4 days.*

Add slug to MarketplacePackage. Convert packages/[id] to server component. Add admin SEO panel (Tool 1 + 2) to trail, region, property, activity, package editors. Wire consolidated /admin/seo dashboard.

---

## PHASE 8 — Internal Linking & Relationship Manager
*3–5 days.*

Add `relatedEntities[]` field to all entity types. Build Tool 4 (Related Entity Manager) in admin. Add "accommodation near this trail" and "activities in this region" sections to trail and destination pages. Build Tool 3 (Link Suggestions) using lib/fuzzy.ts.

---

## PHASE 9 — Structured Data Completion
*2–3 days.*

Add BreadcrumbList to all entity pages. Add JSON-LD to remaining entity types. Add FAQ blocks (Tool 5) to destination and trail pages.

---

## PHASE 10 — Sitemap + Discovery Completion
*1 day.*

Extend sitemap.ts to include all entity pages with slugs. Build Tool 12 (Sitemap Control) in admin. Build Tool 7 (Orphan Detector).

---

## PHASE 11 — Editorial Itinerary Pages
*4–6 days.*

Create an `itinerary` content type (distinct from customer trip data). Build admin editor for editorial itineraries (e.g. "3-Day Northern Berg Traverse"). Add `/itineraries/[slug]` route. Wire to package components.

---

## PHASE 12 — Shuttle Route Pages
*3–4 days.*

Create editorial corridor pages (e.g. `/shuttles/johannesburg-drakensberg`). Write content for top 5 routes. Add ShuttleBooking component to each.

---

## Summary Timeline

| Phase | Deliverable | Days | SEO Impact |
|---|---|---|---|
| 0 | Zero-risk fixes | 1–2 | Medium (removes noindex risk, adds missing canonicals) |
| 1 | Destination pages | 2–4 | **HIGH** (captures destination intent queries) |
| 2 | Trail metadata | 3–5 | **HIGH** (most editorial content in system) |
| 3 | Accommodation metadata + slugs | 3–5 | **HIGH** (commercial value pages) |
| 4 | Activity metadata + slugs | 2–3 | HIGH |
| 5 | Guide/Operator metadata + slugs | 2–3 | MEDIUM |
| 6 | Articles → database | 3–4 | HIGH (editorial authority signals) |
| 7 | Package pages + admin SEO tools | 3–4 | MEDIUM |
| 8 | Internal linking | 3–5 | HIGH (improves crawl + topical authority) |
| 9 | Structured data | 2–3 | MEDIUM (rich results) |
| 10 | Sitemap completion | 1 | MEDIUM (discovery) |
| 11 | Itinerary pages | 4–6 | MEDIUM |
| 12 | Shuttle route pages | 3–4 | LOW–MEDIUM |

**Total estimated effort**: 35–55 developer days.

**Minimum viable SEO improvement** (Phases 0–3): 7–16 days. This delivers destination pages, trail metadata, and accommodation metadata — the three highest-value improvements.
