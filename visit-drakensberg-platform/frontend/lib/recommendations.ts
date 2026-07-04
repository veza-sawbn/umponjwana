import { getActivities, type Activity } from './activities'
import { getDepartures, type Departure } from './departures'
import { getProperties, type Property } from './properties'
import { getRoomsByProperty } from './rooms'

// Context-aware recommendation engine. Inputs are the visitor's real
// context (region, travel dates, current cart, past bookings); output is a
// scored, deduplicated list of live catalog items with the reason exposed
// so the UI never shows an unexplained "generic" pick.

export type RecommendationContext = {
  region?: string
  checkIn?: string
  checkOut?: string
  guests?: number
  /** ids already in the visitor's cart / bookings — excluded from results */
  excludeIds?: string[]
  /** regions from past bookings, weakest signal */
  historyRegions?: string[]
}

export type Recommendation = {
  id: string
  kind: 'activity' | 'tour-departure' | 'stay'
  title: string
  region: string
  price: number | null
  date?: string
  image?: string
  href: string
  reason: string
  score: number
}

function normRegion(r: string | undefined | null) {
  return (r || '').toLowerCase().trim().replace(/\bnorthern\b/, 'north').replace(/\bsouthern\b/, 'south')
}

function regionsMatch(a?: string | null, b?: string | null) {
  const na = normRegion(a); const nb = normRegion(b)
  if (!na || !nb) return false
  return na.includes(nb) || nb.includes(na)
}

function dateInRange(date: string, from?: string, to?: string) {
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export async function getRecommendations(ctx: RecommendationContext, limit = 6): Promise<Recommendation[]> {
  const exclude = new Set(ctx.excludeIds ?? [])
  const today = new Date().toISOString().slice(0, 10)

  const [activities, departures, properties] = await Promise.all([
    getActivities().catch(() => [] as Activity[]),
    getDepartures().catch(() => [] as Departure[]),
    getProperties().catch(() => [] as Property[]),
  ])

  const recs: Recommendation[] = []

  for (const a of activities) {
    if (a.status !== 'active' || exclude.has(a.id)) continue
    let score = 1
    let reason = 'Live experience in the Drakensberg'
    if (regionsMatch(a.region, ctx.region)) {
      score += 4
      reason = `In ${a.region || ctx.region} — where you're headed`
    } else if (ctx.historyRegions?.some(r => regionsMatch(a.region, r))) {
      score += 2
      reason = `Because you've visited ${a.region}`
    }
    if (ctx.guests && a.maxGroup && ctx.guests <= a.maxGroup) score += 1
    recs.push({
      id: a.id, kind: 'activity', title: a.name, region: a.region || 'Drakensberg',
      price: a.pricePerPerson || null, image: a.photos?.[0],
      href: `/activities/${a.id}`, reason, score,
    })
  }

  for (const d of departures) {
    if (exclude.has(d.id) || d.status === 'full') continue
    if (!d.date || d.date < today) continue
    const seatsLeft = d.maxSeats - d.bookedSeats
    if (ctx.guests && seatsLeft < ctx.guests) continue
    let score = 2 // has a concrete future date + availability
    let reason = `Departs ${new Date(d.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} · ${seatsLeft} seats left`
    if (dateInRange(d.date, ctx.checkIn, ctx.checkOut)) {
      score += 5
      reason = `Departs during your stay · ${seatsLeft} seats left`
    }
    recs.push({
      id: d.id, kind: 'tour-departure', title: d.tour, region: 'Drakensberg',
      price: d.pricePerPerson || null, date: d.date,
      href: d.trailId ? `/hikes/${d.trailId}` : '/hikes', reason, score,
    })
  }

  // Stays only recommended when the visitor doesn't already have one excluded
  // explicitly (cart stay id goes into excludeIds).
  for (const p of properties) {
    if (p.status !== 'active' || exclude.has(p.id)) continue
    let score = 0
    let reason = ''
    if (regionsMatch(p.region, ctx.region)) {
      score = 3
      reason = `Stay in ${p.region}, close to your plans`
    } else if (ctx.historyRegions?.some(r => regionsMatch(p.region, r))) {
      score = 1.5
      reason = `Because you've stayed in ${p.region}`
    }
    if (score === 0) continue // don't recommend stays without a contextual link
    recs.push({
      id: p.id, kind: 'stay', title: p.name, region: p.region || 'Drakensberg',
      price: null, image: p.photos?.[0],
      href: `/stays/${p.id}`, reason, score,
    })
  }

  recs.sort((a, b) => b.score - a.score || (a.date || '9999').localeCompare(b.date || '9999'))
  return recs.slice(0, limit)
}

/** Min room price per property — used to decorate stay recommendations. */
export async function getStayPrice(propertyId: string): Promise<number | null> {
  try {
    const rooms = await getRoomsByProperty(propertyId)
    if (rooms.length === 0) return null
    return Math.min(...rooms.map(r => r.basePrice))
  } catch {
    return null
  }
}
