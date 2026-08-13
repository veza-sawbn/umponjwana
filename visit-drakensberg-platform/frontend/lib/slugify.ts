// Shared slug utilities — the "Slug population" phase of the destination
// graph work (docs/destination-graph/PHASE_F.md). Every detail route
// already resolves canonically via `entity.slug || entity.id` (Phase B
// onward); this is the other half — populating `slug` automatically at
// entity-creation time so a human-readable URL exists from day one instead
// of only after a future admin SEO panel backfill.

/** Lowercase, hyphenated, ASCII-safe URL segment. Not unique on its own —
 *  pair with `uniqueSlug()` against the entity kind's existing slugs. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

/** Appends -2, -3, … until `base` doesn't collide with anything in
 *  `existing` — callers pass each sibling entity's `slug || id` so a new
 *  slug can never collide with another entity's already-canonical URL,
 *  slug-based or id-based. Returns `base` unchanged (even empty) when there
 *  is nothing to slugify or nothing to collide with. */
export function uniqueSlug(base: string, existing: Iterable<string | undefined>): string {
  if (!base) return base
  const taken = new Set<string>()
  for (const s of existing) if (s) taken.add(s)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
