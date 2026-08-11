# Visit Drakensberg — SEO Gaps
*Prioritised list of gaps, from most to least impactful*

---

## CRITICAL — Blocking indexation of valuable pages

### GAP 1: No generateMetadata on any detail page
**Impact**: Every trail, property, activity, guide, package, experience detail page renders with the generic site-wide title/description/OG. Google may index these pages but with zero entity-specific metadata. Click-through rates will be very low.

**Affected routes**: `/hikes/[id]`, `/stays/[id]`, `/activities/[id]`, `/guides/[id]`, `/guides/operators/[id]`, `/packages/[id]`, `/experiences/[id]`, `/mydrakensberg/[slug]`

**Root cause**: All page.tsx files are `'use client'` — `generateMetadata` cannot be used in client components.

**Fix**: Refactor public detail pages to server components with `generateMetadata`. The component body can still use client components for interactive elements (booking widget, gallery, map) via `'use client'` child components. Only the page wrapper and metadata need to be server-side.

**Estimated effort**: 2–3 days per entity type (8 total = 3–4 weeks). Can be parallelised.

---

### GAP 2: No canonical URLs on detail pages
**Impact**: If the same content is accessible via different URL formats (ID vs slug, with/without trailing slash, etc.), Google may treat them as duplicate content.

**Root cause**: Same as GAP 1 — client components cannot set `alternates.canonical`.

**Fix**: Part of GAP 1 fix — `generateMetadata` should always set `alternates.canonical`.

---

### GAP 3: No destination (region) detail pages
**Impact**: "Drakensberg", "Northern Drakensberg", "Central Berg", "Sani Pass" are high-volume destination search queries. The platform has no landing pages for these. Users searching "Northern Drakensberg accommodation" find nothing on the site despite all the relevant data existing.

**Root cause**: The `/regions` page lists all regions but no `/regions/[slug]` route exists.

**Fix**: Add `app/regions/[slug]/page.tsx` as a server component. Data is already in `site_content.regions` (queried via `lib/regions.ts`). The region entity already has `slug`, `seoTitle`, `seoDescription`, `overview`, `highlights`, `keyAttractions` fields.

**Estimated effort**: 1–2 days (the data, slug, and admin editor already exist).

---

### GAP 4: Trails stored in site_content blob, not per-row
**Impact**: Trails cannot be efficiently queried per-row. The sitemap cannot enumerate trail URLs without fetching and parsing the entire blob. `generateStaticParams` cannot be implemented without loading all trails and filtering.

**Root cause**: Architecture decision — trails were stored in `site_content` to use the simple blob pattern. This predates the `vd_entities` table.

**Fix**: Migrate trails from `site_content` to `vd_entities` (kind = 'trail'). The `Trail` type is already richer than most entities and has most SEO-relevant fields. Add `slug` as a top-level mirrored column (or enforce slug-style IDs).

**Estimated effort**: 1 day for migration + 2 days for lib update + page updates.

**Risk**: Trail data is the most content-rich data in the system. Migration must be idempotent and validated before going live.

---

### GAP 5: No URL slugs for properties, activities, guides, or packages
**Impact**: All detail page URLs use machine-generated UUIDs (`/stays/prop-3c9b2d5a-...`). These URLs are not memorable, shareable, or representative of the content. They cannot encode the destination signal that Google uses for local intent matching.

**Root cause**: Entities were created with UUID-prefix IDs and no slug field.

**Fix**: 
1. Add `slug: string` field to `Property`, `Activity`, `OperatorProfile`, `MarketplacePackage` types
2. Add slug generation on entity creation (from name + region, slugified)
3. Update detail page routes to support both slug and legacy ID (for existing URLs)
4. Add redirects from old UUID URLs to new slug URLs (using Tool 11 — Redirect Manager)

**Estimated effort**: 1 day per entity type + redirect infrastructure.

---

## HIGH — Significantly limits SEO potential

### GAP 6: Admin SEO panel is non-functional
**Impact**: `/admin/seo` exists and looks functional but saves to local React state only. All changes are lost on page refresh. Admins cannot set SEO metadata for any page.

**Root cause**: The `handleSave` function in `/admin/seo/page.tsx` sets a `saved` flag but calls no Supabase write.

**Fix**: Wire the existing fields to a Supabase `site_content` write (for static pages) and extend entity edit forms with SEO fields (for dynamic pages). Replace the current shell with the consolidated SEO dashboard described in `INTERNAL_SEO_TOOLS.md`.

**Estimated effort**: 1 day to wire existing save button + 3 days for the full tool set.

---

### GAP 7: No structured data on entity pages
**Impact**: Rich results in Google (breadcrumbs, ratings, hiking details, accommodation listings, FAQ) are inaccessible. Structured data signals have become increasingly important for AI-powered search features.

**Root cause**: The only JSON-LD in the codebase is the `TravelAgency` schema in the root layout.

**Fix**: Add JSON-LD to each entity page type:
- Trail pages → `SportsActivityLocation` or `HikingTrail` + `Offer` for guided departures
- Property pages → `LodgingBusiness` + `Product` for rooms
- Activity pages → `TouristAttraction` or `Activity`
- Guide pages → `Person` + `LocalBusiness`
- Package pages → `Product` + `Offer`
- Destination pages → `TouristDestination`
- All pages → `BreadcrumbList`

**Estimated effort**: 1 day per entity type.

---

### GAP 8: No breadcrumbs anywhere
**Impact**: Breadcrumbs improve navigation, signal hierarchy to search engines, and enable BreadcrumbList rich results.

**Root cause**: Not implemented. The single reference to "Breadcrumb" in the codebase is a comment inside an operations management page.

**Fix**: Create a `<Breadcrumbs>` component and add it to all public entity pages and the new destination pages.

Example paths:
- Home → Hikes → Tugela Falls Circuit
- Home → Stays → Cathedral Peak Lodge
- Home → Regions → Northern Berg → Tugela Falls Circuit

**Estimated effort**: 0.5 day for component + 1 day across all pages.

---

### GAP 9: Sitemap excludes all dynamic entity pages
**Impact**: Google cannot discover entity pages via sitemap. It must find them by crawling internal links — which are also sparse.

**Root cause**: The sitemap comment explicitly notes "Detail pages backed by live Supabase data are intentionally omitted here — add them once listing slugs are stable."

**Fix**: Once slugs are added (GAP 5), extend `sitemap.ts` to query `vd_entities` for published entities with slugs set.

```typescript
// app/sitemap.ts (extension)
const trails = await getTrails() // once migrated to vd_entities
const properties = await getProperties()
const activities = await getActivities()
const operators = await getOperators()
const packages = await getPackages()

const dynamicUrls = [
  ...trails.filter(t => t.status === 'published' && t.slug).map(t => ({
    url: `${SITE_URL}/hikes/${t.slug}`,
    lastModified: t.updatedAt || now,
    priority: 0.8,
  })),
  // ... etc
]
```

**Estimated effort**: 0.5 day once slugs exist.

---

### GAP 10: Articles hardcoded in page.tsx, not in database
**Impact**: The `blog_posts` table exists in the schema but has never been wired. The 6 editorial articles in `/mydrakensberg/[slug]` are hardcoded as a large object in the page component. Cannot be managed by admins, cannot have per-article metadata, cannot be included in the sitemap dynamically, cannot link to live entities by ID.

**Root cause**: Building the blog admin was deferred. The hardcoded data was a placeholder.

**Fix**: Wire the `/admin/blog` page (currently a UI shell) to the existing `blog_posts` table. Migrate the 6 hardcoded articles into the database. Convert `/mydrakensberg/[slug]` to a server component reading from `blog_posts`.

**Estimated effort**: 2–3 days.

---

## MEDIUM — Reduces effectiveness but not blocking

### GAP 11: No image optimisation (next/image not used)
**Impact**: Large images slow page load. Core Web Vitals (LCP especially) affect ranking. No `srcset`, no lazy loading via Next.js optimiser.

**Fix**: Replace `<img>` with `next/image` on entity pages. Already configured in `next.config.js` with Supabase and Unsplash domains whitelisted.

### GAP 12: No schema-based reviews / ratings
**Impact**: Review schema enables star rating rich results. `/supplier/reviews` is a mock display only.

**Fix**: Wire reviews to the `reviews` table (already in schema.sql). Requires review collection workflow first.

### GAP 13: No region-based accommodation/activity links on trail pages
**Impact**: Trail pages link to `/guides` (generic) but not to accommodation near the trail or activities in the same region.

**Fix**: Add "Stays near this trail" and "Activities in this region" sections to trail pages, querying properties and activities filtered by region string.

### GAP 14: No /destinations URL namespace
**Impact**: "Visit Drakensberg destinations" queries may be better served by `/destinations` than `/regions`. The URL is more internationally understandable.

**Recommendation**: This is not a critical gap. `/regions` is clear and already established. If `/destinations` is desired, implement as redirects: `/destinations` → `/regions`, `/destinations/[slug]` → `/regions/[slug]`. Do not duplicate the content.

### GAP 15: Several static pages missing canonicals and layout metadata
**Affected**: `/about`, `/nature-reserves`, `/towns`, `/list-your-property`, `/plan`, `/mydrakensberg`, `/stories`

**Fix**: Add section `layout.tsx` with metadata export to each affected directory.

---

## LOW — Polish and completeness

### GAP 16: `/experiences/compare`, `/experiences/request`, `/search`, `/trip` need noindex
**Fix**: Add `export const metadata = { robots: { index: false } }` to these pages.

### GAP 17: `/stories` may duplicate `/mydrakensberg`
**Fix**: Investigate — if both serve the same content, redirect one to the other.

### GAP 18: No FAQ blocks on any page
**Fix**: Add FAQ content blocks to destination and trail pages. FAQPage schema enables FAQ rich results.

### GAP 19: No weather integration on trail/destination pages
**Fix**: External widget integration. Lower priority than structural SEO gaps.

### GAP 20: No hreflang
**Assessment**: Not needed. Single language (English) platform.
