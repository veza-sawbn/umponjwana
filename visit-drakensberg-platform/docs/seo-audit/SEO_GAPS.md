# SEO GAPS — prioritised

Ranked by **(SEO impact) ÷ (effort × risk)**. Every gap cites file-level evidence.

**Effort:** XS < 2h · S < 1d · M 1–3d · L 1w+
**Risk:** 🟢 additive/reversible · 🟡 touches shared code · 🔴 changes live URLs or data

---

## TIER 1 — Critical, low risk, do first

### G1 · No per-entity metadata anywhere
**Impact: critical · Effort: M · Risk: 🟢**

Zero `generateMetadata` in the codebase. Every one of the eight entity detail routes serves the root title `"Visit Drakensberg | Book Your Mountain Escape"`. Tugela Falls, a lodge, and a shuttle are indistinguishable to a crawler.

- **Evidence:** `grep -rl generateMetadata app/` → no matches. All detail pages are `'use client'`.
- **Fix:** thin server wrapper per route — `generateMetadata` + data fetch + render the existing client component as an island. Detail routes are already `λ` (dynamic), so no new runtime cost.
- **Why first:** everything else (sitemap value, structured data, canonical, Tool 1) is worthless until entity metadata exists.

### G2 · Sitemap contains no database entities
**Impact: critical · Effort: S · Risk: 🟢**

`app/sitemap.ts` is 17 hardcoded static paths + 6 hand-copied story slugs. Not one trail, stay, activity, region, reserve or town is discoverable via sitemap. The file's own comment concedes it: *"Detail pages backed by live Supabase data are intentionally omitted here."*

- **Fix:** async sitemap reading indexable entities via `lib/supabase-server.ts` (already exists). Emit canonical form only.
- Also removes the drift risk between the hardcoded story array and `app/mydrakensberg/[slug]/page.tsx`.

### G3 · `/admin/seo` persists nothing — silent data loss
**Impact: high (operational correctness) · Effort: S · Risk: 🟢**

```ts
function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2000) }
```

No Supabase write. Values live in `useState` and vanish on reload. `DEFAULT_SEO` is hardcoded for 2 of 7 listed pages. It displays "Saved" to the user regardless.

- **Evidence:** `app/admin/seo/page.tsx:32–35`, `:23`
- **Fix:** replace with Tool 1 writing to entity payloads. **Interim (today): label the page non-functional** so no further team work is lost in it.
- This is a correctness bug, not just a gap — the console currently misinforms its users.

### G4 · Reserves and Towns have full SEO data and no page
**Impact: high · Effort: S · Risk: 🟢**

`Reserve` carries `slug`, `regionSlug`, `seoTitle`, `seoDescription`, `description`, `peaks[]`, `permits`, `bestTime`, `facilities`, `viewpointName`. `Town` likewise has `slug` + SEO fields. Admin CRUD exists for both. **Neither has a detail route** — `/nature-reserves` and `/towns` are listing-only.

- **Evidence:** `lib/reserves.ts:5–24`; `ls app/nature-reserves/` → no `[slug]/`
- **Fix:** add `/nature-reserves/[slug]` and `/towns/[slug]` as server components.
- **Best ratio on the site:** content already written, slugs already assigned, SEO fields already populated — currently 100% invisible to search. Pure additive win, no risk to existing URLs.

### G5 · Region SEO fields are captured and discarded
**Impact: high · Effort: XS · Risk: 🟢**

`Region.seoTitle` and `Region.seoDescription` are populated in `DEFAULT_REGIONS` and editable at `/admin/regions`. `/regions/[slug]` never reads them — it's a client component, and `app/regions/layout.tsx` supplies only static listing metadata.

- **Evidence:** `lib/regions.ts:18–19`, `:37–39`; `app/regions/[slug]/page.tsx:1` = `'use client'`
- **Fix:** falls out of G1 for free on this route. Smallest possible change, immediate effect.

### G6 · No entity structured data
**Impact: high · Effort: M · Risk: 🟢**

Only one JSON-LD block exists site-wide (`TravelAgency`, `app/layout.tsx:44`). No `TouristAttraction`, `Trail`, `LodgingBusiness`, `Product`, `Offer`, `Event`, `Person`, `BreadcrumbList`.

All required fields are already present in the data: property has name/address/geo/amenities/price; activity has price/duration/difficulty/GPS; departure has dates/availability/price; trail has distance/elevation/difficulty.

- **Fix:** per-kind JSON-LD emitted from the same server wrapper as G1.

---

## TIER 2 — High impact, contained

### G7 · UUID URLs on all commercial entities
**Impact: medium-high · Effort: M · Risk: 🟡**

`/stays/prop-8f3a2b1c-4d5e-6f70-8192-a3b4c5d6e7f8`. No keyword signal, unshareable, unmemorable. Affects property, activity, package, tour, operator, departure.

- **Evidence:** `lib/entities.ts:28–33`; no `slug` field on those types
- **Fix:** additive slug resolution — slug first, ID fallback, canonical points at the slug form. **No URL breaks, no redirects needed on day one.** See `URL_ARCHITECTURE.md` §4.
- `Trail.slug?` is already declared (`lib/trails.ts:48`) — just unused. `slugifyRegion()` (`lib/regions.ts:75`) already exists and should be reused, not reimplemented.

### G8 · Navbar links to filters that don't exist
**Impact: medium · Effort: S · Risk: 🟢**

The Navbar emits crawlable URLs whose parameters no page reads:

```
/hikes?difficulty=easy|moderate|strenuous   /hikes?type=multiday   /hikes?feature=guided
/hikes?season=winter   /stays?type=lodge|guesthouse|cottage|camping|hostel
/activities?cat=horse-riding|rock-climbing|fly-fishing|birding|wellness
/nature-reserves?type=heritage|scenic|culture
```

Each resolves to a **completely unfiltered page** — duplicate content *and* a UX defect (click "Easy Walks", get every trail).

- **Evidence:** `components/layout/Navbar.tsx:64–107` vs `app/hikes/page.tsx:43` (reads only `region`)
- **Fix:** implement `difficulty` on `/hikes` and `type` on `/stays` (real demand, becomes a legitimate landing page); point the remainder at plain paths until implemented.

### G9 · No faceted-navigation indexation policy
**Impact: medium-high · Effort: M · Risk: 🟡**

Filters are read client-side from `window.location.search`, so `?region=X` produces no distinct SSR. No canonical, no `noindex`, no robots query rules.

- **Evidence:** `app/stays/page.tsx:54`, `app/hikes/page.tsx:43`, `app/activities/page.tsx:26`
- **Fix:** whitelist single-facet URLs matching named intents (self-canonical, index); `noindex` + parent canonical for multi-facet, sorted, and zero-result URLs. Policy table in `URL_ARCHITECTURE.md` §3.3.
- Live damage is currently **low** (one param, three pages) — but the vacuum scales badly the moment G8 is implemented. Fix G9 *with* G8.

### G10 · Utility pages indexable
**Impact: medium · Effort: XS · Risk: 🟢**

`/search`, `/trip`, `/experiences/compare`, `/experiences/request`, `/maintenance`, `/itinerary/[id]/print` are all indexable. `/invoices/[id]` and `/quotes/[id]` need verification that token gating prevents public exposure.

- **Fix:** one `robots: { index: false, follow: true }` per route layout. Cheapest item in this document.

### G11 · `/stories` vs `/mydrakensberg` cannibalisation
**Impact: medium · Effort: XS · Risk: 🟡**

Both exist and target editorial intent. `/stories` has no `layout.tsx` metadata; the Navbar's "Winter" category points at it.

- **Fix:** decide — canonicalise `/stories` → `/mydrakensberg`, or make it a genuine seasonal landing page. Leaving both indexable splits signals.

### G12 · No breadcrumb structured data
**Impact: medium · Effort: S · Risk: 🟢**

A visual breadcrumb exists on `/regions/[slug]` only, with no `BreadcrumbList` markup anywhere.

- **Fix:** emit `BreadcrumbList` from the server wrapper (G1); add visual breadcrumbs to the other detail routes.

---

## TIER 3 — Real value, larger scope

### G13 · Articles hardcoded in a page file
**Impact: medium · Effort: M · Risk: 🟢**

Story content lives inside `app/mydrakensberg/[slug]/page.tsx`; the 6 slugs are duplicated by hand into `app/sitemap.ts:28–35`. `/admin/blog` exists but does not drive the public pages. Articles cannot participate in the entity graph.

- **Fix:** promote Article to an entity (`slug`, `seoTitle`, `seoDescription`, `relatedEntityIds[]`), then link entities ↔ articles.

### G14 · No relationship persistence
**Impact: medium-high (strategic) · Effort: M · Risk: 🟢**

Relationships are computed at runtime for UI (`regionsMatch`, `haversineKm`, `SmartRecommendations`) and never stored, never crawlable, never admin-correctable.

- **Fix:** additive `relatedTrailIds[]`, `relatedPropertyIds[]`, `regionSlug`, `reserveSlug`, `townSlug` on entity payloads (JSONB — no migration). Keep the derived logic as fallback.
- Unblocks Tools 3, 4, 7, 15.

### G15 · Recommendations not crawlable
**Impact: medium · Effort: S · Risk: 🟢**

`SmartRecommendations` produces genuinely good cross-type, distance-sorted internal links — entirely client-side, so no crawler sees them.

- **Fix:** server-render a "Nearby" block on entity pages (falls out of G1).

### G16 · No redirect infrastructure
**Impact: medium (blocking) · Effort: M · Risk: 🟢**

No `redirects()` in `next.config.js`, no redirect table. Blocks slug hardening, page consolidation, and Tool 8's consolidation action.

- **Fix:** Tool 11 over `site_content:admin_redirects`, served by the existing `middleware.ts`.

### G17 · No tours listing, no shuttle route pages
**Impact: medium · Effort: M each · Risk: 🟢**

`tour` kind exists with supplier CRUD but no public listing — tours surface only as dated departures (`/experiences/[id]`), which is commercially right but SEO-weak (transient vs evergreen). Transport marketplace data exists but no per-route page, despite `sani pass shuttle` / `drakensberg airport transfer` being high-intent queries.

### G18 · No ISR / revalidation
**Impact: low-medium · Effort: S · Risk: 🟢**

All detail routes render per request. With G1's server wrapper, `revalidate` would cut TTFB and Supabase load materially.

### G19 · Incomplete image alt coverage
**Impact: low-medium · Effort: S · Risk: 🟢**

Grid images have alt text; several hero/decorative images do not. No `alt` field on uploaded media.

- **Fix:** add `altText` to the `media` payload; surface it in the media manager.

### G20 · `site_content` whole-blob reads
**Impact: low now, high later · Effort: L · Risk: 🔴**

Trails, regions, reserves and towns each live in a **single JSONB row** holding all items. `getRegions()` fetches every region to return one. No per-row `updated_at` (so sitemap `lastModified` is approximate) and no per-row RLS.

- **Assessment: fine at current scale** (3 regions, ~8 reserves, ~10 towns, tens of trails), and `generateStaticParams` wants the whole list anyway.
- **Do not migrate now.** Revisit only past ~500 trails or when per-row permissions are genuinely needed. Flagged for awareness, explicitly **not** a recommended change — see `ARCHITECTURE_CHANGE_DECISION.md` §5.

---

## Explicitly NOT recommended

| Proposal | Verdict |
|---|---|
| Rename `/regions` → `/destinations` | **No.** 301s on the only fully-authored slug route for zero ranking gain. `regionsMatch()` already normalises naming. |
| Rename `/stays` → `/accommodation` | **No.** Live, indexed, shorter. |
| Migrate `site_content` → relational tables | **Not now.** G20 — no current limitation. |
| Room-level pages (`/stays/x/rooms/y`) | **No.** Thin, duplicative, cannibalises the property page. |
| Page per facet combination | **No.** Directly violates the brief's Principle 6. |
| AI-generated body content | **No.** Principle 7. Tool 13 plans structure only. |
| Visual force-directed graph (Tool 15 Phase 1) | **Defer.** Ship the text tree; a canvas would visualise an empty graph today. |
| General block composer (Tool 5) | **Defer.** Fixed entity templates are an asset; ship visibility toggles instead. |
| Itineraries content type | **Defer to Phase 4.** Real value, but dependent on the graph existing first. |
| Separate SEO microservice/app | **No.** Brief forbids it; the admin console is the right home. |
| Parallel SEO metadata table | **No.** Violates Principle 2. SEO fields belong on the entity payload. |

---

## Priority summary

| Rank | Gap | Impact | Effort | Risk |
|---|---|---|---|---|
| 1 | G1 per-entity metadata | critical | M | 🟢 |
| 2 | G2 dynamic sitemap | critical | S | 🟢 |
| 3 | G3 `/admin/seo` data loss | high | S | 🟢 |
| 4 | G4 reserve/town detail pages | high | S | 🟢 |
| 5 | G5 read region SEO fields | high | XS | 🟢 |
| 6 | G10 noindex utility pages | medium | XS | 🟢 |
| 7 | G6 entity structured data | high | M | 🟢 |
| 8 | G8 + G9 facet links & policy | med-high | M | 🟡 |
| 9 | G7 slug resolution | med-high | M | 🟡 |
| 10 | G12 breadcrumbs | medium | S | 🟢 |
| 11 | G11 `/stories` duplication | medium | XS | 🟡 |
| 12 | G14 relationship persistence | med-high | M | 🟢 |
| 13 | G15 crawlable recommendations | medium | S | 🟢 |
| 14 | G16 redirect manager | medium | M | 🟢 |
| 15 | G13 article entity | medium | M | 🟢 |
| 16 | G18 ISR | low-med | S | 🟢 |
| 17 | G19 image alt | low-med | S | 🟢 |
| 18 | G17 tours / shuttle routes | medium | M | 🟢 |
| — | G20 `site_content` scaling | deferred | L | 🔴 |

**Note the risk column: 14 of 18 actionable gaps are 🟢 additive.** Only three touch shared code, and none of the Tier 1 items change a live URL or migrate data.
