# URL ARCHITECTURE — current vs recommended

**Guiding principle:** preserve every live URL. Nothing in this document requires changing an existing indexable path.

---

## 1. Public route census

`○` static · `λ` dynamic (server-rendered on demand)

| Current route | Purpose | Mode | Indexable | Canonical | SEO-ready | Recommendation |
|---|---|---|---|---|---|---|
| `/` | Homepage | ○ | ✅ | ✅ | ✅ | **Keep.** Add `WebSite` + `SearchAction` schema |
| `/stays` | Accommodation listing | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/stays/[id]` | Property detail | λ | ✅ | ❌ | ❌ | Add `generateMetadata` + slug resolution + `LodgingBusiness` |
| `/hikes` | Trail listing | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/hikes/[id]` | Trail detail | λ | ✅ | ❌ | ❌ | Add `generateMetadata` + slug + `TouristAttraction`/`ExerciseAction` |
| `/activities` | Activity listing | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/activities/[id]` | Activity detail | λ | ✅ | ❌ | ❌ | Add `generateMetadata` + slug + `Product`/`Offer` |
| `/regions` | Region listing | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/regions/[slug]` | Region detail | λ | ✅ | ❌ | ❌ | **Read the `seoTitle`/`seoDescription` that already exist.** Add `TouristDestination` + `BreadcrumbList` |
| `/nature-reserves` | Reserve listing | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/nature-reserves/[slug]` | — | **MISSING** | — | — | — | **ADD.** Data + slug + SEO fields already exist |
| `/towns` | Town listing | ○ | ✅ | ⚠️ no layout metadata | ⚠️ | Add `layout.tsx` metadata |
| `/towns/[slug]` | — | **MISSING** | — | — | — | **ADD.** Data + slug + SEO fields already exist |
| `/packages` | Package listing | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/packages/[id]` | Package detail | λ | ✅ | ❌ | ❌ | Add `generateMetadata` + slug + `Product`/`Offer` |
| `/guides` | Guide directory | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/guides/[id]` | Guide detail | λ | ✅ | ❌ | ❌ | Add `generateMetadata` + `Person` |
| `/guides/operators/[id]` | Operator detail | λ | ✅ | ❌ | ❌ | Add `generateMetadata` + `Organization` |
| `/experiences/[id]` | Dated departure | λ | ⚠️ | ❌ | ❌ | Add `generateMetadata` + `Event`/`Offer`. Consider `noindex` on sold-out/past departures |
| `/experiences/compare` | Comparison tool | ○ | ❌ should be noindex | ❌ | ❌ | **`noindex`** — utility, thin/duplicative |
| `/experiences/request` | Request form | ○ | ❌ should be noindex | ❌ | ❌ | **`noindex`** |
| `/shuttles` | Shuttle listing | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/shuttles/[route-slug]` | — | **MISSING** | — | — | — | **ADD (Phase 3)** — high commercial intent |
| `/mydrakensberg` | Stories index | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/mydrakensberg/[slug]` | Article | λ | ✅ | ❌ | ❌ | Add `generateMetadata` + `Article`. Move content out of the page file |
| `/stories` | Duplicate of stories? | ○ | ⚠️ | ❌ | ❌ | **Investigate — likely canonical to `/mydrakensberg` or remove.** Navbar "Winter" points here |
| `/events` | Events listing | ○ | ✅ | ✅ | ✅ | **Keep.** Add `Event` schema |
| `/plan` | Trip planning | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/trip` | Trip planner tool | ○ | ⚠️ | ❌ | ❌ | **`noindex`** — interactive tool, not content |
| `/search` | Search | ○ | ⚠️ indexable now | ✅ | ⚠️ | **`noindex, follow`** — search result pages should not be indexed |
| `/towns` | Towns | ○ | ✅ | ⚠️ | ⚠️ | Add metadata |
| `/about` | About | ○ | ✅ | ⚠️ | ⚠️ | Add metadata |
| `/list-your-property` | Supplier acquisition | ○ | ✅ | ✅ | ✅ | **Keep** |
| `/privacy`, `/terms` | Legal | ○ | ✅ | ⚠️ | ⚠️ | Fine as-is |
| `/maintenance` | Maintenance | ○ | ❌ | — | — | **`noindex`** |
| `/dashboard` | Role redirect | ○ | ❌ | — | — | Already disallowed ✅ |
| `/invoices/[id]`, `/quotes/[id]` | Financial docs | λ | ❌ | — | — | **Must be `noindex`.** Verify no public exposure — token-gated |
| `/itinerary/[id]/print` | Print view | λ | ❌ | — | — | **`noindex`** |
| `/checkout/*` | Checkout | ○ | ❌ | — | — | Already disallowed ✅ |
| `/auth/*` | Auth | ○ | ❌ | — | — | Already disallowed ✅ |
| `/admin/*` (24 routes) | Admin | mixed | ❌ | — | — | Already disallowed ✅ |
| `/supplier/*` (40 routes) | Supplier | mixed | ❌ | — | — | Already disallowed ✅ |
| `/account/*` (10 routes) | Visitor account | mixed | ❌ | — | — | Already disallowed ✅ |

### 1.1 Immediate `noindex` candidates (no architecture change, XS effort)

These are indexable today but should not be. Each is a one-line `robots: { index: false, follow: true }` in the route's `layout.tsx`:

```
/search                    thin, infinitely variable, duplicate
/trip                      interactive tool
/experiences/compare       utility, duplicative of listings
/experiences/request       lead form
/maintenance               operational
/itinerary/[id]/print      print view of private data
/invoices/[id]             financial (verify token gating)
/quotes/[id]               financial (verify token gating)
```

`/stories` needs a decision: it duplicates `/mydrakensberg` intent and is linked from the Navbar's "Winter" category. Either canonicalise it to `/mydrakensberg` or repurpose it as a genuine seasonal landing page. Leaving both indexable invites cannibalisation.

---

## 2. Brief's proposed URLs mapped to reality

**Do not rename live routes.** Mapping, not duplication:

| Brief proposes | Platform reality | Verdict |
|---|---|---|
| `/destinations/` | `/regions` | **Keep `/regions`.** Live, indexed, internally linked |
| `/destinations/[slug]` | `/regions/[slug]` | **Keep** |
| `/destinations/tugela-falls` (attraction) | `/nature-reserves/[slug]` — **missing** | **Add the reserve detail route.** Don't nest attractions under `/destinations` |
| `/hikes/`, `/hikes/[slug]` | `/hikes`, `/hikes/[id]` | **Keep path; add slug resolution** |
| `/accommodation/` | `/stays` | **Keep `/stays`** — shorter, live, indexed |
| `/accommodation/[supplier-slug]` | `/stays/[id]` | **Keep path; add slug resolution** |
| `/activities/`, `/activities/[slug]` | `/activities`, `/activities/[id]` | **Keep path; add slug** |
| `/tours/`, `/tours/[slug]` | none (only `/experiences/[id]`) | **Add (Phase 3)** |
| `/guides/[slug]` | `/guides/[id]` | **Keep path; add slug** |
| `/shuttles/[route-slug]` | none | **Add (Phase 3)** |
| `/itineraries/[slug]` | none | **Add (Phase 4)** |
| `/packages/`, `/packages/[slug]` | `/packages`, `/packages/[id]` | **Keep path; add slug** |

**On `/destinations` vs `/regions`:** renaming would require 301s on the only slug-based, fully-authored, indexed destination route on the site, for zero ranking benefit — Google does not reward the literal token "destinations" in a path. `regionsMatch()` already normalises naming variance internally. **Recommendation: no rename. Document `/regions` as the canonical destination namespace.**

---

## 3. Faceted navigation policy

### 3.1 Current state

Filters are read client-side from `window.location.search` after hydration:

```
/stays?region=…        read at app/stays/page.tsx:54
/hikes?region=…        read at app/hikes/page.tsx:43
/activities?region=…   read at app/activities/page.tsx:26
/search?…              useSearchParams()
```

Consequences: no distinct SSR per filter, no canonical, no `noindex`, no robots query rules.

### 3.2 Navbar links to parameters nothing reads

`components/layout/Navbar.tsx` emits links whose params are **never consumed** by the destination page:

```
/hikes?difficulty=easy | moderate | strenuous     ← page reads only ?region
/hikes?type=multiday   /hikes?feature=guided      ← not read
/hikes?season=winter                              ← not read
/stays?type=lodge | guesthouse | cottage | …      ← page reads only ?region
/activities?cat=horse-riding | wellness | …       ← page reads only ?region
/nature-reserves?type=heritage | scenic | culture ← page reads nothing
```

Every one of these is a crawlable URL resolving to an **unfiltered page** — duplicate content plus a real UX defect (user clicks "Easy Walks", gets all trails). Two options, both cheap:

- **(a)** Implement the filters (best — turns each into a legitimate landing page), or
- **(b)** Point the links at the plain path until implemented.

**Recommendation: (a) for `difficulty` and `type` on `/hikes` and `/stays`** — these are real search intents with volume ("easy hikes drakensberg", "drakensberg lodges"). **(b) for the rest** as an interim.

### 3.3 Recommended indexation policy

| URL pattern | Policy | Rationale |
|---|---|---|
| `/stays`, `/hikes`, `/activities` (bare) | **INDEX**, self-canonical | Primary listings |
| `/hikes?region=north-berg` | **INDEX**, self-canonical | Real demand: "northern drakensberg hikes". Only for the 3 canonical regions |
| `/hikes?difficulty=easy` | **INDEX**, self-canonical *(once implemented)* | Real demand: "easy hikes drakensberg" |
| `/stays?type=lodge` | **INDEX**, self-canonical *(once implemented)* | Real demand |
| **Two or more facets combined** | **`noindex, follow`** + canonical to single-facet parent | Combinatorial explosion, thin results |
| `?sort=…` | **canonical to unsorted** | Pure duplicate |
| Zero-result filter URLs | **`noindex`** | Thin content |
| `/search?…` | **`noindex, follow`** | Search results |
| Pagination (if added) | self-canonical + `rel=prev/next` | Never canonical-to-page-1 |

**Explicitly rejected:** indexing arbitrary filter combinations, or auto-generating a page per facet permutation. Only single-facet URLs matching a named, demand-backed intent get indexed, and each must be individually whitelisted in the SEO admin — never generated wholesale.

### 3.4 Implementation note

Because filters are client-side, a canonical/robots policy needs the param visible at render time. Cheapest correct approach that preserves the existing pattern:

- Add `generateMetadata({ searchParams })` to listing route `layout.tsx` (or convert the listing page to a server shell), returning self-canonical for whitelisted single-facet values and `noindex` + parent canonical otherwise.
- Keep the client component and its `useEffect` filter reading **exactly as-is** — this is purely additive metadata.

---

## 4. Slug migration strategy — additive, zero-risk

The goal is `/stays/cathedral-peak-hotel` instead of `/stays/prop-8f3a…`. This must not break the ~existing UUID URLs (bookmarked, possibly linked, possibly indexed).

### 4.1 Resolution order

Add `slug?: string` to the entity payload (JSONB — no migration), then resolve **slug first, ID second**:

```ts
// app/stays/[id]/page.tsx  →  param stays named [id]; no route rename needed
async function resolveProperty(param: string) {
  const bySlug = await getPropertyBySlug(param)   // new
  if (bySlug) return { entity: bySlug, matchedBy: 'slug' as const }
  const byId = await getPropertyById(param)        // existing behaviour
  if (byId) return { entity: byId, matchedBy: 'id' as const }
  return null
}
```

Behaviour:

| Request | Result |
|---|---|
| `/stays/cathedral-peak-hotel` | 200, canonical = itself |
| `/stays/prop-8f3a…` (has slug) | 200, **canonical = `/stays/cathedral-peak-hotel`** — consolidates signals without a redirect |
| `/stays/prop-8f3a…` (no slug yet) | 200, canonical = itself — unchanged behaviour |
| `/stays/nonsense` | 404 via `not-found.tsx` |

This means:
- **No URL changes.** The dynamic segment keeps its name.
- **No redirects required** on day one — canonical does the consolidation.
- **Gradual rollout.** Entities without a slug behave exactly as today.
- **Optional hardening later:** once slugs are populated and stable, upgrade ID→slug from canonical to a 301 via the redirect manager.

### 4.2 Slug generation

`slugifyRegion()` already exists (`lib/regions.ts:75`) and handles `&`→`and`, non-alphanumerics, edge dashes. **Reuse it** — rename conceptually to a shared `slugify()`; do not write a second implementation.

Collision handling: append a short discriminator (`cathedral-peak-hotel-2`). Slugs must be **immutable once published** — changing one creates an orphan and needs a 301, which is exactly what the redirect manager is for.

### 4.3 Sitemap must only ever contain canonical URLs

Once slugs exist, the sitemap emits the **slug form only**, never the ID form. Non-canonical URLs in a sitemap send conflicting signals.

---

## 5. Sitemap architecture (replacing the hardcoded file)

Current `app/sitemap.ts`: 17 static paths + 6 hand-copied story slugs. Zero database entities.

Target — a single async sitemap reading canonical, indexable entities:

```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [regions, reserves, towns, trails, properties, activities, packages, operators] =
    await Promise.all([...])

  return [
    ...STATIC_ROUTES.map(…),
    ...regions.filter(indexable).map(r => url(`/regions/${r.slug}`, r.updatedAt)),
    ...reserves.filter(indexable).map(r => url(`/nature-reserves/${r.slug}`, r.updatedAt)),
    ...towns.filter(indexable).map(t => url(`/towns/${t.slug}`, t.updatedAt)),
    ...trails.filter(indexable).map(t => url(`/hikes/${t.slug ?? t.id}`, t.updatedAt)),
    ...properties.filter(indexable).map(p => url(`/stays/${p.slug ?? p.id}`, p.updatedAt)),
    ...activities.filter(indexable).map(a => url(`/activities/${a.slug ?? a.id}`, …)),
    ...packages.filter(indexable).map(p => url(`/packages/${p.slug ?? p.id}`, …)),
    ...operators.filter(indexable).map(o => url(`/guides/${o.slug ?? o.id}`, …)),
  ]
}
```

Where `indexable` enforces: `status` published/active **and** `robotsIndex !== false` **and** a slug-or-ID exists.

Requirements:
- Read via `lib/supabase-server.ts` (already exists).
- **Never** include `noindex` entities — this is what makes Tool 10 and Tool 12 truthful.
- Story slugs come from the Article entity once it exists, removing the hand-copied array and its drift risk.
- Add `revalidate` so the sitemap refreshes without a deploy.
- If the URL count passes ~10k, split into a sitemap index. Not a near-term concern.

---

## 6. Redirect infrastructure (currently absent)

There is no `redirects()` in `next.config.js` and no redirect table. This blocks any slug change, page consolidation, or cannibalisation fix — and it is the reason §4's canonical-first approach is correct for now.

Minimal viable design:

```
site_content key: 'admin_redirects'
  → { items: [{ id, from, to, statusCode: 301|302, createdAt, hitCount? }] }
```

Served by `middleware.ts` (a middleware already exists — 224 kB in the build) or `next.config.js` `redirects()`. Middleware is preferable: DB-driven, editable by admins, no deploy required.

Must enforce: no chains (A→B→C collapses to A→C), no loops, `from` must not be a live route.
