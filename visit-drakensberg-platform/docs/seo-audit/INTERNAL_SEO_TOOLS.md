# INTERNAL SEO TOOLS — specification

**Constraint honoured:** every tool below is built **inside the existing admin console** (`app/admin/*`), using the existing data layer (`lib/entities.ts`, `site_content`), the existing role guard (`requireRole('admin')`), and the existing design system. No separate SEO application. No new infrastructure.

**Storage decision.** Two rules, both derived from Principle 2 (*the database is the source of truth; no SEO-specific duplication*):

1. **Entity SEO fields live on the entity**, inside its existing JSONB payload. `Property.seoTitle` sits next to `Property.name`. No parallel SEO table, no join, no drift. Zero migrations — this is exactly how `Region`, `Reserve` and `Town` already work.
2. **Only genuinely global SEO artefacts get their own `site_content` keys:** `admin_redirects`, `admin_topic_map`, `admin_seo_settings`. These belong to no single entity.

**Rebuild note.** `app/admin/seo/page.tsx` currently persists nothing (`handleSave()` only toggles a flag; see `ARCHITECTURE_AUDIT.md` §7.1). Tool 1 replaces it. Until it does, the page should be labelled non-functional so nobody else loses work in it.

---

## TOOL 1 — Page SEO Panel

**Where:** a reusable `<SeoPanel entityKind entityId />` component, embedded as a tab in every existing admin/supplier editor — `/admin/regions`, `/admin/reserves`, `/admin/towns`, `/admin/trails`, `/supplier/properties/[id]/edit`, `/supplier/activities/[id]/edit`, `/supplier/tours/[id]/edit`, `/admin/packages`, `/supplier/guides/[id]/edit`.

**Not** a separate destination. Editing a lodge's SEO happens where the lodge is edited.

### Fields

| Field | Persisted key | Notes |
|---|---|---|
| SEO title | `seoTitle` | Live counter, 50–60 target, warn > 60 |
| Meta description | `seoDescription` | 120–160 target, warn > 160 |
| URL slug | `slug` | Live URL preview; immutability warning once published |
| Canonical override | `canonicalOverride` | Blank = self-canonical (the correct default) |
| Robots index | `robotsIndex` | Default `true`; permission-gated (Tool 10) |
| Robots follow | `robotsFollow` | Default `true`; permission-gated |
| OG title / description / image | `ogTitle`, `ogDescription`, `ogImage` | Fall back to `seoTitle`/`seoDescription`/first photo |
| Twitter title / description / image | `twitterTitle`, … | Fall back to OG |
| Focus topic | `focusTopic` | Feeds Tools 8, 9 |
| Secondary topics | `secondaryTopics[]` | Feeds Tool 8 |

### Previews

- **Google-style SERP preview** — a working version already exists at `app/admin/seo/page.tsx:143–150`. **Reuse this markup**; it is correct.
- **Social card preview** — OG image + title + description at real proportions.
- **URL preview** — full canonical, live-updating as the slug changes.
- **Fallback indicators** — when a field is empty, show the inherited value in grey, labelled `inherited`. Critical: the team must be able to see that a blank field is *safe*, not broken.

### Effort
**S** for the shared component. **XS** per editor to mount it. No migrations.

---

## TOOL 2 — Page SEO Health Score

**Where:** inside the SEO panel (per entity) plus a sortable column in Tool 15's index.

Diagnostic only. The UI must state: *"A local content-completeness diagnostic. Not a prediction of Google ranking."* This is a factual-accuracy requirement, not a disclaimer for its own sake.

### Checks

| Check | Weight | Pass condition |
|---|---|---|
| SEO title present | 10 | non-empty |
| Title length | 5 | 30–60 chars |
| Meta description present | 10 | non-empty |
| Description length | 5 | 120–160 chars |
| H1 present / single | 5 | derivable from entity name |
| Content depth | 10 | description ≥ N words (per-kind threshold) |
| Canonical resolvable | 10 | self or valid override |
| Indexable | 5 | `robotsIndex !== false` **and** in sitemap |
| Structured data emitted | 10 | schema type resolvable for kind |
| Featured image | 5 | non-empty |
| Image alt text | 5 | alt present on primary image |
| Incoming internal links | 10 | ≥ 1 (Tool 7) |
| Related entities | 5 | ≥ 1 graph edge |
| Breadcrumb parent | 5 | parent resolvable |

Grouped output as the brief specifies:

```
SEO Health   78/100

CRITICAL   Missing canonical
WARNING    Only one internal link
GOOD       Structured data detected
```

Every finding must be **actionable and specific** — name the missing field and link to it. Never emit a generic "improve your SEO".

### Effort
**M** — mostly pure functions over entity payloads. No new storage.

---

## TOOL 3 — Internal Link Suggestions

**Where:** SEO panel tab, per entity.

**Reuse what exists.** The suggestion engine should be built on the relationship logic already in the codebase, not a new one:

| Existing capability | File | Used for |
|---|---|---|
| `regionsMatch()` + `SUBREGION_ALIASES` | `lib/regions.ts:113` | same-region candidates |
| `haversineKm()` | `lib/stay-distance.tsx:15` | proximity candidates |
| `distanceKm()`, `buildDestinationRecommendations()` | `lib/destination-ia.ts` | destination-hub candidates |
| `Departure.trailId` / `tourId` / `operatorId` | `lib/experiences.ts` | commercial-relationship candidates |

Candidate ranking: explicit FK edge > same `regionSlug` > GPS proximity > shared topic.

**Human control is mandatory** (Principle: no bulk auto-linking). Each suggestion offers Accept / Reject / Ignore. Accepted links persist to `relatedTrailIds[]` etc. Rejected links persist to `rejectedSuggestionIds[]` so they never resurface. Bulk-accept is capped and always shows exactly what will be written.

### Effort
**M** — the graph traversal already exists; this is a UI plus persistence around it.

---

## TOOL 4 — Related Entities Manager

**Where:** SEO panel tab.

Grouped, searchable pickers per target kind, writing to the entity payload:

```
relatedTrailIds[]  relatedPropertyIds[]  relatedActivityIds[]
relatedTourIds[]   relatedArticleSlugs[] reserveSlug  townSlug  regionSlug
```

Requirements:
- **Bidirectional writes.** Linking Trail→Property writes the inverse on the Property. Without this, half the graph is invisible from one side.
- Derived edges (from `regionsMatch`/GPS) shown as `auto` chips — visible, promotable to explicit, but not silently persisted.
- Deleting an entity must clean up inbound references (or the graph accumulates dangling IDs).

### Effort
**M**. Zero migrations.

---

## TOOL 5 — Page Content Blocks

**Where:** extends the existing visual editor (`/admin/website`, `components/editor/*`, `lib/site-content.ts`).

An honest assessment: this is the **largest and least urgent** item in the brief. The existing editor already handles hero/promotions/footer/page-headers. Entity detail pages are currently **fixed templates** — and for a destination-commerce platform that is arguably correct: a consistent trail page is better for both users and search than 40 individually composed ones.

**Recommendation: do not build a general block composer in Phase 1–3.** Instead:

- **Phase 2:** make the *existing* fixed sections toggleable per entity (`sectionVisibility: { gallery: true, gpx: true, nearbyStays: false }`). Cheap, and covers the real need ("hide the GPX block on this trail").
- **Phase 4, only if demanded:** a constrained block list (Rich text, Gallery, FAQ, CTA, Comparison table, Related entities) with a fixed schema per block.

Blocks already rendered by existing components and needing **no new work**: Hero, Map, Trail statistics, Elevation profile (`RouteArtwork`), GPX download, Difficulty indicator, Booking inventory, Accommodation/Activity/Tour listings, Guide profiles, Reviews, Related destinations, Weather.

### Effort
**S** for visibility toggles. **L** for a real composer — deliberately deferred.

---

## TOOL 6 — Entity Context Panel

**Where:** header strip of the SEO panel. Read-only orientation.

```
ENTITY      Royal Natal National Park
TYPE        Reserve · Attraction
REGION      North Berg              → /regions/north-berg
CONNECTED   14 entities
INDEXABLE   YES
CANONICAL   /nature-reserves/royal-natal
IN SITEMAP  YES
HEALTH      82/100
```

High value per unit of effort — it answers "what am I editing and where does it sit" in one glance, and surfaces the indexable/canonical truth at the point of editing.

### Effort
**S** — composes Tools 2, 4, 10.

---

## TOOL 7 — Orphan Page Detector

**Where:** `/admin/seo/orphans`.

Builds the inbound-link graph from: explicit `related*Ids[]`, `regionSlug`/`reserveSlug`/`townSlug` parents, navigation links (`PRIMARY_NAVIGATION`, `DESTINATIONS`), and listing-page membership.

Report tiers:

| Tier | Condition |
|---|---|
| **Orphan** | 0 inbound links |
| **Near-orphan** | 1–2 inbound |
| **No parent** | no region/reserve/town parent |
| **No related entities** | 0 graph edges |

Each row offers suggested parents (from Tool 3) with one-click accept.

**Expected first run:** because explicit relationship fields do not exist yet, nearly every entity will report as an orphan on day one. This is accurate — the graph is currently derived at runtime, not stored. Tool 7 should count derived edges as *weak* inbound links so the first report is informative rather than uniformly red.

### Effort
**M**.

---

## TOOL 8 — Cannibalisation Detector

**Where:** `/admin/seo/overlap`.

Compares `focusTopic`, `seoTitle`, and entity names across indexable entities. Normalised token-overlap (Jaccard on stemmed tokens) is sufficient and explainable — no ML needed.

```
POTENTIAL SEARCH INTENT OVERLAP        confidence 0.82

/hikes/drakensberg-hiking              focus: "drakensberg hiking"
/mydrakensberg/hiking-in-drakensberg   focus: "hiking in drakensberg"
/plan                                  focus: "drakensberg hikes"

Recommendations: Consolidate · Differentiate · Redirect · Set canonical · Keep separate
```

**Never merges or redirects automatically.** Selecting "Redirect" or "Set canonical" pre-fills Tool 11 / the canonical field for human confirmation.

Known live case to surface immediately: **`/stories` vs `/mydrakensberg`**.

### Effort
**M**.

---

## TOOL 9 — Keyword / Topic Map

**Where:** `/admin/seo/topics`. Stored at `site_content` key `admin_topic_map` — this is genuinely global, not per-entity.

```
{ items: [{ id, topic, canonicalEntity: {kind, id}, supportingEntities: [{kind,id}], notes, updatedAt }] }
```

```
TOPIC        Tugela Falls
CANONICAL    /nature-reserves/tugela-falls
SUPPORTING   /hikes/tugela-falls
             /regions/north-berg
             /stays?region=north-berg
             /mydrakensberg/tugela-falls-chain-ladder-guide
```

Enforces one canonical target per topic — the structural defence against cannibalisation. Feeds Tool 8 (a second entity claiming a mapped topic is flagged) and Tool 13.

### Effort
**M**.

---

## TOOL 10 — Page Indexation Control

**Where:** SEO panel, permission-gated.

```
[ ] INDEX / NOINDEX          [ ] FOLLOW / NOFOLLOW
CANONICAL  <resolved value>
SITEMAP    included / excluded  (derived, read-only)
```

Non-negotiable requirements:

1. **`admin` role only.** Suppliers must not be able to `noindex` their own listing, nor `index` something the platform excludes. Enforce with `requireRole('admin')` server-side — not just hidden UI.
2. **Sitemap membership is derived, never independently editable.** It reads `robotsIndex && status===published && slug-or-id`. A checkbox that could contradict the meta robots tag would make the system lie.
3. **Audit trail** — `{ changedBy, changedAt, previousValue }` on every indexation change. This setting can remove a page from Google; it needs history.
4. **Confirmation** on setting `noindex` on a page with traffic or inbound links.

### Effort
**S** — but the permission boundary must be exactly right.

---

## TOOL 11 — Redirect Manager

**Where:** `/admin/seo/redirects`. Stored at `site_content` key `admin_redirects`.

```
{ items: [{ id, from, to, statusCode: 301|302, createdAt, createdBy, hitCount, lastHitAt }] }
```

Served by the **existing `middleware.ts`** (already in the build at 224 kB) — DB-driven, so admins add redirects without a deploy.

Validation, all enforced server-side:

- **No chains.** If `B→C` exists and someone adds `A→B`, write `A→C` and say so.
- **No loops.** Reject `A→B` where `B→A` resolves back.
- **No shadowing live routes.** `from` must not match an existing indexable path.
- **Prefer 301.** 302 requires an explicit reason.
- Warn when `to` is itself `noindex` or 404.

Prerequisite for slug migration hardening (`URL_ARCHITECTURE.md` §4) and for Tool 8's consolidation action.

### Effort
**M** including middleware integration.

---

## TOOL 12 — Sitemap Control

**Where:** `/admin/seo/sitemap`. Read-only monitor over the generated sitemap.

```
TOTAL URLS          1,247
INDEXABLE           1,190
EXCLUDED (noindex)     57
ORPHANS                23
NO CANONICAL            0
CHANGED (7 days)       41
BY TYPE   regions 3 · reserves 8 · towns 11 · trails 214 · stays 486 …
```

Must include a **consistency check** that fails loudly if a non-canonical or `noindex` URL ever reaches the sitemap. That check is what makes Tools 10 and 12 trustworthy rather than decorative.

Also: "last fetched by Google" is **not available** without Search Console integration. Do not fake it. Either integrate GSC properly (Phase 4) or omit the field.

### Effort
**S** once the dynamic sitemap (Phase 1) exists.

---

## TOOL 13 — Content Brief Generator

**Where:** `/admin/seo/briefs`, and offered when creating a new entity.

A **planning** tool. Assembles from real platform data — entity kind, region, topic map, graph neighbours, existing coverage:

```
PAGE TYPE        Reserve detail
TARGET ENTITY    Cathedral Peak
PRIMARY TOPIC    cathedral peak drakensberg     (from Tool 9)
SEARCH INTENT    Informational + commercial
RELATED          Central Berg · 6 trails · 12 stays · 3 operators
REQUIRED         Overview · Getting there · Permits · Best time ·
                 Trails · Accommodation · Guided options · Safety
LINK SUGGESTIONS (Tool 3 output)
FAQ OPPORTUNITIES (from existing content gaps)
SCHEMA TYPE      TouristAttraction

Suggested title       Cathedral Peak, Central Drakensberg — Hikes, Permits & Stays
Suggested H1          Cathedral Peak
Suggested description …
```

**Hard constraint (Principle 7):** suggests structure, titles and descriptions — **never generates body content**. No AI-written prose is inserted anywhere. Suggested titles/descriptions land in editable fields marked `suggested`, requiring human acceptance.

### Effort
**M**.

---

## TOOL 14 — Page Quality Checklist

**Where:** publish-time gate in the SEO panel; also as a pre-publish modal.

Exactly the brief's four groups — Content / SEO / Discovery / Commercial / Media. Auto-tick what is machine-verifiable (SEO title, canonical, indexable, structured data, featured image, alt text, parent entity, related entities, inventory present, booking CTA); leave genuinely editorial items (accurate facts, unique content, useful introduction) as human attestations.

Advisory, not blocking — except that **`noindex` + "publish"** should require explicit confirmation, since it is almost always a mistake.

### Effort
**S** — largely a re-presentation of Tool 2.

---

## TOOL 15 — Page Relationship Visualiser

**Where:** `/admin/seo/graph`.

**Phase 1 — text tree (ship this).** Cheap, immediately useful, no dependencies:

```
ROYAL NATAL NATIONAL PARK  (Reserve)
├── Region: North Berg
├── Trails (4)
│   ├── Tugela Falls Circuit
│   └── Amphitheatre via Chain Ladder
├── Accommodation nearby (12)
├── Operators (3) → Guides (7)
├── Shuttle routes (2)
└── Articles (1)
```

**Phase 4 — visual graph, only if the tree proves insufficient.** A force-directed canvas needs a new dependency and earns its place only once the graph is actually dense. Building it before relationships exist would visualise an empty graph.

Pair the tree with a **sortable entity index** (kind, slug, health, indexable, inbound links, last updated) — for day-to-day work that table is more useful than any diagram.

### Effort
**S** for tree + index. **L** for visual graph — deferred.

---

## PART 15 — SEO Admin Dashboard

**Where:** `/admin/seo` (replacing the current mockup).

```
┌── PAGES ─────────────────────────────────────────────┐
│ Total indexable      1,190                            │
│ Noindex                 57                            │
│ Orphans                 23   ⚠                        │
│ Missing SEO title      312   ⚠                        │
│ Missing description    408   ⚠                        │
│ Missing canonical        0   ✓                        │
│ Potential duplicates     4   ⚠                        │
├── CONTENT ───────────────────────────────────────────┤
│ Published 1,190 · Draft 84 · Needs review 12          │
│ Missing relationships  231                            │
├── ENTITIES ──────────────────────────────────────────┤
│ Regions 3 · Reserves 8 · Towns 11 · Trails 214        │
│ Stays 486 · Activities 178 · Tours 42 · Guides 37     │
│ Packages 24 · Shuttle routes 16                       │
├── OPPORTUNITIES ─────────────────────────────────────┤
│ No internal links        23  → Tool 7                 │
│ Low relationship density 96  → Tool 4                 │
│ Thin content            141  → Tool 13                │
│ Cannibalisation risk      4  → Tool 8                 │
│ Missing destination pages 2  → reserves/towns detail   │
└───────────────────────────────────────────────────────┘
```

Every number links to a filtered worklist. A dashboard that reports problems without routing to the fix is decoration.

### Effort
**M** — aggregation over Tools 2, 7, 8, 12.

---

## Build sequence and dependencies

```
Phase 1  Tool 1 (panel) ─┬─> Tool 6 (context)
         Tool 10 (index) ─┘
         Tool 12 (sitemap monitor)   [needs dynamic sitemap]

Phase 2  Tool 2 (health) ──> Tool 14 (checklist)
         Tool 4 (relations) ─> Tool 7 (orphans)
         Tool 3 (suggestions)
         Tool 15 (tree + index)

Phase 3  Tool 9 (topic map) ──> Tool 8 (cannibalisation)
         Tool 11 (redirects)
         Tool 13 (briefs)
         Dashboard

Phase 4  Tool 5 (block composer)      — only if demanded
         Tool 15 visual graph         — only if the tree is insufficient
         Search Console integration   — for real index data
```

**Tool 1 is the keystone.** Nothing else is meaningful until SEO fields persist and are read by `generateMetadata`. Build it first, and build it on the entity payload.

---

## What these tools must not do

- **Not** write body content with AI (Principle 7). Tool 13 suggests structure and metadata only.
- **Not** bulk-create internal links without per-link human approval (Tool 3).
- **Not** auto-merge or auto-redirect cannibalised pages (Tool 8).
- **Not** let suppliers control indexation (Tool 10).
- **Not** allow non-canonical or `noindex` URLs into the sitemap (Tool 12).
- **Not** duplicate business data into an SEO-only store (Principle 2) — SEO fields live on the entity.
- **Not** report metrics they cannot actually measure. No fabricated "Google last crawled" without Search Console.
