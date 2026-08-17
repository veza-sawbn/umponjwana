# Destination Graph — Phase I: "When to Go" seasonal mosaic

Requested: treat the region page's "best time to visit" text as a module similar to
myswitzerland.com's "holiday destinations" mosaic — four season tiles that each link to a
dynamic page showing that region's attractions for that season, grouped by topic ("By
Water", "In the Mountains", etc). A UX proposal and an interactive mockup were reviewed
and refined before building: stay on the site's light-only theme (no dark mode anywhere
in the real implementation), give each topic heading a one-line description of what it
groups, and render each topic's listings as an infinite swipeable carousel on mobile
instead of a static grid. `npm run build` passes.

## 1. Data model

Season and topic are **additive facets on the existing entities** (`Trail`, `Activity`),
not new entity types — same principle as every other phase here.

- **`lib/seasons.ts`** (new): the shared vocabulary.
  - `Season = 'summer' | 'autumn' | 'winter' | 'spring'`, with Southern Hemisphere ranges
    (this is the Drakensberg, South Africa) — Summer = Dec–Feb (wet, thunderstorms),
    Winter = Jun–Aug (dry, clearest views), matching the framing already used in
    existing region/reserve copy.
  - `SeasonTopic = 'water' | 'mountains' | 'wildlife' | 'culture' | 'family' | 'adventure'`
    — a **new** vocabulary, not a reuse of `ACTIVITY_CATEGORIES` or Trail's own
    `TrailCategory`/`SPECIALITY_WALK_TYPES`. Those two already exist for other UIs (the
    `/activities` filter tabs; hike-duration grouping) and don't overlap with each other
    — a season page needs to mix both entity kinds under one heading ("By Water" listing
    a trail *and* an activity), which needs one vocabulary both kinds can tag into.
  - `SEASON_META` / `SEASON_TOPIC_META`: label, blurb/description, and a season "tint"
    color used for the mosaic/hero overlays.
- **`lib/trails.ts` / `lib/activities.ts`**: added `seasons?: Season[]` and
  `topics?: SeasonTopic[]`, both optional so existing rows keep working untagged.
- **`lib/modules.ts`**: new `getSeasonalContent(regionName, season, client)` — published
  trails + active activities in the region tagged for that season, grouped by topic
  (`SEASON_TOPICS` order), with topics that have no matches omitted — the same
  "no empty-state clutter" rule as `getNearbyTrails`/`getNearbyRoutes`/etc.
- **`lib/season-cards.ts`** (new): `toSeasonCard()` adapts a `Trail` or `Activity` into
  one shared card shape so the listing components don't need to branch on entity kind.

## 2. Region page — "When to Go"

- Replaces the old plain-text "Best Time to Visit" callout with a full-width section:
  intro copy (still sourced from `region.bestTime` when set) + a 4-tile mosaic
  (`components/modules/SeasonMosaic.tsx`), one tile per season, each linking to
  `/regions/[slug]/[season]`.
- Tiles reuse the **region's own `heroImage`** with a season-tinted gradient overlay,
  rather than new stock photography per season — every region already has a hero image,
  so this needs no new admin field and never risks a missing image, while still
  visually distinguishing each season.

## 3. `/regions/[slug]/[season]` (new route)

Pure server component, same shape as every other converted detail route (`generateMetadata`,
JSON-LD `CollectionPage` + `BreadcrumbList`, `notFound()` for an unknown region or an
invalid season segment, `revalidate = 900`).

- Hero: region name + season, tint-matched to the mosaic tile, breadcrumb trail.
- Below the hero, one `SeasonTopicSection` per topic that has real matching content:
  - Icon + heading (e.g. "By Water") **with a one-line description underneath**
    explaining what the group is ("Experiences built around the region's rivers,
    waterfalls and pools.") — the specific ask from the design review.
  - **Desktop/tablet** (`sm:` and up): static grid (`SeasonListingCard`).
  - **Mobile** (below `sm`): `TopicListingCarousel` — a Swiper (`swiper/react`, already
    an installed-but-unused dependency) in `loop` mode, so listings scroll as an
    infinite carousel instead of a grid. Falls back to a plain swipeable row below 3
    cards, since looping needs enough slides to feel like a loop rather than glitch.
- If nothing matches (no trail/activity tagged for that region+season), renders a single
  empty-state message with a link back to the region page — not a blank shell of empty
  topic sections.

## 4. Light theme only

Per the explicit correction after the mockup review (the interactive mockup necessarily
supported dark mode, since the Artifact platform requires it — the real site does not):
every new component (`SeasonMosaic`, `SeasonTopicSection`, `SeasonListingCard`,
`TopicListingCarousel`, the `[season]` page itself) uses plain fixed colors
(`bg-white`, `text-[#000000]`, `bg-mist`, etc.), matching the rest of the site. No
`prefers-color-scheme` or theme-token logic was introduced anywhere in this phase.

## 5. Admin / supplier tagging UI

Season and topic are opt-in chip-toggle fields, added to every surface that edits a
`Trail` or `Activity`, matching the existing chip-button pattern already used for
Category/Difficulty/Included fields on the same forms:

- `app/supplier/activities/new/page.tsx` and `app/supplier/activities/[id]/edit/page.tsx`
  — "Best Seasons" and "Topics" chip fields.
- `app/admin/trails/page.tsx` — same two fields added to the shared `TrailForm`
  component (used for both the "add trail" and "edit trail" flows), plus
  `seasons: [], topics: []` added to `BLANK_TRAIL`'s defaults.

## Verified

`npm run build` passes, including the new `/regions/[slug]/[season]` route.

Runtime-verified against a placeholder Supabase project (falls back to `DEFAULT_REGIONS`/
`DEFAULT_TRAILS`):
- Temporarily tagged the fallback "Cathedral Peak Summit" trail (region "Northern
  Drakensberg") with `seasons: ['winter']`, `topics: ['mountains', 'adventure']`.
- `/regions/north-berg` → the "When to Go" mosaic renders all four season tiles, each
  linking to `/regions/north-berg/{summer,autumn,winter,spring}` (confirmed via curl).
- `/regions/north-berg/winter` → renders "Northern Drakensberg in Winter", with the
  trail appearing under **both** "In the Mountains" and "Adventure" topic groups, each
  with its description rendered under the heading (confirmed via curl and Playwright
  screenshots, desktop viewport).
- Confirmed via Playwright at a 390×844 mobile viewport: the desktop grid
  (`.sm\:grid`) is hidden and the Swiper carousel (`.sm\:hidden .swiper`) is visible;
  at a 1440×900 desktop viewport, the reverse holds — grid visible, mobile-only block
  hidden. This is the same responsive-split technique (`hidden sm:grid` / `sm:hidden`)
  already used for Navbar's mobile-drilldown-vs-desktop-hover split.
- Reverted the temporary trail tagging immediately after (confirmed via diff against a
  backup) — no test data shipped.
- With no trail/activity tagged for a given region+season, the topics section correctly
  renders the "nothing tagged yet" empty state instead of empty topic shells.

A live check against real admin-authored season/topic tags on production content needs a
reachable Supabase project — this environment doesn't have one.

## What's still queued

- No curated/manual override for the topic groupings yet — same as every other automatic
  module in this project, ordering and inclusion are fully derived from tags, not
  admin-curated.
- The season tint currently only affects the mosaic tiles and the `[season]` page hero —
  worth considering whether per-season imagery is worth adding later instead of reusing
  the single region hero image with a color wash.
- Slug population's admin-editable form (Tool 1) and curated/hybrid module overrides
  remain unbuilt, as in every prior phase doc.
