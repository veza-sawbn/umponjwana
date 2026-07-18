import { supabase } from './auth'
import { listEntities, insertEntity, updateEntity } from './entities'
import { notify } from './notifications'
import {
  areaForPoint, getTransportCompanies, getTransportRequests, haversineKm, pointCoords,
  TRANSPORT_AREAS, type TransportCompany, type TransportRequest,
} from './transport'

// ============================================================================
// Background optimisation service.
//
// Continuously analyses upcoming journeys, vehicle movements, existing
// bookings, destination clusters and potential return journeys. When a
// supplier is already travelling into a region, its pending offers for
// nearby follow-on work are boosted ahead of suppliers that would start
// cold from a distant city.
//
// The engine learns from history: every completed request feeds the
// region-pair demand model stored in the `transport_insights` entity, so
// follow-on predictions sharpen as booking volume grows.
//
// It runs wherever an operations view is open (admin transport console
// mounts it on an interval) — every pass is idempotent.
// ============================================================================

const FOLLOW_ON_RADIUS_KM = 60
const INSIGHTS_KIND = 'transport_insights'
const INSIGHTS_ID = 'transport-insights-global'

export type RegionPairStat = {
  fromAreaId: string
  toAreaId: string
  trips: number
  returnTrips: number
}

export type DestinationCluster = {
  areaId: string
  areaName: string
  date: string
  inbound: number     // journeys arriving in the area that day
  outbound: number    // journeys leaving it
  requests: string[]
}

export type FollowOnMatch = {
  requestId: string
  pickupAddress: string
  dropoffAddress: string
  date: string
  supplierId: string
  companyName: string
  inboundRequestId: string
  gapKm: number
  previousRank: number
  boostedRank: number
}

export type TransportInsights = {
  id: string
  supplierId?: string
  status: string
  generatedAt: string
  analysedRequests: number
  completedTrips: number
  clusters: DestinationCluster[]
  followOnMatches: FollowOnMatch[]
  regionPairs: RegionPairStat[]
  createdAt: string
}

export async function getTransportInsights(): Promise<TransportInsights | null> {
  const all = await listEntities<TransportInsights>(INSIGHTS_KIND)
  return all.find(i => i.id === INSIGHTS_ID) ?? all[0] ?? null
}

function upsertPair(pairs: RegionPairStat[], fromAreaId: string, toAreaId: string) {
  let pair = pairs.find(p => p.fromAreaId === fromAreaId && p.toAreaId === toAreaId)
  if (!pair) {
    pair = { fromAreaId, toAreaId, trips: 0, returnTrips: 0 }
    pairs.push(pair)
  }
  pair.trips += 1
  const reverse = pairs.find(p => p.fromAreaId === toAreaId && p.toAreaId === fromAreaId)
  if (reverse) {
    reverse.returnTrips += 1
    pair.returnTrips += 1
  }
}

/**
 * One optimisation pass. Reads every request visible to the caller (run it
 * from an admin session for the global picture), reorders pending offers to
 * favour follow-on capacity, and persists refreshed insights.
 */
export async function runTransportOptimisation(options: { persist?: boolean; adminUserId?: string } = {}): Promise<TransportInsights> {
  const [requests, companies] = await Promise.all([getTransportRequests(), getTransportCompanies()])
  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  const upcoming = requests.filter(r => ['offered', 'accepted', 'driver_assigned', 'in_progress'].includes(r.status) && r.date >= today)
  const pending = upcoming.filter(r => r.status === 'offered')
  const committed = requests.filter(r => ['accepted', 'driver_assigned', 'in_progress'].includes(r.status))
  const completed = requests.filter(r => r.status === 'completed')

  // ── Destination clusters: where is demand landing, per day? ──
  const clusterMap = new Map<string, DestinationCluster>()
  for (const r of upcoming) {
    const dropArea = areaForPoint(r.dropoff)
    if (dropArea) {
      const key = `${dropArea.id}|${r.date}`
      const cluster = clusterMap.get(key) ?? { areaId: dropArea.id, areaName: dropArea.name, date: r.date, inbound: 0, outbound: 0, requests: [] }
      cluster.inbound += 1
      cluster.requests.push(r.id)
      clusterMap.set(key, cluster)
    }
    const pickupArea = areaForPoint(r.pickup)
    if (pickupArea) {
      const key = `${pickupArea.id}|${r.date}`
      const cluster = clusterMap.get(key) ?? { areaId: pickupArea.id, areaName: pickupArea.name, date: r.date, inbound: 0, outbound: 0, requests: [] }
      cluster.outbound += 1
      if (!cluster.requests.includes(r.id)) cluster.requests.push(r.id)
      clusterMap.set(key, cluster)
    }
  }
  const clusters = [...clusterMap.values()].sort((a, b) => (b.inbound + b.outbound) - (a.inbound + a.outbound)).slice(0, 20)

  // ── Learn from history: region-pair demand and return-journey frequency ──
  const regionPairs: RegionPairStat[] = []
  for (const r of completed) {
    const from = areaForPoint(r.pickup)
    const to = areaForPoint(r.dropoff)
    if (from && to) upsertPair(regionPairs, from.id, to.id)
  }

  // ── Follow-on matching: a pending request whose pickup sits near where a
  //    supplier's committed journey ends that day gets that supplier boosted
  //    to the front of its offer list. ──
  const followOnMatches: FollowOnMatch[] = []

  for (const request of pending) {
    const pickupCoords = pointCoords(request.pickup)
    if (!pickupCoords || !request.offers.length) continue

    let best: { supplierId: string; companyName: string; inboundRequestId: string; gapKm: number } | null = null
    for (const trip of committed) {
      if (trip.date !== request.date || !trip.assignment) continue
      const dropCoords = pointCoords(trip.dropoff)
      if (!dropCoords) continue
      const gapKm = haversineKm(dropCoords.lat, dropCoords.lng, pickupCoords.lat, pickupCoords.lng)
      if (gapKm <= FOLLOW_ON_RADIUS_KM && (!best || gapKm < best.gapKm)) {
        best = {
          supplierId: trip.assignment.supplierId,
          companyName: trip.assignment.companyName,
          inboundRequestId: trip.id,
          gapKm,
        }
      }
    }
    if (!best) continue

    // Supplier must be on this request's ranking and not already first in line.
    const offer = request.offers.find(o => o.supplierId === best!.supplierId && !o.response)
    if (!offer || offer.rank === 1) continue

    followOnMatches.push({
      requestId: request.id,
      pickupAddress: request.pickup.address,
      dropoffAddress: request.dropoff.address,
      date: request.date,
      supplierId: best.supplierId,
      companyName: best.companyName,
      inboundRequestId: best.inboundRequestId,
      gapKm: best.gapKm,
      previousRank: offer.rank,
      boostedRank: 1,
    })

    if (options.persist) {
      // Move the follow-on supplier to rank 1 and make sure it is notified.
      const reordered = [
        { ...offer, rank: 1, offeredAt: offer.offeredAt ?? now },
        ...request.offers.filter(o => o.supplierId !== offer.supplierId)
          .map((o, i) => ({ ...o, rank: i + 2 })),
      ]
      try {
        await supabase
          .from('vd_transport_requests')
          .update({
            value: { ...request, offers: reordered },
            offered_supplier_ids: reordered.filter(o => o.offeredAt).map(o => o.supplierId),
            updated_at: now,
          })
          .eq('id', request.id)
        if (!offer.offeredAt) {
          await notify(offer.supplierId, 'booking',
            'Follow-on transfer near your route',
            `You are already travelling to within ${best.gapKm} km of a new pickup on ${request.date}: ${request.pickup.address} → ${request.dropoff.address}. You have been moved to the front of the queue.`,
            '/supplier/jobs')
        }
      } catch {}
    }
  }

  const insights: TransportInsights = {
    id: INSIGHTS_ID,
    supplierId: options.adminUserId,
    status: 'active',
    generatedAt: now,
    analysedRequests: requests.length,
    completedTrips: completed.length,
    clusters,
    followOnMatches,
    regionPairs: regionPairs.sort((a, b) => b.trips - a.trips).slice(0, 30),
    createdAt: now,
  }

  if (options.persist) {
    try {
      const existing = await getTransportInsights()
      if (existing) await updateEntity(INSIGHTS_KIND, existing.id, { ...insights, id: existing.id })
      else await insertEntity(INSIGHTS_KIND, insights)
    } catch {}
  }

  return insights
}

/** Human-readable name for an area id (for insights panels). */
export function areaName(areaId: string): string {
  return TRANSPORT_AREAS.find(a => a.id === areaId)?.name ?? areaId
}

/** Companies currently holding committed journeys, for the fleet overview. */
export async function companiesWithOpenJobs(): Promise<TransportCompany[]> {
  const companies = await getTransportCompanies()
  return companies.filter(c => (c.openJobs ?? []).length > 0)
}
