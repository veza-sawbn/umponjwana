import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './auth'
import { getTrails, type Trail } from './trails'
import { getReserves, type Reserve } from './reserves'
import { getTowns, type Town } from './towns'

/* ────────────────────────────────────────────────────────────────────────────
 * "Top Attractions" — the homepage's editorial pick of places worth visiting.
 *
 * There is no Attraction entity. An attraction is any destination content the
 * platform already publishes — a hiking trail, a nature reserve, a gateway
 * town — that an admin has ticked "Featured on Homepage" on, in that content's
 * own admin screen. So the section is curated where the content is edited,
 * rather than through a separate list someone has to remember to keep in sync.
 *
 * This replaces a "Top Trails" section that showed the first four published
 * trails and ignored the featured flag entirely, which meant the flag on
 * /admin/trails did nothing at all.
 * ──────────────────────────────────────────────────────────────────────────── */

export type AttractionKind = 'trail' | 'reserve' | 'town'

export type Attraction = {
  id: string
  kind: AttractionKind
  name: string
  href: string
  /** One short line under the name — the distinguishing detail per kind. */
  meta: string
  image?: string
  /** Trails only: drives the difficulty pill. */
  difficulty?: string
}

export const ATTRACTION_KIND_LABEL: Record<AttractionKind, string> = {
  trail: 'Trail',
  reserve: 'Nature Reserve',
  town: 'Town',
}

/**
 * Every attraction an admin has featured, grouped by kind in a stable order
 * (trails, then reserves, then towns) so the homepage list doesn't reshuffle
 * between loads.
 *
 * Each source is read independently and a failure in one is swallowed: a
 * broken reserves read should cost the section its reserves, not blank the
 * whole homepage band. `getTrails` already falls back to its own defaults, so
 * it is the one source that cannot throw.
 *
 * Accepts an optional Supabase client so a caller can pass the session-less
 * public one (lib/supabase-public.ts) rather than the visitor's session.
 */
export async function getFeaturedAttractions(
  client: SupabaseClient = supabase,
): Promise<Attraction[]> {
  const [trails, reserves, towns] = await Promise.all([
    getTrails(client).catch((): Trail[] => []),
    getReserves(client).catch((): Reserve[] => []),
    getTowns(client).catch((): Town[] => []),
  ])

  // A featured trail that is still a draft is not ready to be shown to
  // visitors, whatever the flag says — publishing is the stronger signal.
  const trailItems: Attraction[] = trails
    .filter(t => t.featured && t.status === 'published')
    .map(t => ({
      id: t.id,
      kind: 'trail' as const,
      name: t.name,
      href: `/hikes/${t.slug || t.id}`,
      meta: [t.distance, t.elevation, t.duration].filter(Boolean).join(' · ') || t.region,
      image: t.image,
      difficulty: t.difficulty,
    }))

  const reserveItems: Attraction[] = reserves
    .filter(r => r.featured)
    .map(r => ({
      id: r.id,
      kind: 'reserve' as const,
      name: r.name,
      href: `/nature-reserves/${r.slug}`,
      meta: r.tagline || r.viewpointName || 'Nature reserve',
      image: r.image,
    }))

  const townItems: Attraction[] = towns
    .filter(t => t.featured)
    .map(t => ({
      id: t.id,
      kind: 'town' as const,
      name: t.name,
      href: `/towns/${t.slug}`,
      meta: t.gateway || 'Drakensberg town',
      image: t.image,
    }))

  return [...trailItems, ...reserveItems, ...townItems]
}
