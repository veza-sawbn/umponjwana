// Destination-graph fields, additive across every graph-participating entity
// (Trail, Property, Activity, Tour, Event, ...). Mixed into each entity's
// type via intersection (`Trail = { ... } & GraphFields`) so existing code
// that constructs or reads these entities is unaffected — every field here
// is optional, and the underlying storage is JSONB (`vd_entities.value` /
// `site_content.value`), so adding these fields requires no migration.
//
// This is the Phase A foundation for the destination graph: fields exist and
// are typed here so entity editors and the Phase B module-composition system
// have a single, consistent shape to read and write. Nothing reads or writes
// these fields yet outside the explicit backfills done as part of this
// change (see docs/destination-graph/PHASE_A.md).
export type GraphFields = {
  /** Human-readable URL segment. When absent, detail routes fall back to the
   *  entity's opaque ID — see docs/destination-graph/PHASE_A.md for the
   *  slug-first-with-ID-fallback resolution strategy planned for Phase B. */
  slug?: string
  seoTitle?: string
  seoDescription?: string
  /** Canonical parent Region.slug. A fast, explicit path alongside the
   *  existing free-text `region` field, which regionsMatch() keeps as a
   *  fuzzy fallback for legacy/free-text data — this field does not replace
   *  it. */
  regionSlug?: string
  /** Explicit, admin-curated cross-links — additive to whatever a page's
   *  "automatic" recommendation modules derive at query time (region match,
   *  GPS proximity, shared tour/departure). See lib/page-composition.ts. */
  relatedTrailIds?: string[]
  relatedPropertyIds?: string[]
  relatedActivityIds?: string[]
  relatedTourIds?: string[]
  /** Defaults to indexable (true) when undefined. Admin-only — see the
   *  Page Indexation Control tool in docs/seo-audit/INTERNAL_SEO_TOOLS.md. */
  robotsIndex?: boolean
}
