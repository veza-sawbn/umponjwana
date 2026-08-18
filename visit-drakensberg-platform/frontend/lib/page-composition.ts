// Phase A type contract for reusable page-module composition (see
// docs/destination-graph/PHASE_A.md). Defines the shape a Destination /
// Trail / Tour / Property page's module list will take once Phase B wires
// it up — nothing renders against this yet. The intent, per the destination
// graph review: one set of module renderers (RelatedTrails, NearbyAccommodation,
// UpcomingDepartures, ...) reused across every page kind, each driven by this
// same config shape, rather than bespoke per-template composition logic.
//
// Storage: PageComposition records will live in `site_content` keyed per
// entity (e.g. `page_composition:region:north-berg`), mirroring the existing
// `home_cards` / `section_order` pattern already proven on the homepage
// editor (lib/site-content.ts) — not a new storage mechanism.

export type ModuleType =
  | 'related_trails'
  | 'nearby_accommodation'
  | 'nearby_activities'
  | 'upcoming_departures'
  | 'related_tours'
  | 'nearby_transport'
  | 'related_articles'
  | 'featured_events'
  | 'reviews'
  | 'faq'

/**
 * automatic — populated entirely by querying relationship fields
 *             (regionSlug, GPS proximity, related*Ids) at render time.
 * curated   — populated entirely by admin-selected `pinnedIds`, in order.
 * hybrid    — automatic query, then `pinnedIds` prepended and `excludedIds`
 *             filtered out. Preferred for commercially important modules
 *             (per the destination graph review) so admins never have to
 *             manually rebuild a module every time a supplier record changes.
 */
export type ModuleMode = 'automatic' | 'curated' | 'hybrid'

export type ModuleConfig = {
  id: string
  type: ModuleType
  enabled: boolean
  order: number
  title?: string
  description?: string
  mode: ModuleMode
  /** Automatic-mode query constraints, e.g. { maxDistanceKm: 30 }. */
  filters?: Record<string, unknown>
  /** Curated/hybrid: admin-selected entity IDs, shown first, in order. */
  pinnedIds?: string[]
  /** Hybrid: entity IDs suppressed from the automatic query. */
  excludedIds?: string[]
  limit?: number
}

export type PageKind = 'region' | 'reserve' | 'town' | 'trail' | 'tour' | 'property' | 'activity'

export type PageComposition = {
  pageKind: PageKind
  entityId: string
  modules: ModuleConfig[]
}
