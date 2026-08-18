# Destination Graph — Phase E: wire the primary IA into the Navbar

The last of the destination-graph review's flagged decisions (Phase B §9, Phase C §3): `DESTINATION_GRAPH_NAV` existed as reviewable data since Phase A but was never read by `Navbar.tsx`, which still rendered the old `PRIMARY_NAVIGATION` (Destinations/Attractions/Nature/Experiences/Summer/Winter) plus three appended product pages (Stays/Shuttles/Stories). `npm run build` passes throughout.

## 1. `NAV_ITEMS` now built from `DESTINATION_GRAPH_NAV`

`components/layout/Navbar.tsx` no longer imports `PRIMARY_NAVIGATION`/`DESTINATIONS`. Instead:

```ts
const NAV_ITEMS: NavItem[] = DESTINATION_GRAPH_NAV
  .filter(node => node.status === 'live')
  .map(node => ({
    label: node.label,
    href: node.href,
    children: (node.children ?? []).filter(child => child.status === 'live').map(...),
    ...(PRIMARY_ENRICHMENT[node.label] ?? { /* generic fallback image */ }),
  }))
```

- **Only `'live'` nodes render** — at both the primary and child level. A `'planned'` child (e.g. Explore's "Mountains & Peaks", "Waterfalls", "Heritage & Culture", "Viewpoints", "Maps"; Hikes' "Northern Traverse", "Hiking Resources", "Trail Safety", "Hiking Gear"; Plan Your Trip's "When to Visit"/"What to Pack"/"Getting Here") simply doesn't appear — no Navbar change is needed when one flips to `'live'` later, exactly the design `lib/destination-ia.ts` committed to in Phase A.
- **`PRIMARY_ENRICHMENT`** (new) replaces the old `_primaryMap` — one entry per one of the 7 primaries (Explore, Hikes, Stay, Things to Do, Tours, Plan Your Trip, Transport), each an image/imageAlt/sublabel for the desktop hero panel. All 7 image URLs are ones the codebase already referenced elsewhere in `Navbar.tsx`/`lib/site-content.ts` — no new unvetted external URLs introduced.
- **The 3 old appended product pages are gone as separate hero entries** — Stay (was "Stays") and Transport (was "Shuttles", now covering both `/shuttles` and the newly-live `/transport`) are already primaries in the new IA, so keeping the old duplicates would have shown two "Stays"-shaped entries. "Stories" (`/mydrakensberg`) isn't one of the 7 primaries — it moved into the menu's footer utility-link row (alongside "About Us"/"List Your Property"), which already existed for exactly this kind of secondary link. It's still reachable from `Footer.tsx` on every page too.
- **`NAV_IMAGE_KEYS`** (admin-editable image override lookup) updated: `/mydrakensberg` → `stories_image` removed (no longer a hero item to override), `/tours` → `tours_image` added (new `tours_image` default added to `lib/site-content.ts`'s `nav_menu`, matching the pattern of every other primary).

## 2. Mobile drill-down — the explicit requirement from the destination-graph review

> "The mobile shell menu must only list the primary menu items then show subitems on the next tab when the user selects an item."

The pre-existing mobile behaviour didn't do this — it showed every primary's children as an always-visible flat wrapped list directly under the label, all at once. Replaced with real drill-down:

- **New state**: `mobileSection: NavItem | null`, reset to `null` whenever `menuOpen` goes false (closing the menu, clicking a link, or navigating away always returns to the primaries-only list on next open).
- **Primaries list** (`mobileSection === null`): each primary now renders as **two separate elements, split by breakpoint** — a `hidden lg:inline-block` `<Link>` (desktop: direct navigation + hover drives the existing sub-column/image, unchanged) and an `lg:hidden` `<button>` (mobile: tapping calls `setMobileSection(item)`, does **not** navigate). The mobile button shows a trailing `ChevronRight` to signal it drills in rather than navigates.
- **Drill-down view** (`mobileSection` set): `lg:hidden`, so desktop never enters this state at all. Shows a back button (`← All Categories`), the section's label, then its live children as full-width tappable rows. Tapping a child navigates and closes the menu (`setMenuOpen(false)`), same as before.
- **`withOverviewLink()`** (new helper): since primaries no longer navigate directly on mobile tap, the primary page itself needs a path back — this prepends a "Browse All" link to the drill-down list, pointing at the primary's own `href`, but only when no existing child already points there (e.g. Hikes' "All Hikes" already covers `/hikes`, so nothing is duplicated). Used by the mobile drill-down list only — desktop's sub-column is unaffected and still reads `item.children` directly, matching its pre-existing behaviour.

Desktop hover interaction (label → sub-column → hero image) is completely unchanged — only mobile's interaction model changed.

## 3. Verified

`npm run build` passes. Runtime-verified with Playwright against the running app (placeholder Supabase credentials — the navbar itself doesn't depend on entity data):

```
Mobile (390×844): opening the menu shows only the 7 primaries
                   (Explore, Hikes, Stay, Things to Do, Tours,
                   Plan Your Trip, Transport) — no "Browse All"/
                   child link visible before any tap.
                   Tapping "Hikes" shows the drill-down header
                   "Hikes" and children ["All Hikes", "Grand Traverse"].
                   Tapping "All Categories" returns to the same
                   7-primary list.
Desktop (1440×900): the 7 primaries render as direct links.
                    Hovering "Tours" reveals its sub-column
                    (["All Tours"]) — unchanged hover-driven behaviour.
```

## 4. What's still queued

- Slug population — the `slug || id` fallback is everywhere already; only the admin UI to *set* a slug and a backfill pass remain.
- Admin SEO panel (Tool 1) and the rest of `docs/seo-audit/INTERNAL_SEO_TOOLS.md`.
- Curated/hybrid module overrides — `ModuleConfig`'s non-automatic modes remain unread by any page.
- On-demand revalidation (`revalidatePath`/`revalidateTag`) from admin/supplier save actions — Phase D's ISR is time-based only.
- As more `'planned'` nodes in `DESTINATION_GRAPH_NAV` gain their `requires` condition (an Article entity for editorial content, a feature/tag vocabulary on Reserve/Town, etc.), flipping their `status` to `'live'` is the entire Navbar-side change needed — this phase's filtering logic already handles it.
