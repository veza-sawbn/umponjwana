# Visit Drakensberg — Architecture Change Decision

---

## The Question

**Can Visit Drakensberg's SEO objectives be achieved without meaningful architectural alteration?**

---

## Verdict

# 🟡 AMBER

**Mostly possible, but several targeted extensions are required.**

The core architecture — Next.js App Router, Supabase, the entity store, the admin environment — is entirely capable of supporting the SEO strategy. No replacement is needed. No migration to a different framework or database is required.

However, the current *implementation* within that architecture has several patterns that actively prevent SEO from working. These are not architectural problems but implementation problems that can be corrected without restructuring the platform.

---

## Evidence

### What the architecture CAN do (but isn't currently doing)

| SEO Capability | Architecture Support | Current Implementation | Gap |
|---|---|---|---|
| Server-rendered metadata per entity | ✅ Next.js App Router has generateMetadata | ❌ All pages are 'use client' | Implementation choice, not architecture limit |
| Canonical URLs per page | ✅ alternates.canonical in generateMetadata | ❌ Not implemented on detail pages | Same |
| Slug-based URLs | ✅ Dynamic routes support any string segment | ❌ Using UUID prefixes instead of slugs | Data model gap, not architectural |
| Programmatic page generation | ✅ generateStaticParams + ISR exist | ❌ Not used anywhere | Implementation choice |
| Per-entity SEO metadata storage | ✅ vd_entities.value is JSONB — accepts any fields | ❌ No SEO fields in entity records | Data model gap |
| Destination/region pages | ✅ Dynamic routing supports [slug] | ❌ /regions/[slug] route doesn't exist | Missing route |
| Structured data | ✅ JSON-LD can be injected in server components | ❌ Only TravelAgency on root | Implementation gap |
| Breadcrumbs | ✅ Any server component can render these | ❌ Not implemented | Implementation gap |
| Sitemap with dynamic URLs | ✅ sitemap.ts can query Supabase | ❌ Only lists static routes | Implementation gap |
| Persistent SEO admin controls | ✅ site_content and vd_entities accept any data | ❌ Admin SEO panel doesn't save | Bug in admin page |
| Article database | ✅ blog_posts table exists in schema | ❌ Admin blog UI is a shell; articles hardcoded | Wiring gap |
| Redirect management | ✅ Middleware can route dynamically | ❌ No redirect table or middleware hook | Small addition needed |
| Internal linking engine | ✅ lib/fuzzy.ts exists, entity queries work | ❌ Not used for link suggestions | Implementation gap |

### What genuinely requires architectural change

| Change | Justification |
|---|---|
| Convert public detail pages from 'use client' to server components | **Required** — this is the single largest change. It is NOT a re-architecture; it is fixing the rendering model of specific pages. The component hierarchy changes but the data layer, auth, admin, and supplier systems are untouched. |
| Add slug fields to Property, Activity, OperatorProfile, MarketplacePackage | **Required** — small data model extension. JSONB accepts new fields without migration. |
| Add `/regions/[slug]` route | **Required** — one new route file. Data already exists. |
| Add `vd_redirects` table | **Required for slug migration** — one new table, one new middleware check. Smallest possible addition. |
| Migrate trails from site_content blob to vd_entities rows | **Recommended** — not strictly required for Phase 1–3 SEO improvements, but important for long-term scalability and sitemap generation. Trail data is already fully typed; migration is low-risk. |
| Wire blog_posts table to admin + frontend | **Required** for article SEO — but the table already exists; this is a wiring task. |

### What does NOT require architectural change

- The database (Supabase + vd_entities) — no schema migration needed for SEO metadata (JSONB is flexible)
- The admin system — SEO tools are additions to existing admin pages
- The authentication/authorisation system — no changes
- The supplier dashboard — no changes
- The booking/financial system — no changes
- The dispatch/transport system — no changes
- The visual editor system — extended, not replaced
- URL structure for existing working routes — preserved with redirects where slugs are introduced

---

## The Rendering Problem in Detail

The single most important implementation gap is that **every public-facing detail page is a client component**. This was not an architectural decision — it was an implementation pattern that carried forward from the early SPA phase of development.

**Next.js App Router fully supports mixing server and client components.** The fix is:

```
BEFORE (current):
  app/hikes/[id]/page.tsx  →  'use client'  →  no metadata possible

AFTER (fix):
  app/hikes/[slug]/page.tsx  →  server component  →  generateMetadata ✅
    ↓ renders
    HikeDetailClient.tsx  →  'use client'  →  handles gallery, lightbox, booking interactions
```

The server component fetches the trail, generates metadata, renders the SEO-important HTML (headings, description, key facts), and hands off interactive sections to client components. This is the standard App Router pattern and requires no new dependencies.

This change does not affect:
- The Supabase data layer
- The admin system
- The supplier system
- Any other routes
- Authentication

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|---|---|---|
| Converting detail pages to server components | **LOW** | Additive change. Client components still work as children. Can be done one page at a time. |
| Adding slugs to entities | **MEDIUM** | Requires redirect from old UUID URLs. Existing properties/activities have no slugs — users who have bookmarked UUID URLs will land on 404 without redirects. Mitigation: implement redirect manager first, then add slugs. |
| Migrating trails to vd_entities | **MEDIUM** | Trail data is the richest in the system. Must be validated before going live. Keep site_content as read fallback during transition. |
| Adding /regions/[slug] | **LOW** | New route only. No existing route changes. |
| Adding vd_redirects table | **LOW** | New table only. Middleware addition is isolated. |
| Wiring blog_posts | **LOW** | Existing table. Admin UI shell already exists. |

---

## What NOT to Build

Based on this audit, the following would be premature or counterproductive:

1. **Do not rebuild as a headless CMS architecture.** The current Next.js + Supabase stack can fully support the SEO strategy with targeted changes.

2. **Do not create a separate SEO microservice.** All SEO intelligence belongs inside the existing admin environment.

3. **Do not introduce a third-party CMS** (Contentful, Sanity, Strapi, etc.). The `vd_entities` + `site_content` system is sufficient. Adding a CMS would create a second source of truth.

4. **Do not create thousands of thin programmatic pages.** Every entity page should have genuine editorial content. The platform currently has ~50 trails, ~20 properties in production scale — these should be individually curated, not bulk-generated.

5. **Do not index every filter combination.** The current client-side filter implementation is SEO-safe. Do not add URL parameters to filters.

6. **Do not use AI to auto-generate entity descriptions.** Trail data, property data, activity data should come from suppliers and administrators — accurate, specific, and human-authored.

7. **Do not change the auth system, booking system, supplier dashboard, or financial system** to accommodate SEO. These are independent concerns.

8. **Do not create `/destinations/*` as a parallel URL namespace alongside `/regions/*`.** Map one to the other with redirects if needed.

9. **Do not replace the existing Leaflet map implementation** for SEO. Maps are rendered client-side; this is acceptable. Static map images for og:image and structured data are the only map-related SEO addition worth making.

10. **Do not create tour-detail pages (`/tours/[slug]`)** as a separate editorial type from experience pages. The existing `/experiences/[id]` serves the commercial use case. Supplier tours are already surfaced on trail pages.

---

## Final Assessment

The Visit Drakensberg platform has the right foundations. The App Router, Supabase, entity model, admin environment, and regional data are all positioned correctly for the SEO strategy.

The gap is not architectural — it is a rendering pattern (client-only pages) combined with missing data fields (no slugs) and a non-functional admin tool (SEO panel). None of these require a platform rebuild.

**The path to a powerful SEO platform is incremental, surgical, and fully achievable within the current codebase.**

---

## Decision Summary Table

| Decision | Verdict | Rationale |
|---|---|---|
| Rebuild the platform | ❌ DO NOT | Current stack is capable |
| Change framework | ❌ DO NOT | Next.js App Router supports all requirements |
| Replace Supabase | ❌ DO NOT | vd_entities JSONB is flexible enough |
| Add headless CMS | ❌ DO NOT | Would create second source of truth |
| Convert detail pages to server components | ✅ REQUIRED | Core blocking issue for metadata |
| Add slug fields to entities | ✅ REQUIRED | Needed for human-readable URLs |
| Add /regions/[slug] route | ✅ REQUIRED | Highest-impact missing page |
| Add vd_redirects table | ✅ REQUIRED | Needed for safe slug migration |
| Migrate trails to vd_entities | ✅ RECOMMENDED | Scalability and sitemap generation |
| Wire blog_posts to admin | ✅ RECOMMENDED | Article SEO authority |
| Add SEO fields to entity JSONB | ✅ REQUIRED | No migration needed — JSONB extends transparently |
| Replace entity UUID IDs with slugs in DB | ❌ DO NOT | Keep IDs; add separate slug field |
| Recreate supplier/booking system | ❌ DO NOT | Unrelated to SEO |
