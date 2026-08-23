# ARCHITECTURE AUDIT — Visit Drakensberg

**Audit date:** 2026-08-13
**Scope:** `visit-drakensberg-platform/frontend` (Next.js application), `frontend/supabase/migrations`
**Method:** static inspection of routes, components, data-access libs, migrations, build output. No code modified, no data touched.

---

## 1. Application architecture

| Aspect | Finding | Evidence |
|---|---|---|
| Framework | Next.js **14.1.0** | `package.json:26` |
| Router | **App Router** exclusively. No `pages/` directory. | `app/` tree; no `pages/` found |
| Language | TypeScript 5, React 18 | `package.json` |
| Styling | Tailwind 3.4 + custom design tokens | `tailwind.config` |
| Deployment | **Vercel** (monorepo, root dir `visit-drakensberg-platform/frontend`) | Vercel PR bot metadata |
| Total routes | 115 pages built successfully | `npm run build` |
| Public routes | ~30 | route census in `URL_ARCHITECTURE.md` |
| Admin/supplier routes | ~70 (correctly disallowed in robots) | `app/admin/*`, `app/supplier/*` |

### 1.1 Rendering model — the defining characteristic

**Every public page is a client component.** All eight entity detail pages begin with `'use client'`:

```
app/hikes/[id]/page.tsx          'use client'
app/stays/[id]/page.tsx          'use client'
app/activities/[id]/page.tsx     'use client'
app/regions/[slug]/page.tsx      'use client'
app/packages/[id]/page.tsx       'use client'
app/guides/[id]/page.tsx         'use client'
app/experiences/[id]/page.tsx    'use client'
app/mydrakensberg/[slug]/page.tsx 'use client'
```

Data is fetched **in `useEffect` after hydration**, via the browser-side Supabase client.

Route-level metadata is currently achieved with a workaround: a sibling **`layout.tsx` server component** exporting a static `export const metadata`. This is applied on 14 listing routes and works correctly:

```
app/hikes/layout.tsx      → title: "Drakensberg Hikes & Trails"  + canonical /hikes
app/stays/layout.tsx      → title: "Places to Stay in the Drakensberg" + canonical /stays
app/activities/layout.tsx, app/regions/layout.tsx, app/guides/layout.tsx,
app/packages/layout.tsx, app/shuttles/layout.tsx, app/events/layout.tsx,
app/nature-reserves/layout.tsx, app/search/layout.tsx, app/plan/layout.tsx,
app/mydrakensberg/layout.tsx, app/list-your-property/layout.tsx
```

This pattern is sound for **listing** pages, where metadata is fixed. It **cannot work for detail pages**, where title/description/canonical must vary per entity — a static `layout.tsx` cannot know which entity is being rendered.

### 1.2 Confirmed absences

```
generateMetadata      → 0 occurrences across the entire app/ tree
generateStaticParams  → 0 occurrences
revalidate / ISR      → not configured on any route
```

**Consequence:** every entity detail page is served with the *generic root metadata* — `"Visit Drakensberg | Book Your Mountain Escape"` — regardless of whether it is Tugela Falls, a lodge, or a shuttle route. There is no per-entity title, description, canonical, or OG image anywhere on the site.

### 1.3 Build classification

From `npm run build`:

| Symbol | Meaning | Public entity routes |
|---|---|---|
| `○` | Static (prerendered) | `/stays`, `/hikes`, `/activities`, `/regions`, `/packages`, `/guides`, `/nature-reserves`, `/towns`, `/shuttles`, `/mydrakensberg` |
| `λ` | Dynamic (server-rendered on demand, Node.js) | `/stays/[id]`, `/hikes/[id]`, `/activities/[id]`, `/regions/[slug]`, `/packages/[id]`, `/guides/[id]`, `/experiences/[id]`, `/mydrakensberg/[slug]` |

Detail pages *are* dynamic (`λ`), so Node.js runs per request — the infrastructure to do server-side data fetching and `generateMetadata` is already in place and being paid for. It is simply not used. The server render currently emits a loading shell because the page body is a client component fetching in `useEffect`.

### 1.4 API architecture

19 route handlers under `app/api/`, all correctly `Disallow`ed:

- Admin operations: `invite`, `ops/*`, `set-level`, `recover-admin`, `supplier/[id]`
- Payments: `payments/ikhokha/create`, `payments/ikhokha/webhook`
- Comms: `notifications/email`, `invoices/send`, `quotes/send`, `receipts/send`, `channels/send`
- Cron: `cron/expire-pending-bookings`
- Proxy: `backend/[...path]`

No server actions in use. Mutations go through the client Supabase SDK or these route handlers.

### 1.5 Authentication & authorization

| Layer | Implementation | File |
|---|---|---|
| Client | `createClientComponentClient` (anon key) | `lib/auth.ts:6` |
| Server (RSC) | `createServerComponentClient({ cookies })` — **exists, unused by public pages** | `lib/supabase-server.ts:4` |
| Server (privileged) | service-role client for API routes | `lib/supabase-admin.ts` |
| Role source | `app_metadata.role` (server-set) with `user_metadata.role` fallback | `lib/supabase-server.ts:29` |
| Enforcement | RLS on `vd_entities` (`owner_id`) + `requireRole()` helper | `20260704_secure_data_layer.sql` |

**Key finding:** `lib/supabase-server.ts` already provides a working server-side Supabase client. The plumbing required for server-rendered entity pages exists and is tested — nothing new needs to be introduced.

---

## 2. Data architecture

There are **two distinct storage patterns**, and the split matters for SEO.

### Pattern A — `vd_entities` (row-per-item, JSONB payload)

Defined in `20260704_secure_data_layer.sql`, wrapped by `lib/entities.ts`.

```
vd_entities( id text PK, kind text, owner_id uuid, status text,
             value jsonb, created_at, updated_at )
```

`value` holds the entire domain object; `id`/`status`/`owner_id` are mirrored into columns so RLS and indexes work.

**Kinds in use:** `property`, `room`, `activity`, `tour`, `package`, `departure`, `operator_profile`, `media`

**SEO significance — this is very favourable.** Because the payload is JSONB, adding `slug`, `seoTitle`, `seoDescription`, `ogImage`, `robotsIndex`, or `relatedEntityIds` to any entity requires **no migration whatsoever**. Write the field, read the field. The generic accessors (`listEntities`, `getEntity`, `updateEntity`) pass unknown keys through untouched — `updateEntity` merges via `{ ...existing, ...patch }` (`lib/entities.ts:87`).

### Pattern B — `site_content` (key → JSONB blob)

```
site_content( key text PK, value jsonb, updated_at )
```

Keys in use: `trails`, `admin_regions`, `admin_reserves`, `admin_towns`, `admin_message_templates`, plus visual-editor section keys.

Each key holds an **array of all items** under `value.items`. So all trails are one row; all regions are one row.

**SEO significance — workable but with a ceiling.** Reads are whole-blob (`getRegions()` fetches every region to return one). That is fine at the current scale (3 regions, ~8 reserves, ~10 towns, tens of trails) and fine for `generateStaticParams`, which wants the full list anyway. It becomes a concern past a few hundred trails, and it prevents per-row RLS or per-row `updated_at` for accurate sitemap `lastModified`. **Not a blocker today. Flagged as a scaling watch-item, not a required change.**

### 2.1 SEO field readiness per entity — the single most useful finding

| Entity | Storage | Stable ID | Slug | `seoTitle`/`seoDescription` | Detail route |
|---|---|---|---|---|---|
| **Region** | `site_content:admin_regions` | ✅ | ✅ `slug` | ✅ **both present** | ✅ `/regions/[slug]` |
| **Reserve** | `site_content:admin_reserves` | ✅ | ✅ `slug` | ✅ **both present** | ❌ **none** |
| **Town** | `site_content:admin_towns` | ✅ | ✅ `slug` | ✅ **both present** | ❌ **none** |
| **Trail** | `site_content:trails` | ✅ | ⚠️ `slug?` optional, unused | ❌ | ✅ `/hikes/[id]` |
| **Property** | `vd_entities:property` | ✅ `prop-<uuid>` | ❌ | ❌ | ✅ `/stays/[id]` |
| **Activity** | `vd_entities:activity` | ✅ `act-<uuid>` | ❌ | ❌ | ✅ `/activities/[id]` |
| **Package** | `vd_entities:package` | ✅ `pkg-<uuid>` | ❌ | ❌ | ✅ `/packages/[id]` |
| **Tour** | `vd_entities:tour` | ✅ `tour-<uuid>` | ❌ | ❌ | ❌ (surfaces via experiences) |
| **Operator/Guide** | `vd_entities:operator_profile` | ✅ | ❌ | ❌ | ✅ `/guides/[id]` |
| **Departure** | `vd_entities:departure` | ✅ `dep-<uuid>` | ❌ | ❌ | ✅ `/experiences/[id]` |
| **Shuttle route** | transport marketplace | ✅ | ❌ | ❌ | ❌ **none** |

Two things fall out of this table:

1. **The SEO metadata pattern is already established in this codebase.** `Region`, `Reserve` and `Town` each carry `slug`, `seoTitle`, `seoDescription` (`lib/regions.ts:18–19`, `lib/reserves.ts:21–22`, `lib/towns.ts`). It is a proven, admin-editable shape. It simply has not been extended to the commercial entities — and, critically, **no page reads these fields**. The data is being captured and thrown away.

2. **Reserves and Towns already have full SEO data and slugs but have no detail page to render on.** `/nature-reserves` and `/towns` are listing-only. This is the highest-value, lowest-risk gap on the site: the content exists, the slugs exist, the SEO fields exist, and 100% of that value is currently unreachable by search engines.

### 2.2 Entity ID format and URL consequence

`newEntityId()` (`lib/entities.ts:28`) produces `<prefix>-<uuid>`:

```
prop-8f3a2b1c-4d5e-6f70-8192-a3b4c5d6e7f8
```

So a live accommodation URL today is:

```
/stays/prop-8f3a2b1c-4d5e-6f70-8192-a3b4c5d6e7f8
```

This is a genuine SEO weakness — no keyword signal, unmemorable, unlinkable by humans. It is however **fixable without breaking anything** (see `URL_ARCHITECTURE.md` §4: additive slug resolution with ID fallback).

---

## 3. SEO technical implementation — what already works

Credit where due. The following is implemented correctly and **should not be touched**:

| Item | Status | Evidence |
|---|---|---|
| `metadataBase` | ✅ correct | `app/layout.tsx:8` |
| Title template `%s \| Visit Drakensberg` | ✅ correct | `app/layout.tsx:11` |
| Default description + keywords | ✅ present | `app/layout.tsx:13–18` |
| Root canonical | ✅ | `app/layout.tsx:19` |
| Open Graph (type, siteName, locale `en_ZA`, url) | ✅ correct | `app/layout.tsx:20–28` |
| Twitter card `summary_large_image` | ✅ | `app/layout.tsx:29–34` |
| `robots: { index, follow }` | ✅ | `app/layout.tsx:35` |
| Viewport export | ✅ correct (not in metadata) | `app/layout.tsx:39` |
| `robots.ts` with correct disallows | ✅ **well done** | `app/robots.ts` — blocks `/admin/ /supplier/ /account/ /dashboard/ /checkout/ /api/ /auth/` |
| Sitemap reference in robots | ✅ | `app/robots.ts:22` |
| `sitemap.ts` exists, typed | ✅ structurally | `app/sitemap.ts` |
| `not-found.tsx` | ✅ | `app/not-found.tsx` |
| Static metadata on 14 listing routes | ✅ **good quality copy** | `app/*/layout.tsx` |
| Organisation JSON-LD (`TravelAgency`) | ✅ | `app/layout.tsx:44–52` |
| `next/image` with remote patterns | ✅ | `next.config.js` |
| Lazy loading + `decoding=async` on grids | ✅ | `app/hikes/page.tsx:198` |

The metadata *foundation* is genuinely solid. The problem is not the foundation — it is that the foundation is never extended to individual entities.

## 4. SEO technical implementation — what is missing

| Item | Status | Impact |
|---|---|---|
| Per-entity `generateMetadata` | ❌ **absent everywhere** | **Critical.** Every detail page shares one title. |
| Per-entity canonical | ❌ absent | High — duplicate-content risk |
| Per-entity OG image | ❌ absent | Medium — poor social sharing |
| Entity URLs in sitemap | ❌ **zero DB entities** | **Critical.** `sitemap.ts` lists 17 static paths + 6 hardcoded story slugs. No trail, stay, activity, region, reserve or town is discoverable via sitemap. |
| Entity structured data | ❌ only root `TravelAgency` | High — no `TouristAttraction`, `Trail`, `LodgingBusiness`, `Product`, `Offer`, `Event` |
| `BreadcrumbList` JSON-LD | ❌ absent | Medium — visual breadcrumb exists on `/regions/[slug]` only, with no markup |
| Faceted-nav canonical/noindex policy | ❌ none | High — see §5 |
| `hreflang` | n/a | Single locale (`en_ZA`) — correctly omitted |
| Redirect manager | ❌ none | Blocks any future slug migration |
| Image `alt` coverage | ⚠️ partial | Grid images have alt; some decorative/hero images do not |

### 4.1 The sitemap is the clearest single failure

`app/sitemap.ts` is 53 lines of hardcoded arrays. Its own comment admits the gap:

```ts
// Public, indexable routes. Detail pages backed by live Supabase data are
// intentionally omitted here — add them once listing slugs are stable.
```

And the 6 story slugs are duplicated by hand from `app/mydrakensberg/[slug]/page.tsx` — already a drift risk.

Every piece of commercially valuable content on the platform — every trail, every lodge, every activity, every region, every reserve — is absent from the sitemap. Combined with the metadata gap, this means the destination graph is effectively invisible to search.

## 5. Faceted navigation — current behaviour

Filters are read **client-side, after hydration**, from `window.location.search`:

```
app/stays/page.tsx:54       new URLSearchParams(window.location.search).get('region')
app/hikes/page.tsx:43       new URLSearchParams(window.location.search).get('region')
app/activities/page.tsx:26  new URLSearchParams(window.location.search).get('region')
app/search/page.tsx:147     useSearchParams()
```

Implications:

- `?region=X` produces **no distinct server-rendered HTML** — the SSR output is identical for every filter value. From a crawler's perspective `/stays` and `/stays?region=north-berg` are the same empty shell.
- There is **no canonical tag** declaring `/stays?region=…` a variant of `/stays`.
- There is **no `noindex`** on filter combinations, and no `Disallow` for query strings in `robots.ts`.
- Filters are not combinatorially exploding *yet* (single `region` param on three pages, plus `/search`), so live duplicate-content damage is currently **low** — but the policy vacuum means it will scale badly the moment more facets ship.

Nav links already generate parameterised URLs that nothing governs, e.g. `/hikes?difficulty=easy`, `/stays?type=lodge`, `/activities?cat=wellness`, `/nature-reserves?type=heritage` (`components/layout/Navbar.tsx`). Several of these target params the destination page **does not even read** (`type`, `cat`, `difficulty`, `season`) — they are links to unfiltered pages, which is both a UX bug and a crawl-budget waste.

## 6. Internal linking — current state

Genuine relationship logic already exists and is better than expected:

| Mechanism | File | What it does |
|---|---|---|
| `regionsMatch()` + `SUBREGION_ALIASES` | `lib/regions.ts:90–126` | Fuzzy region matching incl. park→region aliases (`royal natal national park` → `north berg`) |
| `SmartRecommendations` | `components/booking/SmartRecommendations.tsx` | Live cross-type recommendations (trails + activities + experiences), region-filtered, now distance-sorted |
| `destination-ia.ts` | `lib/destination-ia.ts` | `DESTINATIONS`, `PRIMARY_NAVIGATION`, `distanceKm()`, `buildDestinationRecommendations()` |
| `StayDistance` | `lib/stay-distance.tsx` | Haversine + Google Distance Matrix proximity |
| Region detail cross-links | `app/regions/[slug]/page.tsx` | Region → stays / trails / activities |
| Navbar destination links | `components/layout/Navbar.tsx` | Derived from `DESTINATIONS` |

**The destination graph substantially exists in application logic.** `regionsMatch` + GPS coordinates + `regionSlug` on reserves are enough to derive Destination→Trail→Activity→Accommodation relationships today.

What is missing is that these relationships are **computed client-side for UI only**. They are never emitted as crawlable `<a href>` in server HTML, never expressed as structured data, and never persisted as editable relationships. The graph exists; search engines cannot see it.

Missing relationship links specifically:

- Trail → nearby accommodation (computed in `SmartRecommendations` for stays, not the reverse)
- Trail → operators / guides offering it (data exists via `departure.trailId` → `tour` → `operator_profile`)
- Reserve → trails / accommodation (`regionSlug` exists; unused — no reserve page)
- Town → nearby everything (`slug` exists; unused — no town page)
- Supplier → their full product set (partially on `/guides/operators/[id]`)
- Any entity → related articles (`mydrakensberg` posts are hardcoded, not linked to entities)

## 7. Content architecture / CMS

| Capability | Status | Where |
|---|---|---|
| Homepage sections (hero, promos, footer) | ✅ editable + persisted | `lib/site-content.ts`, `/admin/website` |
| Page headers | ✅ editable | `components/editor/EditablePageHeader` |
| Regions CRUD (incl. `seoTitle`/`seoDescription`) | ✅ **persisted** | `/admin/regions`, `lib/regions.ts` |
| Reserves CRUD (incl. SEO fields) | ✅ persisted | `/admin/reserves` |
| Towns CRUD (incl. SEO fields) | ✅ persisted | `/admin/towns` |
| Trails CRUD | ✅ persisted | `/admin/trails` |
| Blog / stories | ⚠️ `/admin/blog` exists; public stories are **hardcoded** in `app/mydrakensberg/[slug]/page.tsx` | — |
| **`/admin/seo`** | ❌ **non-functional mockup** | see below |

### 7.1 `/admin/seo` is a mockup, not a feature

This is important to state plainly. `app/admin/seo/page.tsx`:

- Holds SEO values in **local React state only** (`useState(DEFAULT_SEO)`, line 23).
- `handleSave()` does nothing but flip a "Saved" flag for 2 seconds:
  ```ts
  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  ```
  **There is no Supabase write. Nothing persists. Reloading the page loses everything.**
- `DEFAULT_SEO` is hardcoded for **2 of 7 listed pages** (`home`, `stays`).
- Covers only 7 hardcoded listing paths — no entity pages.
- Even if it saved, **no public page reads these values**, because no page has `generateMetadata`.

So the admin console *appears* to offer SEO management to the Visit Drakensberg team while doing nothing at all. Any team member who has "edited SEO" here has had their work silently discarded. This should be treated as the top-priority correctness fix in the admin surface, independent of the wider strategy.

---

## 8. Programmatic SEO capability assessment

**Question:** can a single Trail entity produce a rich `/hikes/tugela-falls` page with title, description, distance, elevation, difficulty, map, GPX, images, safety, related accommodation, guides, tours, shuttles, itineraries?

**Data availability — strong.** `Trail` already carries name, region, distance, elevation, duration, difficulty, image, `trail_type`, `speciality_type`, `permit_required`, `analytics.routeArtworkSvg`, GPX route data (`lib/gpx.ts`, `ROUTE_TYPES`), and start-point coordinates (`trailStartPoint()`). Related inventory is derivable *today* via `regionsMatch()` + GPS proximity + `departure.trailId`.

**Delivery capability — blocked.** The data cannot reach a crawler as indexable content because:

1. No `generateMetadata` → generic title/description/canonical.
2. Client-side fetch → entity content absent from server HTML.
3. Not in sitemap → not discoverable.
4. No structured data → no rich-result eligibility.
5. URL is `/hikes/<trail-id>`, not `/hikes/tugela-falls`.

The same conclusion applies to supplier-generated pages (property, activity, package, operator).

**Verdict: the constraint is the delivery layer, not the data model.** That is the favourable case — delivery is fixable with standard Next.js patterns and no data migration.

---

## 9. Summary judgement

**The architecture is capable. The capability is unused.**

Specifically:

- The **data model is well suited** to a destination graph. JSONB payloads mean SEO fields and relationship arrays can be added to any entity with zero migrations. The SEO field shape is already proven on three entities.
- The **routing architecture is correct**. App Router + dynamic segments + already-dynamic (`λ`) detail routes support `generateMetadata`, `generateStaticParams` and ISR natively. `lib/supabase-server.ts` already exists.
- The **relationship logic already exists** (`regionsMatch`, `destination-ia.ts`, GPS distance) — it is applied to UI but never to crawlable output.
- The **one genuine architectural constraint** is the universal `'use client'` + `useEffect` fetch pattern on detail pages, which structurally prevents per-entity metadata.

That constraint requires a real but **contained and well-understood** change: convert each entity detail page into a thin server component (data fetch + `generateMetadata` + structured data) that renders the existing client component as an interactive island. **No database migration. No URL changes. No rewrite.** The existing client components are reused essentially as-is.

**Verdict: AMBER** — see `ARCHITECTURE_CHANGE_DECISION.md` for the full evidence-based determination.
