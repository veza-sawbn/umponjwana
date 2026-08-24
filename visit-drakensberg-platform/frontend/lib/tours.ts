import {
  listEntities, listEntitiesByOwner, insertEntity, updateEntity, deleteEntity, newEntityId,
} from './entities'
import { deleteDeparturesByTour } from './departures'
import { getEffectiveSupplierId } from './effective-supplier'
import type { GraphFields } from './graph-fields'
import { slugify, uniqueSlug } from './slugify'
import type { TrailDay } from './trails'
import type { SupabaseClient } from '@supabase/supabase-js'

// A tier-specific edit to one day of the tour's default itinerary (the
// linked Trail's admin-authored `days` — see composeTierItinerary() below).
// Referenced positionally (`dayIndex` into the trail's `days` array, same
// indexing the admin trail editor itself uses) rather than by id, since
// TrailDay has none. Any field left unset falls through to the trail's
// value for that day.
export type ItineraryDayOverride = {
  dayIndex: number
  notes?: string
  accommodation?: string
  transport?: string
  meals?: string
}

// A day this tier adds on top of the trail's default plan — has no
// counterpart on the Trail, so it carries its own full content.
export type ExtraItineraryDay = {
  id: string
  label: string
  description?: string
  accommodation?: string
  transport?: string
  meals?: string
}

// One way to buy a seat on any departure of this tour — e.g. "Shuttled" vs
// "Self-Drive" — with its own price and its own add-ons. Departures choose
// which subset of a tour's tiers apply to their date (see DeparturePackage
// and composePackages() in lib/experiences.ts); a tour with none defined
// falls back to the flat `pricePerPerson` below.
//
// Itinerary customization: every tier starts from the tour's linked Trail's
// admin-authored day-by-day plan (Trail.days, edited at /admin/trails) as
// its default. A tier can narrow that down to fewer leading days
// (itineraryDayCount), edit the details of specific default days
// (itineraryOverrides), and/or add its own extra days before and/or after
// the default plan (itineraryDaysBefore / itineraryDaysAfter) — e.g. a
// "Standard" tier shows the trail's plan as-is, while a "Shuttle + Extra
// Night" tier adds one extra day before it (a shuttle pickup) without
// moving the hike's own start date. See composeTierItinerary().
export type PricingTier = {
  id: string
  name: string
  pricePerPerson: number
  inclusions: string[]
  itineraryDayCount?: number
  itineraryOverrides?: ItineraryDayOverride[]
  itineraryDaysBefore?: ExtraItineraryDay[]
  itineraryDaysAfter?: ExtraItineraryDay[]
}

// One day of a composed, guest-facing itinerary — the trail's default plan
// (or a tier's extra day) resolved for one specific rate package, in order.
// `dateOffset` is measured in days from the departure's "hiking date" (the
// anchor — Departure.date, the calendar date the trail's Day 1 falls on):
// 0 = the hiking date itself, negative = before it (an extra day a tier
// inserted ahead of the hike), positive = after the trail's Day 1.
export type ComposedItineraryDay = {
  label: string
  description?: string
  accommodation?: string
  transport?: string
  meals?: string
  distance?: string
  elevation?: string
  difficulty?: TrailDay['difficulty']
  dateOffset: number
  /** True for a tier's added day with no counterpart in the trail's own plan. */
  isExtra?: boolean
}

export type Tour = {
  id: string
  trailId: string
  trailName: string
  name: string
  difficulty: string
  days: number
  minAge: number
  maxGroup: number
  meetingPoint: string
  gpsLat: string
  gpsLng: string
  description: string
  included: string[]
  fitnessNotes: string
  cancellation: string
  // Kept in sync with the cheapest entry in `pricingTiers` (mirrors how
  // Departure.pricePerPerson follows its cheapest package) so the public
  // listing/SEO/admin surfaces that read this directly keep working
  // unchanged. Only a true stored value when pricingTiers is empty.
  pricePerPerson: number
  pricingTiers?: PricingTier[]
  /** @deprecated Superseded by PricingTier's itinerary fields, which build on the linked Trail's `days` instead of a separate tour-level plan. Retained so tours saved by the earlier version of this feature still parse; no longer read anywhere. */
  itinerary?: unknown
  /** @deprecated Removed from the supplier forms; retained so stored tours still parse. */
  groupDiscount?: number
  status: 'active' | 'draft'
  supplierName: string
  supplierId: string
  createdAt: string
  // Optional marketplace fields (trekking experience detail / comparison).
  // Older tours won't carry these; readers must treat them as absent.
  leadGuide?: string
  accommodationStyle?: string
  mealsIncluded?: string
  transportIncluded?: boolean
  equipmentIncluded?: boolean
  guideExperienceYears?: number
  rating?: number
  reviewCount?: number
  featured?: boolean
} & GraphFields

const KIND = 'tour'

export function newPricingTierId(): string {
  return newEntityId('tier')
}

export function newExtraItineraryDayId(): string {
  return newEntityId('day')
}

// Composes one tier's guest-facing itinerary: starts from the trail's
// default day-by-day plan (truncated to `itineraryDayCount` leading days,
// or every day when unset), applies any per-day overrides, then surrounds
// it with the tier's extra days. Returns [] when there's nothing to show at
// all (no trail days authored, and no extra days either) — callers should
// fall back to a flat duration display in that case, exactly as before this
// feature existed.
export function composeTierItinerary(
  trailDays: TrailDay[] | undefined,
  tier: Pick<PricingTier, 'itineraryDayCount' | 'itineraryOverrides' | 'itineraryDaysBefore' | 'itineraryDaysAfter'> | undefined,
): ComposedItineraryDay[] {
  const base = trailDays ?? []
  const count = tier?.itineraryDayCount != null ? Math.min(Math.max(1, tier.itineraryDayCount), base.length) : base.length
  const truncated = base.slice(0, count)
  const defaultDays: ComposedItineraryDay[] = truncated.map((d, i) => {
    const o = tier?.itineraryOverrides?.find(x => x.dayIndex === i)
    return {
      label: d.label,
      description: o?.notes ?? d.notes,
      accommodation: o?.accommodation,
      transport: o?.transport,
      meals: o?.meals,
      distance: d.distance,
      elevation: d.elevation,
      difficulty: d.difficulty,
      dateOffset: 0, // fixed up below, once we know how many "before" days precede it
    }
  })
  const toExtra = (d: ExtraItineraryDay): ComposedItineraryDay => ({
    label: d.label, description: d.description, accommodation: d.accommodation,
    transport: d.transport, meals: d.meals, dateOffset: 0, isExtra: true,
  })
  const before = (tier?.itineraryDaysBefore ?? []).map(toExtra)
  const after = (tier?.itineraryDaysAfter ?? []).map(toExtra)
  const all = [...before, ...defaultDays, ...after]
  return all.map((d, i) => ({ ...d, dateOffset: i - before.length }))
}

// Resolves the itinerary a specific rate package's guests should see: for a
// tier-linked package (DeparturePackage.tierId), from that tier's itinerary
// controls; for a freeform package (no tier), just a day-count truncation
// of the trail's default plan via its own `dayCount`. Takes a minimal shape
// rather than the real DeparturePackage type to avoid lib/tours.ts <->
// lib/departures.ts importing each other.
export function resolveItinerary(
  trailDays: TrailDay[] | undefined,
  pricingTiers: PricingTier[] | undefined,
  pkg: { tierId?: string; dayCount?: number } | undefined,
): ComposedItineraryDay[] {
  const tier = pkg?.tierId ? pricingTiers?.find(t => t.id === pkg.tierId) : undefined
  if (tier) return composeTierItinerary(trailDays, tier)
  return composeTierItinerary(trailDays, pkg?.dayCount != null ? { itineraryDayCount: pkg.dayCount } : undefined)
}

/**
 * Public catalog read — every live tour on the platform.
 * Use only on public-facing pages and in the admin console.
 * Supplier-portal screens must use getMyTours() / getToursBySupplier().
 */
export async function getTours(client?: SupabaseClient): Promise<Tour[]> {
  return client ? listEntities<Tour>(KIND, client) : listEntities<Tour>(KIND)
}

/** Only the tours owned by `supplierId`. */
export async function getToursBySupplier(supplierId: string): Promise<Tour[]> {
  return listEntitiesByOwner<Tour>(KIND, supplierId)
}

/**
 * The signed-in supplier's own tours — or, for operations staff who have
 * entered a managed supplier, that supplier's tours.
 */
export async function getMyTours(): Promise<Tour[]> {
  const ownerId = await getEffectiveSupplierId()
  return ownerId ? getToursBySupplier(ownerId) : []
}

export async function addTour(tour: Omit<Tour, 'id' | 'createdAt'>): Promise<Tour> {
  // Slug population (see lib/slugify.ts) — auto-generated from the tour
  // name unless already supplied, unique against every other tour's
  // canonical URL segment (slug || id).
  const slug = tour.slug || uniqueSlug(slugify(tour.name), (await getTours()).map(e => e.slug || e.id))
  const newTour: Tour = { ...tour, slug, id: newEntityId('tour'), createdAt: new Date().toISOString() }
  return insertEntity(KIND, newTour)
}

export async function updateTour(id: string, patch: Partial<Tour>): Promise<void> {
  await updateEntity(KIND, id, patch)
}

export async function deleteTour(id: string): Promise<void> {
  await Promise.all([deleteEntity(KIND, id), deleteDeparturesByTour(id)])
}
