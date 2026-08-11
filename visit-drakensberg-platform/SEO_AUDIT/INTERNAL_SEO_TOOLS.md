# Visit Drakensberg — Internal SEO Tools Specification
*What can be built within the existing admin architecture*

---

## Guiding Principle

Every tool described here should be integrated into the **existing `/admin/*` environment**. No separate SEO application. The admin layout, authentication, and design system are already in place. These are additions to existing admin pages and one new consolidated SEO panel.

---

## TOOL 1 — Entity SEO Panel

**Location**: Extend existing admin forms (trails, regions, properties, activities, packages) with a collapsible SEO section.

**Implementation**: Add a reusable `<SeoPanel>` component that accepts an entity's current SEO metadata and an `onChange` callback. Embed it in:
- `/admin/trails` (the trail editor form)
- `/admin/regions` (already has seoTitle/seoDescription — extend with remaining fields)
- `/admin/packages` (the package builder)

**Database change required**: Add SEO fields to `vd_entities.value` JSONB. No migration needed — JSONB accepts new keys transparently.

### Fields

```typescript
type EntitySeoMetadata = {
  seoTitle?: string            // 50–60 chars ideal
  seoDescription?: string      // 120–160 chars ideal
  seoSlug?: string             // canonical URL segment
  canonical?: string           // full canonical URL
  robotsIndex?: boolean        // default true
  robotsFollow?: boolean       // default true
  ogTitle?: string             // fallback to seoTitle
  ogDescription?: string       // fallback to seoDescription
  ogImage?: string             // URL or Supabase storage path
  twitterTitle?: string        // fallback to ogTitle
  twitterDescription?: string  // fallback to ogDescription
  twitterImage?: string        // fallback to ogImage
  focusTopic?: string          // primary keyword/topic
  secondaryTopics?: string[]   // supporting keywords
}
```

### Display Features
- Character counter on seoTitle (50–60 green, else orange/red)
- Character counter on seoDescription (120–160 green, else orange/red)
- Live Google SERP preview (title in blue, URL in green, description in grey)
- Live social card preview (OG image + title + description)

### Architecture fit
This is a **JSONB extension** to existing entity records. The existing `updateEntity` function handles arbitrary key/value patches. No schema migration. The SEO fields live in `value` alongside all other entity data.

---

## TOOL 2 — Page SEO Health Score

**Location**: Right panel on each entity edit page in admin. Also aggregated on a new `/admin/seo` dashboard (replacing the current non-functional shell).

**Implementation**: A pure computation function that reads an entity object and returns a score + diagnostic list.

```typescript
type SeoHealthResult = {
  score: number           // 0–100
  critical: string[]      // blocks indexing or causes penalties
  warnings: string[]      // degrades ranking potential
  good: string[]          // confirmed present
}

function computeSeoHealth(entity: EntityWithSeo): SeoHealthResult {
  const checks = [
    { weight: 15, test: !!entity.seoTitle, critical: 'Missing SEO title', good: 'SEO title present' },
    { weight: 10, test: entity.seoTitle?.length >= 30 && entity.seoTitle?.length <= 60, warn: 'SEO title outside 30–60 chars' },
    { weight: 15, test: !!entity.seoDescription, critical: 'Missing meta description' },
    { weight: 10, test: entity.seoDescription?.length >= 100 && entity.seoDescription?.length <= 160, warn: 'Meta description outside 100–160 chars' },
    { weight: 10, test: !!entity.seoSlug, critical: 'No URL slug — cannot generate canonical URL' },
    { weight: 5,  test: entity.robotsIndex !== false, warn: 'Page set to noindex' },
    { weight: 10, test: !!entity.image || !!entity.ogImage, warn: 'No featured image or OG image' },
    { weight: 5,  test: !!entity.ogTitle, warn: 'No Open Graph title' },
    { weight: 5,  test: !!entity.description && entity.description.length > 100, warn: 'Content too short' },
    { weight: 5,  test: !!entity.region, warn: 'No region assigned — cannot generate internal links' },
    { weight: 5,  test: !!entity.focusTopic, warn: 'No focus topic set' },
    { weight: 5,  test: entity.status === 'active' || entity.status === 'published', warn: 'Entity not published' },
  ]
  // ... aggregate
}
```

**Displayed as**: Colour-coded score badge (0–49 red, 50–74 amber, 75–100 green) + expandable diagnostic list.

**Architecture fit**: Zero database changes. Pure front-end computation on existing entity data.

---

## TOOL 3 — Internal Link Suggestions

**Location**: New tab or section within each entity editor. Also surfaced in the `/admin/seo` dashboard.

**Implementation**: A suggestion engine that queries existing entities to find topically related pages.

```typescript
async function getSuggestedLinks(entity: Trail | Property | Activity): Promise<LinkSuggestion[]> {
  const suggestions: LinkSuggestion[] = []
  
  // Same region entities
  if (entity.region) {
    const regionTrails = await getTrailsByRegion(entity.region)
    const regionProperties = await getPropertiesByRegion(entity.region)
    const regionActivities = await getActivitiesByRegion(entity.region)
    // rank by relevance
  }
  
  // Name-based fuzzy match (lib/fuzzy.ts already exists)
  // Topic overlap (focusTopic field)
  
  return suggestions
}
```

**UI**: Each suggestion shows page title + URL + reason for suggestion. Admin can Accept (adds to entity's `internalLinks[]` field) or Reject.

**Architecture fit**: `lib/fuzzy.ts` already exists for fuzzy matching. This is a new UI layer on top of existing entity queries. The accepted links are stored in `vd_entities.value.internalLinks` — no migration needed.

---

## TOOL 4 — Related Entity Manager

**Location**: New section within each entity editor, below the main fields.

**Implementation**: A relationship picker that stores relationships in `vd_entities.value.relatedEntities`.

```typescript
type EntityRelationship = {
  kind: 'trail' | 'property' | 'activity' | 'guide' | 'tour' | 'package' | 'article' | 'region'
  id: string
  title: string            // denormalised for display
  addedAt: string
}
```

**UI**: Grouped by entity type. Each group shows existing relationships with a remove button, plus a search/add field that queries `vd_entities` by kind and fuzzy name match.

**Displayed on public pages**: The related entities list feeds the "Related Trails", "Nearby Accommodation", "Activities Nearby" sections that currently show only same-region items.

**Architecture fit**: New field in `vd_entities.value`. No migration. Query pattern reuses existing `listEntities` + `lib/fuzzy.ts`.

---

## TOOL 5 — Page Content Blocks

**Location**: Extend the existing `/admin/editor` system which already supports EditableSection/Editable/EditableCard blocks on the homepage.

**Current state**: The visual editor (`lib/editor-schema.ts`) already defines a block-based content system. It currently covers homepage sections only.

**Extension required**: Apply the same system to entity pages (trail, property, activity, destination).

### Available Block Types (extend editor schema)

```typescript
const ENTITY_BLOCKS = [
  'hero',              // already exists
  'introduction',      // already exists (EditablePageHeader)
  'rich_text',         // plaintext today; extend to markdown
  'image_gallery',     // gallery[] array on entity
  'trail_stats',       // distance/elevation/duration — already on trail pages
  'elevation_profile', // static SVG today; GPX-driven
  'gpx_download',      // gpx.raw exists on trails
  'booking_inventory', // UpcomingDepartures component — already on trail pages
  'accommodation_nearby', // NEW — query region properties
  'activity_listings', // NEW — query region activities
  'guide_profiles',    // NEW — query region operator profiles
  'reviews',           // when reviews are wired to DB
  'faq',               // NEW — accordion block
  'related_entities',  // Tool 4 above
  'cta',               // already present ad-hoc
  'weather',           // external widget integration
  'safety_info',       // what_to_bring array — already exists
]
```

**Architecture fit**: The editor schema pattern is already established. Extending it to entity pages requires:
1. Adding entity page definitions to `EDITOR_PAGES` in `editor-schema.ts`
2. Wrapping entity page sections in `<EditableSection>` and `<Editable>` components (already used on homepage)
3. Routing the visual editor to handle entity page IDs

---

## TOOL 6 — Entity Context Panel

**Location**: Right-hand sidebar in admin when editing any entity.

**Implementation**: A fixed panel that shows:

```
ENTITY: Tugela Falls Circuit
TYPE: Trail (Multi-Day Hike)
REGION: Royal Natal National Park
STATUS: Published
CANONICAL: /hikes/tugela-falls
SEO SCORE: 72/100
RELATIONSHIPS: 3 linked entities
INCOMING LINKS: 0 (ORPHAN)
IN SITEMAP: NO — add slug first
```

**Architecture fit**: Reads from entity's own `value` field. Zero additional queries. Pure UI component.

---

## TOOL 7 — Orphan Page Detector

**Location**: New tab on `/admin/seo` dashboard.

**Implementation**: Query all entities with `status = 'active'/'published'`, then cross-reference their IDs against `relatedEntities[]` arrays of all other entities to find those with zero incoming references.

```typescript
async function findOrphanEntities(): Promise<OrphanReport[]> {
  const all = await supabase.from('vd_entities').select('id, kind, value').in('status', ['active', 'published'])
  const referenced = new Set<string>()
  
  for (const entity of all) {
    const links = entity.value?.relatedEntities as EntityRelationship[] || []
    const internalLinks = entity.value?.internalLinks as LinkSuggestion[] || []
    links.forEach(l => referenced.add(l.id))
    internalLinks.forEach(l => referenced.add(l.targetId))
  }
  
  return all
    .filter(e => !referenced.has(e.id))
    .map(e => ({
      id: e.id,
      kind: e.kind,
      title: e.value?.name || e.value?.title || e.id,
      region: e.value?.region,
      suggestedParents: // fuzzy match against regions + same-category entities
    }))
}
```

**Architecture fit**: Pure read queries on existing `vd_entities` table. No new tables. The suggested parents use `lib/fuzzy.ts` already in the codebase.

---

## TOOL 8 — Cannibalization Detector

**Location**: Second tab on `/admin/seo` dashboard.

**Implementation**: Compare `focusTopic` fields and `seoTitle` text across all published entities using fuzzy matching.

```typescript
async function findCannibalGroups(): Promise<CannibalGroup[]> {
  const all = await supabase.from('vd_entities').select('id, kind, value').in('status', ['active', 'published'])
  
  // Group by focusTopic exact match
  // Then fuzzy-match seoTitle/name across groups
  // Return clusters with overlap > threshold
}
```

**UI**: Shows each detected cluster. Admin can:
- Mark one as canonical (sets `canonicalOf: [id1, id2]` on the chosen page)
- Add to redirect queue (redirect manager — Tool 11)
- Mark as "intentionally separate" (suppresses alert)
- Leave for review

**Architecture fit**: Same pattern as orphan detector. The `focusTopic` field (from Tool 1) powers this.

---

## TOOL 9 — Keyword / Topic Map

**Location**: Third tab on `/admin/seo` dashboard.

**Implementation**: Group all entities by `focusTopic`. For each topic, identify the canonical page and supporting pages.

**Display**:
```
TOPIC: Tugela Falls
  Canonical: /hikes/tugela-falls  [Trail]
  Supporting:
    /regions/north-berg (mentions Tugela Falls in content)
    /mydrakensberg/tugela-falls-chain-ladder-guide [Article]
    /guides/northern-berg-guides (operates at this trail)
    /stays/royal-natal-lodge (near this trail)
  Conflict: None
  
TOPIC: Drakensberg Accommodation
  Canonical: /stays
  Supporting:
    /regions/north-berg, /regions/central-berg, /regions/south-berg
    /packages/drakensberg-lodge-hike-package
  Conflict: /stays vs /stays/self-catering (same intent?)
```

**Architecture fit**: Computed from `focusTopic` fields stored in entity `value` JSONB. The "supporting" detection uses region + relatedEntities cross-reference. All reads against existing tables.

---

## TOOL 10 — Page Indexation Control

**Location**: Embedded in each entity's SEO panel (Tool 1) + the orphan detector.

**Fields**:
- `robotsIndex: boolean` (default: `true`)
- `robotsFollow: boolean` (default: `true`)
- `includeInSitemap: boolean` (default: derived from status)

**Architecture fit**: Stored in `vd_entities.value`. When the page is rendered, `generateMetadata` reads these fields and sets the `robots` metadata accordingly. No database migration.

**Permission gate**: Only `admin` role should be able to set `robotsIndex: false` on a live entity.

---

## TOOL 11 — Redirect Manager

**Location**: New page at `/admin/seo/redirects`.

**Database**: New Supabase table (this IS a small architectural addition):

```sql
create table vd_redirects (
  id          text primary key default gen_random_uuid()::text,
  from_path   text not null unique,    -- e.g. /stays/prop-old-id
  to_path     text not null,           -- e.g. /stays/royal-natal-lodge
  status_code smallint not null default 301,
  reason      text,                    -- human note
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
```

**Consumed by**: Next.js `next.config.js` `redirects()` function — but for dynamic redirects, a middleware approach is needed. The redirect table is read in `middleware.ts`:

```typescript
// middleware.ts — add redirect lookup
const redirect = await supabase.from('vd_redirects').select('to_path, status_code').eq('from_path', pathname).maybeSingle()
if (redirect.data) {
  return NextResponse.redirect(new URL(redirect.data.to_path, request.url), redirect.data.status_code)
}
```

**Architecture fit**: One new table, one middleware addition. Justified by the slug migration requirement — every property that gets a new slug URL needs a redirect from the old UUID URL.

---

## TOOL 12 — Sitemap Control

**Location**: Fourth tab on `/admin/seo` dashboard.

**Implementation**: Read-only diagnostic view generated from:
1. Existing static routes
2. All entities with `status = active` + `seoSlug` set + `robotsIndex !== false`
3. Published articles from the articles database

**Display**:
```
SITEMAP HEALTH
Total candidate URLs:    47
Currently in sitemap:    17  (static only)
Eligible but missing:    30  (dynamic entities — need slug + generateStaticParams)
Excluded (noindex):       3
Orphan URLs:              5

RECENTLY CHANGED (last 14 days)
/hikes/tugela-falls — updated 2026-08-09
/stays/royal-natal-lodge — new entity 2026-08-10
```

**Architecture fit**: Read queries against `vd_entities` and `site_content`. The sitemap itself (`app/sitemap.ts`) is extended to query entities with slugs set.

---

## TOOL 13 — Content Brief Generator

**Location**: "New Page" workflow in `/admin/seo/new`.

**Implementation**: A form that produces a structured brief — NOT AI-generated content.

```
Step 1: Choose page type (Trail / Destination / Property / Activity / Package / Article)
Step 2: Enter entity name and target audience
Step 3: Brief is generated from template

OUTPUT:
  Page Type: Trail
  Entity: Cathedral Peak Trail
  Primary Topic: Cathedral Peak hiking
  Search Intent: Informational + Commercial (find guided hike)
  Required Sections:
    □ Introduction — what makes this trail significant
    □ Trail statistics (distance, elevation, difficulty)
    □ Daily breakdown (multi-day only)
    □ What to bring
    □ Guided experiences available
    □ Nearby accommodation
    □ Related trails
    □ Safety notes
  Suggested internal links:
    → /regions/central-berg
    → /guides (filtered to Central Berg operators)
    → /stays?region=central-berg
  Suggested structured data: Hike schema
  Focus keyword: Cathedral Peak hike
  Suggested SEO title: Cathedral Peak Trail: Complete Hiking Guide | Visit Drakensberg
  Suggested H1: Cathedral Peak Trail — Difficulty, Routes & Guided Hikes
  Suggested meta description: (template populated from entity data)
```

**Architecture fit**: Template-based, not AI. Works from entity metadata already in the system.

---

## TOOL 14 — Page Quality Checklist

**Location**: Pre-publish checklist button in each entity editor.

**Implementation**: A modal checklist derived from entity fields. Each item resolves to green/red automatically where possible, with manual checkboxes for items that require human judgment.

**Architecture fit**: Zero database changes. Pure UI over existing entity data.

---

## TOOL 15 — Page Relationship Visualiser

**Location**: `/admin/seo/graph` — new page.

**Implementation**: Simple force-directed graph using the `relatedEntities` arrays and region groupings. Use a lightweight SVG-based graph (no external library needed — a simple d3-like implementation with React SVG).

**Data shape**:
```typescript
type GraphNode = { id: string; kind: string; title: string; status: string }
type GraphEdge = { source: string; target: string; type: 'related' | 'region' | 'parent' }

async function buildRelationshipGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>
```

**Architecture fit**: Read-only over existing entity data. New UI only.

---

## Consolidated /admin/seo Dashboard

**Replace the current non-functional `/admin/seo` shell with a real dashboard.**

### Tabs

1. **Overview** — SEO health summary (counts, issues, opportunities)
2. **Orphan Pages** — Tool 7
3. **Cannibalization** — Tool 8
4. **Topic Map** — Tool 9
5. **Sitemap** — Tool 12
6. **Redirects** — Tool 11
7. **Content Briefs** — Tool 13

### Overview Dashboard Metrics

```
Pages
  Total published entities:       {n}
  With slug (indexable):          {n}
  Missing slug:                   {n}
  Noindex:                        {n}
  Orphan (no incoming links):     {n}
  Missing SEO title:              {n}
  Missing meta description:       {n}
  
Entities
  Destinations (regions):         {n} ({m} with individual pages)
  Trails:                         {n} published
  Accommodation:                  {n} active
  Activities:                     {n} active
  Guides/Operators:               {n} active
  Packages:                       {n} published
  Articles:                       {n} published

Opportunities
  Entities without slug:          {n} (cannot be indexed)
  Entities without SEO title:     {n}
  Region pages missing:           1 (no /regions/[slug] route)
  Articles in database:           0 (all hardcoded — migrate to DB)
```

---

## Implementation Priority for Admin Tools

| Tool | Effort | Impact | Priority |
|---|---|---|---|
| 1 — Entity SEO Panel | Low | HIGH | P1 |
| 2 — Health Score | Low | HIGH | P1 |
| 10 — Indexation Control | Low | HIGH | P1 (part of Tool 1) |
| 12 — Sitemap Control | Medium | HIGH | P2 |
| 7 — Orphan Detector | Medium | HIGH | P2 |
| 11 — Redirect Manager | Medium (new table) | HIGH | P2 (needed for slug migration) |
| 4 — Related Entity Manager | Medium | HIGH | P2 |
| 3 — Link Suggestions | Medium | MEDIUM | P3 |
| 8 — Cannibalization Detector | Medium | MEDIUM | P3 |
| 9 — Topic Map | Medium | MEDIUM | P3 |
| 5 — Content Blocks | High | MEDIUM | P3 |
| 13 — Content Brief | Low | MEDIUM | P3 |
| 14 — Quality Checklist | Low | MEDIUM | P3 |
| 6 — Context Panel | Low | LOW | P4 |
| 15 — Relationship Visualiser | High | LOW | P4 |
