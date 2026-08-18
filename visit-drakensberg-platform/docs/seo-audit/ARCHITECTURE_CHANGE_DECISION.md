# ARCHITECTURE CHANGE DECISION

> **Can the Visit Drakensberg SEO objectives be achieved without architectural alteration?**

# 🟡 AMBER

**No meaningful *restructuring* is required. One contained, standard change to the rendering layer is required.**

- **No database migration.**
- **No URL changes.**
- **No rewrite.**
- **No new infrastructure.**
- **One change:** entity detail pages must render their metadata on the server.

---

## Why AMBER and not GREEN

GREEN would require that the objectives be reachable with content entry and configuration alone. They are not, for one structural reason:

**Every public detail page is a client component, so no page can produce entity-specific metadata.**

```
app/hikes/[id]/page.tsx           'use client'
app/stays/[id]/page.tsx           'use client'
app/activities/[id]/page.tsx      'use client'
app/regions/[slug]/page.tsx       'use client'
app/packages/[id]/page.tsx        'use client'
app/guides/[id]/page.tsx          'use client'
app/experiences/[id]/page.tsx     'use client'
app/mydrakensberg/[slug]/page.tsx 'use client'

$ grep -rl "generateMetadata" app/     → no matches
$ grep -rl "generateStaticParams" app/ → no matches
```

Next.js `generateMetadata` cannot be exported from a client component. The current workaround — a sibling `layout.tsx` server component with a static `export const metadata` — works correctly for the 14 **listing** routes, where metadata is fixed. It cannot work for detail pages, because a static layout cannot know which entity is being rendered.

**The consequence, today, in production:** every entity page on the platform serves the identical title `"Visit Drakensberg | Book Your Mountain Escape"`. Tugela Falls, a lodge in Champagne Valley, a Sani Pass shuttle and a guided traverse are indistinguishable to a search engine. No entity page has its own description, canonical, or OG image. None of them is in the sitemap.

That is a delivery-layer defect, and it must be fixed in code — hence AMBER rather than GREEN.

## Why AMBER and not RED

RED would mean the architecture fundamentally prevents the strategy. The opposite is true — the architecture is well suited to it, and much of the required capability is already present and already paid for.

### Evidence 1 — the data model is close to ideal for a destination graph

`vd_entities` stores the entire domain object in a JSONB `value` column with a `kind` discriminator:

```sql
vd_entities( id text PK, kind text, owner_id uuid, status text,
             value jsonb, created_at, updated_at )
```

`updateEntity()` merges with `{ ...existing, ...patch }` (`lib/entities.ts:87`), so **unknown keys pass straight through**. Adding `slug`, `seoTitle`, `seoDescription`, `ogImage`, `robotsIndex`, `relatedTrailIds[]` to any entity requires **zero migrations**. Write the field; read the field.

The same is true of `site_content` (also JSONB) for trails, regions, reserves and towns.

**There is no schema obstacle anywhere in the graph.** This is the single most favourable finding in the audit.

### Evidence 2 — the SEO metadata pattern is already proven in this codebase

Three entities already carry exactly the shape needed, with working admin CRUD:

```ts
// lib/regions.ts:18-19 · lib/reserves.ts:21-22 · lib/towns.ts
seoTitle: string
seoDescription: string
slug: string
```

`DEFAULT_REGIONS` ships populated values (`lib/regions.ts:37–39`). Admins can already edit them at `/admin/regions`, `/admin/reserves`, `/admin/towns`.

**No page reads any of it.** The team's SEO copy is being captured and discarded. Nothing needs to be invented — an existing, proven pattern needs to be *consumed*, then extended to the commercial entities.

### Evidence 3 — the server-side data layer already exists

```ts
// lib/supabase-server.ts:4
export function createServerClient() {
  return createServerComponentClient({ cookies })
}
```

Working server-side Supabase access, already used by 19 API routes. Phase 1 needs no new infrastructure — it consumes what is there.

### Evidence 4 — the detail routes are already dynamic

From `npm run build`:

```
λ /hikes/[id]        λ /stays/[id]      λ /activities/[id]
λ /regions/[slug]    λ /packages/[id]   λ /guides/[id]
λ /experiences/[id]  λ /mydrakensberg/[slug]
```

`λ` = server-rendered on demand under Node.js. **The server runtime is already executing on every one of these requests** — and being billed for. It currently emits a loading shell because the body fetches in `useEffect`. Adding `generateMetadata` costs no new runtime capability; it uses capability already running.

### Evidence 5 — the destination graph already exists in application logic

| Capability | Location |
|---|---|
| `regionsMatch()` + `SUBREGION_ALIASES` (16 park→region aliases) | `lib/regions.ts:90–126` |
| `haversineKm()` + Google Distance Matrix | `lib/stay-distance.tsx:15` |
| `DESTINATIONS`, `PRIMARY_NAVIGATION`, `distanceKm()`, `buildDestinationRecommendations()` | `lib/destination-ia.ts` |
| Cross-type distance-sorted recommendations | `components/booking/SmartRecommendations.tsx` |
| `TrekkingExperience` — a live multi-entity join across **both** storage patterns (Departure + Tour + Trail + Operator) | `lib/experiences.ts` |

Graph traversal is demonstrated, not hypothetical. `regionsMatch('Royal Natal National Park', 'Northern Berg')` resolves correctly today. These relationships are computed for UI and never rendered as crawlable links — a delivery gap, not a modelling gap.

### Evidence 6 — the metadata foundation is correct

`metadataBase`, title template, default description, root canonical, Open Graph with `en_ZA` locale, Twitter card, `robots`, `viewport` as its own export, `TravelAgency` JSON-LD, a correct `robots.ts` disallowing `/admin/ /supplier/ /account/ /dashboard/ /checkout/ /api/ /auth/`, `not-found.tsx`, and good static metadata on 14 listing routes.

Whoever built this understood technical SEO. The foundation is sound; it was simply never extended to individual entities.

---

## The one required change, precisely scoped

For each of the eight entity detail routes, split the route into a server shell plus the existing client body:

```
app/hikes/[id]/page.tsx        →  server component:
                                    • fetch trail via lib/supabase-server
                                    • export generateMetadata()
                                    • emit JSON-LD
                                    • render <TrailDetail data={...} />

app/hikes/[id]/TrailDetail.tsx →  the current 'use client' file, moved verbatim
```

**What this is not:**

- ❌ Not a database migration — no schema touched
- ❌ Not a URL change — dynamic segments keep their names
- ❌ Not a rewrite — client components move essentially unchanged
- ❌ Not a new dependency — `lib/supabase-server.ts` exists
- ❌ Not a new runtime cost — routes are already `λ`
- ❌ Not a redesign — markup, styling and interactivity are preserved

**What it is:** the standard Next.js App Router pattern for data-backed pages — server shell for metadata and structured data, client island for interactivity. It is the pattern the framework is built around, and the codebase already uses it correctly on its 14 listing routes.

**Risk containment:** roll out one route at a time. Start with `/regions/[slug]`, which already has populated `seoTitle`/`seoDescription` — it validates the entire pattern with the least new data. Verify the booking cart and filters after each route.

---

## Objectives achievable with no code change at all

Immediately, by content entry or one-line config:

1. Author `seoTitle`/`seoDescription` for all regions, reserves and towns — fields and admin UI already exist *(will render once Phase 1 lands)*
2. `noindex` on `/search`, `/trip`, `/experiences/compare`, `/experiences/request`, `/maintenance`, `/itinerary/[id]/print`
3. `layout.tsx` metadata for `/towns` and `/about`
4. Resolve `/stories` vs `/mydrakensberg` duplication
5. Repoint Navbar links away from unimplemented filter params
6. Label `/admin/seo` non-functional to stop ongoing silent data loss

---

## Changes explicitly NOT required

| Frequently assumed | Verdict | Reason |
|---|---|---|
| Migrate `site_content` → relational tables | **Not required** | JSONB is sufficient at current scale; `generateStaticParams` wants the whole list anyway. Revisit past ~500 trails |
| Rename `/regions` → `/destinations` | **Not required** | 301s on the only fully-authored slug route for zero ranking gain |
| Rename `/stays` → `/accommodation` | **Not required** | Live, indexed, shorter |
| Replace `vd_entities` with per-type tables | **Not required** | JSONB is the reason SEO fields need no migration — it is an asset here |
| Separate SEO application | **Not required** | Admin console is the correct home; brief forbids it |
| Parallel SEO metadata table | **Actively harmful** | Violates Principle 2 — creates drift. Fields belong on the entity |
| Headless CMS | **Not required** | `site_content` + visual editor already work |
| Abandon `regionsMatch()` for strict FKs | **Not required** | Keep it as the fallback for free-text/legacy data; add `regionSlug` as a fast path |
| Rewrite the client components | **Not required** | They move verbatim into islands |

---

## Determination

**AMBER.**

The architecture does not prevent the SEO strategy — it substantially enables it. The data model is well suited (JSONB = zero-migration extensibility), the routing architecture supports everything required natively, the server-side data layer exists, the detail routes are already dynamic, the relationship logic is already written, and the metadata foundation is correct.

The gap is that **the destination graph is computed for the browser and never delivered to a crawler.** Closing that gap requires one contained, standard, well-understood change to the rendering layer of eight existing routes — applied additively, reversibly, one route at a time, with no migration and no URL breakage.

The audit's recurring finding is not absence but **disconnection**: SEO fields captured and discarded (`Region.seoTitle`), fully authored content with no page (`Reserve`, `Town`), a rich relationship engine rendering client-side only (`SmartRecommendations`), a server client that exists and is unused (`lib/supabase-server.ts`), and an admin SEO panel that saves nothing (`/admin/seo`). In each case the expensive half of the work is already done.

**Maximum SEO capability is reachable with genuinely minimal architectural disruption — approximately 3–4 weeks, no rewrite, no migration, no URL changes.**

---

### Sign-off summary

| Question | Answer |
|---|---|
| Rebuild required? | **No** |
| Database migration required? | **No** |
| URL changes required? | **No** |
| New infrastructure required? | **No** |
| Code changes required? | **Yes — rendering layer of 8 detail routes** |
| Is that change standard practice? | **Yes — the documented Next.js App Router pattern** |
| Reversible? | **Yes — per-route, incremental** |
| Time to full capability? | **~3–4 weeks** |
| **Verdict** | **🟡 AMBER** |
