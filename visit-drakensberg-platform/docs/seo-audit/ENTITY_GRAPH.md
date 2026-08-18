# ENTITY GRAPH — current and required

Only relationships that **actually exist in the codebase** are documented as current. Proposed additions are clearly separated.

---

## 1. Entity inventory

### 1.1 Editorial / destination entities — `site_content` (key → JSONB blob)

| Entity | Key | Slug | SEO fields | Relationship fields present |
|---|---|---|---|---|
| `Region` | `admin_regions` | ✅ `slug` | ✅ `seoTitle`, `seoDescription` | `subregions[]`, `keyAttractions[]`, `highlights[]` |
| `Reserve` | `admin_reserves` | ✅ `slug` | ✅ `seoTitle`, `seoDescription` | **`regionSlug` → Region** ✅, `peaks[]` |
| `Town` | `admin_towns` | ✅ `slug` | ✅ `seoTitle`, `seoDescription` | region association |
| `Trail` | `trails` | ⚠️ `slug?` unused | ❌ | `region` (free text), GPS start, `analytics`, `speciality_type` |

### 1.2 Commercial entities — `vd_entities` (row-per-item, `kind` discriminator)

| Entity | `kind` | ID prefix | Slug | SEO | Relationship fields present |
|---|---|---|---|---|---|
| `Property` | `property` | `prop-` | ❌ | ❌ | `region`, `address`, GPS, `supplierId` → owner |
| `Room` | `room` | `room-` | ❌ | ❌ | **`propertyId` → Property** ✅ |
| `Activity` | `activity` | `act-` | ❌ | ❌ | `region`, `gpsLat/Lng`, `meetingPoint`, **`supplierId`** ✅ |
| `Tour` | `tour` | `tour-` | ❌ | ❌ | `supplierId`, trail association |
| `Departure` | `departure` | `dep-` | ❌ | ❌ | **`tourId` → Tour** ✅, **`trailId` → Trail** ✅, `operatorId` ✅ |
| `Package` | `package` | `pkg-` | ❌ | ❌ | component references, `supplierId` |
| `Operator/Guide` | `operator_profile` | — | ❌ | ❌ | `supplierId`, verified-guide data |
| `Media` | `media` | `media-` | — | — | `supplierId` |

### 1.3 Transactional entities (correctly non-indexable)

`booking` / `order` · `invoice` · `quote` · `vd_message_threads` · `vd_notifications` · `review` · availability · `vehicle` · `driver` · transport `route`

These must remain `noindex` and outside the sitemap. No action required — `robots.ts` already blocks their surfaces.

### 1.4 Derived (not stored) entities

**`TrekkingExperience`** (`lib/experiences.ts`) is a **composite projection**, not a table: `Departure` + `Tour` + `Trail` + `Operator` flattened into one object carrying `trailId`, `trailName`, `tourId`, `operatorId`, `region`, `gpsLat/Lng`, pricing and availability.

This is significant: it proves the codebase **already performs multi-entity graph joins across both storage patterns**. The graph traversal capability is demonstrated, not hypothetical.

---

## 2. Current entity relationship diagram

Only edges backed by real fields. `✅` = explicit FK-style field. `≈` = derived at runtime.

```
                              ┌─────────────┐
                              │   REGION    │  slug ✅  seoTitle ✅
                              │ (3 records) │
                              └──────┬──────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │ regionSlug ✅        │ region ≈             │ region ≈
              ▼                      ▼                      ▼
      ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
      │   RESERVE    │       │    TRAIL     │       │   PROPERTY   │
      │ slug ✅ SEO ✅│       │ slug? unused │       │ prop-<uuid>  │
      │ NO PAGE ❌   │       │ GPS start    │       │ GPS ✅        │
      └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
             │ peaks[]              │ trailId ✅            │ propertyId ✅
             ▼                      ▼                      ▼
      ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
      │  PEAK        │       │  DEPARTURE   │       │    ROOM      │
      │ (nested,     │       │  dep-<uuid>  │       │  room-<uuid> │
      │  not addressable)    │              │       │              │
      └──────────────┘       └──┬────────┬──┘       └──────────────┘
                                │ tourId │ operatorId
                                │   ✅    │    ✅
                                ▼        ▼
                        ┌──────────┐  ┌──────────────────┐
                        │   TOUR   │  │ OPERATOR_PROFILE │
                        │ NO PUBLIC│  │  /guides/[id]    │
                        │ LISTING ❌│  │                  │
                        └────┬─────┘  └────────┬─────────┘
                             │ supplierId ✅   │ supplierId ✅
                             └────────┬────────┘
                                      ▼
                              ┌───────────────┐
                              │   SUPPLIER    │
                              │ (auth user)   │
                              └───────┬───────┘
                                      │ supplierId ✅
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │   ACTIVITY   │  │   PACKAGE    │  │    MEDIA     │
            │  act-<uuid>  │  │  pkg-<uuid>  │  │              │
            │  GPS ✅       │  │              │  │              │
            └──────────────┘  └──────────────┘  └──────────────┘

      ┌──────────────┐                  ┌──────────────────────┐
      │     TOWN     │                  │ TREKKING_EXPERIENCE  │
      │ slug ✅ SEO ✅│                  │  (derived composite) │
      │ NO PAGE ❌   │                  │  Departure+Tour+     │
      └──────────────┘                  │  Trail+Operator      │
                                        │  /experiences/[id]   │
      ┌──────────────┐                  └──────────────────────┘
      │   ARTICLE    │
      │ HARDCODED in │
      │ page.tsx ❌   │  ← no entity, no DB record, no relationships
      └──────────────┘
```

### 2.1 Edges that exist explicitly (FK-style fields)

```
Reserve      --regionSlug-->  Region
Room         --propertyId-->  Property
Departure    --tourId----->   Tour
Departure    --trailId---->   Trail
Departure    --operatorId->   OperatorProfile
Tour         --supplierId->   Supplier
Activity     --supplierId->   Supplier
Property     --supplierId->   Supplier
Package      --supplierId->   Supplier
```

### 2.2 Edges derived at runtime (no stored field)

```
Trail     ≈region≈   Region      via regionsMatch() + SUBREGION_ALIASES
Property  ≈region≈   Region      via regionsMatch()
Activity  ≈region≈   Region      via regionsMatch()
Trail     ≈GPS≈      Property    via haversineKm() / Google Distance Matrix
Activity  ≈GPS≈      Property    via haversineKm()
```

`regionsMatch()` (`lib/regions.ts:113`) plus `SUBREGION_ALIASES` resolves 16 park/subregion names to parent regions — e.g. `royal natal national park` → `north berg`, `cathedral peak` → `central berg`, `sani pass` → `south berg`. This is a genuine graph-normalisation layer and it works.

### 2.3 Missing edges (no field, no derivation)

```
Trail        --X-->  Reserve            (which reserve contains this trail?)
Trail        --X-->  Town               (nearest town / gateway)
Property     --X-->  Reserve / Town
Activity     --X-->  Trail              (activity performed on a trail)
Reserve      --X-->  Trail              (reserve's trail set)
Town         --X-->  anything
Package      --X-->  component entities (structured, not text)
Any entity   --X-->  Article
Any entity   --X-->  ShuttleRoute
Trail        --X-->  Trail              (related / alternative trails)
Region       --X-->  Region             (adjacent regions)
```

---

## 3. Required target graph

The brief's desired chain:

```
DESTINATION → TRAIL/ATTRACTION → ACTIVITY/TOUR → SUPPLIER → GUIDE
            → ACCOMMODATION → SHUTTLE → PACKAGE → ITINERARY → BOOKING
```

Mapped against reality:

| Link in chain | Status | Action |
|---|---|---|
| Destination → Trail | ≈ derived | Persist `regionSlug` on Trail (belt-and-braces alongside `regionsMatch`) |
| Destination → Attraction | ✅ `Reserve.regionSlug` | **Just needs a page** |
| Trail → Activity | ❌ missing | Add `trailIds[]` to Activity (optional) |
| Trail → Tour | ✅ via `Departure.trailId` | Expose as crawlable links |
| Tour → Supplier | ✅ `supplierId` | Expose |
| Supplier → Guide | ✅ `operator_profile` | Expose |
| Destination → Accommodation | ≈ derived | Persist `regionSlug` on Property |
| Trail → Accommodation | ≈ GPS | Already computed in `SmartRecommendations`; make crawlable |
| Anything → Shuttle | ❌ missing | Needs shuttle route entity + slug |
| Package → components | ⚠️ weak | Structure the references |
| Itinerary | ❌ absent | New content type (Phase 4) |
| Booking | ✅ complete | Correctly non-indexable |

### 3.1 Recommended minimal graph extension

Because both stores are JSONB, **all of the following require zero migrations** — add keys to `value` and read them back:

```ts
// Add to every indexable entity's payload (Trail, Property, Activity,
// Package, Tour, OperatorProfile) — mirrors the shape already proven
// on Region / Reserve / Town.
{
  slug?: string                 // human-readable URL; ID remains canonical fallback
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  robotsIndex?: boolean         // default true
  robotsFollow?: boolean        // default true
  canonicalOverride?: string

  // Explicit graph edges — admin-curated, additive to derived edges
  regionSlug?: string           // canonical parent destination
  reserveSlug?: string          // containing reserve, where applicable
  townSlug?: string             // gateway town
  relatedTrailIds?: string[]
  relatedPropertyIds?: string[]
  relatedActivityIds?: string[]
  relatedArticleSlugs?: string[]
}
```

Rationale for `regionSlug` alongside existing `region` free text: `regionsMatch()` is a good fuzzy fallback but a stored canonical slug makes the graph deterministic, indexable and admin-correctable. **Keep `regionsMatch()`** — it handles legacy and free-text data. The new field is a fast path, not a replacement.

### 3.2 Article entity

Stories are currently **hardcoded inside `app/mydrakensberg/[slug]/page.tsx`**, duplicated by hand into `app/sitemap.ts` (6 slugs). To participate in the graph they need to become records with `slug`, `seoTitle`, `seoDescription`, and `relatedEntityIds[]`. `/admin/blog` already exists as a surface. This is a **content-model addition**, Phase 3 — not urgent, but it removes an active drift risk between the page file and the sitemap.

---

## 4. Target graph diagram (after minimal extension)

```
                         ┌──────────────────┐
                         │     REGION       │  /regions/[slug]
                         │  (destination)   │  ✅ page exists
                         └────────┬─────────┘
                                  │ regionSlug (stored)
        ┌─────────────┬───────────┼───────────┬─────────────┐
        ▼             ▼           ▼           ▼             ▼
   ┌─────────┐  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
   │ RESERVE │  │   TOWN   │ │ TRAIL  │ │ PROPERTY │ │ ACTIVITY  │
   │ NEW PAGE│  │ NEW PAGE │ │ slug   │ │ slug     │ │ slug      │
   └────┬────┘  └────┬─────┘ └───┬────┘ └────┬─────┘ └─────┬─────┘
        │            │           │           │             │
        └────────────┴─────┬─────┴───────────┴─────────────┘
                           │  relatedTrailIds / relatedPropertyIds
                           │  relatedActivityIds  (curated, bidirectional)
                           ▼
                  ┌─────────────────┐
                  │  DEPARTURE /    │  /experiences/[id]
                  │  TOUR           │  + NEW /tours/[slug]
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │ OPERATOR/GUIDE  │  /guides/[slug]
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │    SUPPLIER     │
                  └─────────────────┘

   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │ SHUTTLE_ROUTE│   │   PACKAGE    │   │   ARTICLE    │
   │ NEW (Ph.3)   │   │ slug (Ph.2)  │   │ entity (Ph.3)│
   └──────────────┘   └──────────────┘   └──────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   ITINERARY     │  NEW (Phase 4)
                  └─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    BOOKING      │  noindex — correct today
                  └─────────────────┘
```

---

## 5. Assessment against the ten per-entity questions (Part 5)

| # | Question | Region | Reserve | Town | Trail | Property | Activity | Package | Tour | Guide |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Exists? | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Stable ID? | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Public slug? | ✅ | ✅ | ✅ | ⚠️ opt | ❌ | ❌ | ❌ | ❌ | ❌ |
| 4 | Canonical URL possible? | ✅ | ➕ needs page | ➕ needs page | ✅ | ✅ | ✅ | ✅ | ➕ | ✅ |
| 5 | Linked to destination? | — | ✅ stored | ⚠️ | ≈ derived | ≈ derived | ≈ derived | ❌ | ❌ | ❌ |
| 6 | Linked to other entities? | ⚠️ | ✅ peaks | ❌ | ✅ departures | ✅ rooms | ❌ | ⚠️ | ✅ | ✅ |
| 7 | Can hold SEO metadata? | ✅ **has** | ✅ **has** | ✅ **has** | ➕ trivial | ➕ trivial | ➕ trivial | ➕ trivial | ➕ | ➕ |
| 8 | Structured content? | ✅ | ✅ rich | ✅ | ✅ rich | ✅ rich | ✅ rich | ✅ | ✅ | ✅ |
| 9 | Independently indexable? | ⚠️ page exists, no metadata | ❌ no page | ❌ no page | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| 10 | Participates in internal linking? | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |

**Legend:** ✅ yes · ⚠️ partial · ❌ no · ➕ trivial to add (JSONB, no migration) · ≈ runtime-derived

### Reading of the table

Row 7 is the decisive one: **every entity can hold SEO metadata today** because both stores are JSONB, and three entities already do. There is no schema obstacle anywhere in the graph.

Row 9 is where the value is being lost: almost nothing is *independently indexable*, and the two entities with the richest ready-made SEO content (Reserve, Town) have no page at all.
