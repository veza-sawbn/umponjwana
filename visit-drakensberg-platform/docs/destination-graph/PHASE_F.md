# Destination Graph — Phase F: slug population

The last item from the ordered list this session worked through. Every detail route since Phase B has resolved canonically via `entity.slug || entity.id`, but nothing ever populated `slug` — every Property/Activity/Tour/Package/Route created through the live product still gets a UUID-shaped URL (`/stays/prop-a1b2c3…`) because `slug` stays `undefined` forever. This phase closes that gap at entity-creation time, without building the admin SEO panel (Tool 1) that would let someone *edit* a slug after the fact — that stays queued, as it has been since Phase B §9.

## Decision: auto-generate at creation, not an admin editing UI

Two ways to close the gap were on the table: (1) an admin panel to type in a slug per entity, or (2) generate one automatically from the entity's own name/title at the moment it's created. Went with (2) for this phase:

- It requires no new admin surface, and doesn't block on Tool 1 (SEO panel) being built.
- It's the same shape of fix already proven correct for Trail — `app/admin/trails/page.tsx`'s `handleAdd()` has slugified a new trail's `name` into its `id` since before this session (`newTrail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')...`). Trail already effectively has "slugs" — as its `id`, not a separate field — which is why Trail is **not** touched by this phase; there's nothing to add.
- Every existing entity created before this phase still resolves fine at its UUID-style URL (`slug || id` unconditionally falls back) — this only changes new listings going forward, exactly the same non-destructive posture every other phase in this series has taken.
- An admin who later wants to *rename* a slug still needs Tool 1 — this phase intentionally never regenerates a slug on `update*`, since changing a slug after publication breaks whatever already links to it. Auto-generation only fires once, at creation.

## What changed

- **`lib/slugify.ts`** (new) — `slugify(text)` (lowercase, ASCII-hyphenated, 80-char cap) and `uniqueSlug(base, existing)` (appends `-2`, `-3`, … until `base` doesn't collide with anything in `existing`).
- **`lib/properties.ts`, `lib/activities.ts`, `lib/tours.ts`, `lib/packages.ts`, `lib/transport-routes.ts`** — each `add*()` now computes `slug = <caller-supplied slug> || uniqueSlug(slugify(<name/title/route>), <every sibling's slug || id>)` before inserting. The `<name/title/route>` source per kind:
  - Property → `name`
  - Activity → `name`
  - Tour → `name`
  - Package → `title`
  - Route → `"${from}-to-${to}"` (routes have no single title field)
- Collision-checked against **every existing entity of that kind's `slug || id`** (not just its `slug`) — a new slug can never silently collide with another entity's current canonical URL, whichever form that URL happens to be in.
- **Found and fixed a real duplication bug while wiring this up**: `lib/packages.ts`'s `duplicatePackage()` spread the original package's fields — including its `slug` — into a new `addPackage()` call. Since the new auto-slug logic only fires when `slug` is falsy, an un-fixed `duplicatePackage()` would have handed the copy the *original's* slug verbatim, putting two packages behind the same canonical URL (whichever one a `.find()` lookup hits first would permanently shadow the other at that slug). Fixed by explicitly dropping `slug` alongside the other identity fields (`id`, `createdAt`, `updatedAt`) already stripped before the copy.
- Callers are unaffected — every `add*()` signature is unchanged (`Omit<T, 'id' | 'createdAt'>`, `slug` was already an optional field on the type via `GraphFields`); no supplier/admin form needed to change.

## Verified

`npm run build` passes. `slugify`/`uniqueSlug` unit-checked by compiling `lib/slugify.ts` standalone (`tsc … --module commonjs`) and running it directly against representative inputs:
```
slugify("Cathedral Peak Lodge!")          → "cathedral-peak-lodge"
slugify("  Multi   Space -- Test  ")      → "multi-space-test"
slugify("")                               → ""
uniqueSlug("foo", ["bar","baz"])          → "foo"
uniqueSlug("foo", ["foo","bar"])          → "foo-2"
uniqueSlug("foo", ["foo","foo-2","bar"])  → "foo-3"
uniqueSlug("", ["foo"])                   → ""            (nothing to slugify — returned as-is)
uniqueSlug("foo", [undefined, "foo"])     → "foo-2"        (undefined entries ignored, not literal "undefined")
```
A live create-and-read-back check (a real `addProperty()`/`addActivity()`/etc. call followed by a real fetch showing the new row's `slug`) needs a reachable Supabase project, which this environment doesn't have — same limitation logged in Phase C/D for anything requiring a real write.

## What's still queued

- Admin SEO panel (Tool 1, `docs/seo-audit/INTERNAL_SEO_TOOLS.md`) — editing/overriding an auto-generated slug after creation.
- A backfill pass for entities created before this phase — they keep resolving at their `id`-based URL indefinitely (not broken, just not the human-readable form); backfilling them a slug is a deliberate one-time admin action, not something to do silently on next read (that would change their canonical URL without an accompanying redirect).
- On-demand revalidation (`revalidatePath`) so a freshly created listing's slug-based URL is servable immediately rather than waiting out Phase D's time-based ISR window on first hit (first hit is always a cache miss regardless, so this mostly matters for the window immediately after creation before any request has occurred).
- Curated/hybrid module overrides — `ModuleConfig`'s non-automatic modes remain unread by any page.
