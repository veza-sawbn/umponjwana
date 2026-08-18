# Visit Drakensberg — SEO Architecture Audit

**Date:** 2026-08-13
**Scope:** `visit-drakensberg-platform/frontend` · `frontend/supabase/migrations`
**Method:** static inspection of routes, components, data-access libs, migrations and build output.

**No application code was modified. No data was touched. No production URLs were changed.** This is an audit-only deliverable, as instructed by Part 3 and Part 19 of the brief.

---

## Verdict

# 🟡 AMBER

**No meaningful architectural restructuring is required. One contained change to the rendering layer is.**

| | |
|---|---|
| Rebuild required? | **No** |
| Database migration required? | **No** |
| URL changes required? | **No** |
| New infrastructure required? | **No** |
| Code change required? | **Yes — server-side metadata on 8 existing detail routes** |
| Standard practice? | **Yes — the documented Next.js App Router pattern** |
| Time to full capability | **~3–4 weeks** |

Full reasoning and evidence: **[ARCHITECTURE_CHANGE_DECISION.md](./ARCHITECTURE_CHANGE_DECISION.md)**

---

## Deliverables

| # | Document | Contents |
|---|---|---|
| 1 | [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) | Framework, rendering model, data architecture, what works vs what's missing |
| 2 | [SEO_CAPABILITY_MATRIX.md](./SEO_CAPABILITY_MATRIX.md) | Every Part 12 objective rated SUPPORTED / PARTIAL / NOT SUPPORTED |
| 3 | [ENTITY_GRAPH.md](./ENTITY_GRAPH.md) | Current and target entity relationships; per-entity readiness table |
| 4 | [URL_ARCHITECTURE.md](./URL_ARCHITECTURE.md) | Route census, brief-to-reality mapping, facet policy, slug migration |
| 5 | [INTERNAL_SEO_TOOLS.md](./INTERNAL_SEO_TOOLS.md) | All 15 admin tools + dashboard, specified against the existing architecture |
| 6 | [SEO_GAPS.md](./SEO_GAPS.md) | 20 gaps ranked by impact ÷ (effort × risk), with evidence |
| 7 | [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | Phased plan, dependency graph, risk register, success measures |
| 8 | [ARCHITECTURE_CHANGE_DECISION.md](./ARCHITECTURE_CHANGE_DECISION.md) | The GREEN/AMBER/RED determination with codebase evidence |

---

## Part 19 — the seven answers

### 1. What we already have

- **Next.js 14.1 App Router**, 115 routes building cleanly, deployed on Vercel
- **A correct metadata foundation** — `metadataBase`, title template, root canonical, OG with `en_ZA`, Twitter card, `TravelAgency` JSON-LD, `not-found.tsx`, and a well-formed `robots.ts` correctly disallowing all private surfaces
- **Good static metadata on 14 listing routes** via the sibling-`layout.tsx` pattern
- **A data model well suited to a destination graph** — both stores are JSONB, so SEO and relationship fields need **no migrations**
- **The SEO field pattern already proven** on `Region`, `Reserve` and `Town` (`slug` + `seoTitle` + `seoDescription`), with working admin CRUD
- **A server-side Supabase client that already exists** (`lib/supabase-server.ts`)
- **Detail routes already dynamic (`λ`)** — the server runtime is already executing and billed
- **A working destination graph in application logic** — `regionsMatch()` with 16 park→region aliases, `haversineKm()`, `destination-ia.ts`, and `TrekkingExperience` performing a live join across both storage patterns

### 2. What we can achieve immediately (no code change)

- Author `seoTitle`/`seoDescription` for regions, reserves, towns — fields and UI exist
- `noindex` six utility routes (`/search`, `/trip`, `/experiences/compare`, `/experiences/request`, `/maintenance`, `/itinerary/[id]/print`)
- Add missing `layout.tsx` metadata to `/towns` and `/about`
- Resolve the `/stories` vs `/mydrakensberg` duplication
- Repoint Navbar links away from filter params no page reads
- **Label `/admin/seo` non-functional** — it currently persists nothing and shows "Saved" anyway

### 3. What requires minor extensions

- **Dynamic sitemap** reading indexable entities (currently 17 hardcoded paths + 6 hand-copied slugs; zero DB entities)
- **`/nature-reserves/[slug]` and `/towns/[slug]`** — the best ratio on the site: content, slugs and SEO fields already exist with zero search visibility
- **SEO + relationship fields** on commercial entities — JSONB, no migration
- **Structured data per kind** — every required field is already in the data
- **Slug resolution** — additive, slug-first with ID fallback and canonical consolidation; no redirects needed on day one
- **Admin tools** — all 15 fit inside the existing console using the existing data layer

### 4. What genuinely requires architectural change

**Exactly one thing:** the eight entity detail routes must render metadata on the server.

All eight are `'use client'`, and `generateMetadata` cannot be exported from a client component. Result: every entity page in production serves the identical title `"Visit Drakensberg | Book Your Mountain Escape"`.

The fix is the standard App Router pattern — a server shell (fetch + `generateMetadata` + JSON-LD) rendering the existing client component verbatim as an island. No migration, no URL change, no rewrite, no new dependency, incremental and reversible per route.

### 5. What we recommend NOT changing

- **`/regions` → `/destinations`** — no. 301s on the only fully-authored slug route for zero ranking gain
- **`/stays` → `/accommodation`** — no. Live, indexed, shorter
- **`site_content` → relational tables** — not now. No current limitation; revisit past ~500 trails
- **`vd_entities` → per-type tables** — no. Its JSONB payload is precisely why SEO fields need no migration
- **A parallel SEO metadata table** — actively harmful; violates Principle 2 and guarantees drift
- **Replacing `regionsMatch()`** — keep it as the free-text fallback; add `regionSlug` as a fast path
- **Rewriting the client components** — they move verbatim into islands
- **Room-level pages, per-facet pages, AI body content** — all rejected on principle
- **Block composer and visual graph** — deferred; ship visibility toggles and a text tree instead

### 6. Internal tools to add

All 15 tools plus the dashboard, built inside `app/admin/*` on the existing data layer and role guard. **Tool 1 (Page SEO Panel) is the keystone** — nothing else is meaningful until SEO fields persist and are read.

Two storage rules, both from Principle 2:
- **Entity SEO fields live on the entity payload** (`Property.seoTitle` next to `Property.name`) — no parallel table, no drift, no migration
- **Only genuinely global artefacts get their own keys** — `admin_redirects`, `admin_topic_map`, `admin_seo_settings`

Full specification: [INTERNAL_SEO_TOOLS.md](./INTERNAL_SEO_TOOLS.md)

### 7. Implementation sequence

```
PHASE 0  ½ day    noindex utilities, missing metadata, /stories, Navbar links
PHASE 1  1 week   server-shell pattern ← KEYSTONE
                  dynamic sitemap · reserve+town pages · structured data · ISR
PHASE 2  1 week   SEO panel · dashboard · indexation control · health score
PHASE 3  1–2 wks  relationships · suggestions · orphans · slugs · redirects · facets
PHASE 4  ongoing  tours · shuttle routes · itineraries · GSC — as demand justifies
```

**Critical path: 1.1 → 2.1 → 3.1.** Three foundational tasks; everything else hangs off them.

Detail, dependency graph and risk register: [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)

---

## The three findings that matter most

**1. `/admin/seo` silently discards everything typed into it.**
`handleSave()` sets a flag and nothing else — no Supabase write (`app/admin/seo/page.tsx:32–35`). Any team member who has "edited SEO" there has lost that work while being shown a "Saved" confirmation. This is a correctness bug independent of the wider strategy, and it should be labelled today.

**2. Reserves and Towns are fully authored, slugged, SEO-populated — and have no page.**
`Reserve` carries `slug`, `regionSlug`, `seoTitle`, `seoDescription`, `description`, `peaks[]`, `permits`, `bestTime`, `facilities`. Admin CRUD exists. `/nature-reserves` and `/towns` are listing-only. This content is 100% invisible to search, and making it visible is a small additive change with no risk to any existing URL.

**3. The expensive half of the work is already done, and disconnected.**
SEO fields captured then discarded (`Region.seoTitle`). A rich relationship engine that renders client-side only (`SmartRecommendations`). A server Supabase client that exists and is unused. Detail routes already paying for a Node runtime that emits an empty shell. The audit's recurring theme is not absence — it is **disconnection**, which is far cheaper to fix than absence.
