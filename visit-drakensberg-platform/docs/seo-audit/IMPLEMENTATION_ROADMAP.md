# IMPLEMENTATION ROADMAP

Sequenced by SEO impact ÷ (complexity × risk), respecting dependencies. Each phase ships independently and is separately reversible.

**Nothing in Phases 0–2 changes a live URL, migrates data, or alters the database schema.**

---

## PHASE 0 — Zero-risk wins (½ day)

No architectural change. Config and metadata only.

| # | Task | Gap | Effort |
|---|---|---|---|
| 0.1 | `robots: { index:false, follow:true }` on `/search`, `/trip`, `/experiences/compare`, `/experiences/request`, `/maintenance`, `/itinerary/[id]/print` | G10 | XS |
| 0.2 | Verify `/invoices/[id]` and `/quotes/[id]` are token-gated; `noindex` regardless | G10 | XS |
| 0.3 | Add `layout.tsx` metadata to `/towns` and `/about` (missing) | — | XS |
| 0.4 | Decide `/stories`: canonical → `/mydrakensberg`, or make it a real seasonal page | G11 | XS |
| 0.5 | Point Navbar links at plain paths where the param isn't read (interim for G8) | G8 | XS |
| 0.6 | **Label `/admin/seo` as non-functional** so no further team work is lost in it | G3 | XS |

**Exit:** no indexable utility pages, no links to phantom filters, no silent data loss in the admin console.

---

## PHASE 1 — The delivery layer (1 week) ← highest value

This is the phase that unlocks everything. One pattern, established once, repeated across eight existing routes.

### 1.1 Server-shell pattern (the keystone)

For each entity detail route, convert the route file to a **server component** that fetches data, exports `generateMetadata`, emits JSON-LD, and renders the **existing client component unchanged** as an interactive island.

```
app/hikes/[id]/page.tsx          → server: fetch + generateMetadata + JSON-LD
app/hikes/[id]/TrailDetail.tsx   → the current 'use client' body, moved verbatim
```

Applies to: `/hikes/[id]`, `/stays/[id]`, `/activities/[id]`, `/regions/[slug]`, `/packages/[id]`, `/guides/[id]`, `/guides/operators/[id]`, `/experiences/[id]`, `/mydrakensberg/[slug]`.

- Uses `lib/supabase-server.ts` — **already exists**, no new infrastructure.
- Routes are already `λ` (dynamic) — no added runtime cost.
- Client components move essentially verbatim; booking cart, filters and interactivity are untouched.
- **Start with `/regions/[slug]`** — it already has `seoTitle`/`seoDescription` populated, so it validates the whole pattern with the least new data.

**Gaps closed:** G1, G5, G6, G12, G15 · **Effort:** M–L · **Risk:** 🟡 (shared pattern; per-route rollout keeps it contained)

### 1.2 Dynamic sitemap

Replace hardcoded arrays with an async sitemap over indexable entities. Canonical form only; never `noindex`.

**Gap:** G2 · **Effort:** S · **Risk:** 🟢

### 1.3 Reserve and Town detail pages

Add `/nature-reserves/[slug]` and `/towns/[slug]` using the 1.1 pattern. Data, slugs and SEO fields already exist — this is close to pure profit.

**Gap:** G4 · **Effort:** S · **Risk:** 🟢

### 1.4 Structured data per kind

| Kind | Schema |
|---|---|
| Region | `TouristDestination` |
| Reserve / peak | `TouristAttraction` |
| Trail | `TouristAttraction` + `ExerciseAction` |
| Property | `LodgingBusiness` (+ `geo`, `amenityFeature`, `priceRange`) |
| Activity | `Product` + `Offer` |
| Package | `Product` + `Offer` |
| Departure | `Event` + `Offer` |
| Operator / guide | `Organization` / `Person` |
| Article | `Article` |
| All detail pages | `BreadcrumbList` |

**Gap:** G6 · **Effort:** M · **Risk:** 🟢

### 1.5 ISR

Add `revalidate` to the new server routes.

**Gap:** G18 · **Effort:** S · **Risk:** 🟢

**Phase 1 exit criteria**
- Every entity page has a unique title, description and canonical.
- Every indexable entity appears in the sitemap.
- Reserves and towns are reachable by search.
- Structured data validates in Google's Rich Results Test.
- Zero live URLs changed. Zero migrations.

---

## PHASE 2 — Admin control (1 week)

Hands the system to the Visit Drakensberg team. Depends on Phase 1 (fields must be *read* before editing them means anything).

| # | Task | Tool | Gap | Effort |
|---|---|---|---|---|
| 2.1 | `<SeoPanel>` shared component; SEO fields on entity payloads (JSONB, no migration) | 1 | G3 | S |
| 2.2 | Mount the panel in every admin/supplier editor | 1 | G3 | XS each |
| 2.3 | Replace the `/admin/seo` mockup with a real dashboard | 1, 15 | G3 | M |
| 2.4 | Indexation control, `admin`-role-gated, with audit trail | 10 | — | S |
| 2.5 | Sitemap monitor + non-canonical consistency check | 12 | — | S |
| 2.6 | Entity context panel | 6 | — | S |
| 2.7 | SEO health score + publish checklist | 2, 14 | — | M |
| 2.8 | Section visibility toggles per entity (instead of a block composer) | 5 | — | S |

**Exit:** the team can edit any page's SEO without a developer, and those edits appear in the live HTML.

---

## PHASE 3 — The destination graph (1–2 weeks)

| # | Task | Tool | Gap | Effort |
|---|---|---|---|---|
| 3.1 | Relationship fields on entity payloads (`relatedTrailIds[]`, `regionSlug`, `reserveSlug`, `townSlug`, …) | 4 | G14 | S |
| 3.2 | Related-entities manager with bidirectional writes | 4 | G14 | M |
| 3.3 | Link suggestions built on `regionsMatch()` + `haversineKm()` + `destination-ia.ts` | 3 | G14 | M |
| 3.4 | Orphan detector (counting derived edges as weak links) | 7 | — | M |
| 3.5 | Relationship tree + sortable entity index | 15 | — | S |
| 3.6 | Slug fields + slug-first resolution with ID fallback and canonical | — | G7 | M |
| 3.7 | Redirect manager over existing `middleware.ts` | 11 | G16 | M |
| 3.8 | Implement `difficulty` / `type` filters + facet indexation policy | — | G8, G9 | M |
| 3.9 | Article entity; migrate hardcoded stories | — | G13 | M |
| 3.10 | Topic map + cannibalisation detector | 9, 8 | G11 | M |
| 3.11 | Image `altText` on media payload | — | G19 | S |

**Note on 3.6:** slug resolution is additive (slug first, ID fallback, canonical to slug). No redirects required on day one; 3.7 ships first so hardening is available when wanted.

**Exit:** the destination graph is persisted, editable, crawlable, and internally linked. Clean URLs live with no breakage.

---

## PHASE 4 — Expansion (as demand justifies)

Deliberately unscheduled. Each item needs Phases 1–3 in place to be worth building.

| Task | Gap | Effort | Condition |
|---|---|---|---|
| `/tours` listing + `/tours/[slug]` | G17 | M | when tour inventory justifies evergreen pages |
| `/shuttles/[route-slug]` | G17 | M | high-intent queries; needs route slugs |
| Itineraries content type | — | L | after the graph exists |
| Content brief generator | — | M | once topic map has coverage |
| FAQ content model + `FAQPage` schema | — | M | — |
| Block composer | — | L | only if fixed templates prove limiting |
| Visual relationship graph | — | L | only if the text tree is insufficient |
| Search Console integration | — | M | for real index data in Tool 12 |
| `site_content` → relational | G20 | L | **only** past ~500 trails or when per-row RLS is needed |

---

## Dependency graph

```
PHASE 0  (independent — ship today)
    │
    ▼
PHASE 1.1  server-shell pattern  ← KEYSTONE
    ├──> 1.2 dynamic sitemap
    ├──> 1.3 reserve/town pages
    ├──> 1.4 structured data
    └──> 1.5 ISR
              │
              ▼
PHASE 2.1  SEO fields + panel
    ├──> 2.3 dashboard      ├──> 2.4 indexation
    ├──> 2.5 sitemap monitor├──> 2.6 context panel
    └──> 2.7 health/checklist
              │
              ▼
PHASE 3.1  relationship fields
    ├──> 3.2 manager ──> 3.4 orphans ──> 3.5 tree
    ├──> 3.3 suggestions
    └──> 3.7 redirects ──> 3.6 slugs ──> 3.8 facets
                                              │
                                              ▼
                                         PHASE 4
```

**Critical path: 1.1 → 2.1 → 3.1.** Three foundational tasks. Everything else hangs off them.

---

## Risk register

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Server-shell refactor breaks interactivity (booking cart, filters) | medium | high | Move client bodies **verbatim**; roll out one route at a time; verify cart + filters per route |
| `generateMetadata` doubles Supabase reads | medium | low | ISR (1.5) + Next request dedup; reuse the fetch between metadata and page |
| Slug collisions | medium | medium | Uniqueness check + discriminator suffix; slugs immutable once published |
| Canonical mistakes de-index pages | low | **high** | Sitemap consistency check (2.5); audit trail (2.4); admin-only indexation |
| Facet indexing creates duplicates | medium | medium | Whitelist single-facet only; `noindex` multi-facet — never index combinatorially |
| Supplier `noindex`es their own listing | low | medium | `requireRole('admin')` server-side, not hidden UI |
| Redirect chains/loops | medium | medium | Server-side validation collapses chains, rejects loops |
| Client `useEffect` fetch left behind after server conversion | medium | low | Pass server data as props; remove the duplicate fetch |
| `site_content` blob contention as trails grow | low now | medium | Monitor; G20 revisit past ~500 trails |
| Sitemap includes `noindex` URLs | medium | high | Single `indexable()` predicate shared by sitemap and metadata |

---

## Success measures

**Phase 1**
- 100% of indexable entities have a unique title + description + canonical
- Sitemap URL count goes from 23 → all indexable entities
- Reserve and town pages return 200 with correct metadata
- Rich Results Test passes for each schema type
- Zero live URLs changed *(hard requirement)*

**Phase 2**
- Team edits SEO on any entity without a developer
- `/admin/seo` persists (the current mockup cannot)
- Zero `noindex` URLs in the sitemap

**Phase 3**
- Orphan count trending down
- ≥ 3 crawlable internal links per entity page
- Slug URLs live with ID URLs still resolving
- No unresolved cannibalisation flags

**Phase 4** — evaluated per item against demand.

---

## Effort summary

| Phase | Duration | Risk | Changes URLs? | Migrations? |
|---|---|---|---|---|
| 0 | ½ day | 🟢 | no | no |
| 1 | 1 week | 🟡 | **no** | **no** |
| 2 | 1 week | 🟢 | no | no |
| 3 | 1–2 weeks | 🟡 | additive only | no |
| 4 | ongoing | varies | additive | maybe (G20) |

**Total to full capability: ~3–4 weeks.** No rewrite, no database migration, no URL breakage.
