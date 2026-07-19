import { newEntityId } from './entities'
import { notify } from './notifications'
import type { SavedBooking } from './bookings'
import {
  areaForPoint, classifyTrip, companyAvgResponseMinutes, companyRating, companyReliability,
  driverAvailable, eligibleCategories, getFleet, getTransportCompanies, haversineKm,
  insertTransportRequest, pointCoords, vehicleAvailableOn, vehicleSeats,
  type GeoPoint, type MeetAndGreetDetails, type OfferBreakdownLine, type SupplierCategory,
  type TransportCompany, type TransportDriver, type TransportOffer, type TransportRequest,
  type TransportVehicle, type TripClass,
} from './transport'

// ============================================================================
// Dispatch engine — when a transport request is generated, every approved
// transport company is scored for suitability instead of being picked
// randomly or from a fixed provider table. The highest-ranked eligible
// suppliers receive the booking opportunity (acceptance workflow by default;
// auto-assignment and competitive quotation can build on the same ranking).
// ============================================================================

/** How many top-ranked suppliers receive the opportunity simultaneously. */
export const OFFER_SHORTLIST_SIZE = 3

export type ScoredCandidate = {
  company: TransportCompany
  eligible: boolean
  reasons: string[]           // why a company was excluded
  score: number
  breakdown: OfferBreakdownLine[]
  vehicles: TransportVehicle[]
  bestVehicle: TransportVehicle | null
  availableDrivers: number
}

export type DispatchInput = {
  pickup: GeoPoint
  dropoff: GeoPoint
  date: string
  time?: string
  passengers: number
  distanceKm?: number
  quotedPrice: number
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Proximity curve: full points at 0 km, none from `zeroAtKm` onward. */
function proximityScore(km: number | null, zeroAtKm: number): number {
  if (km === null) return 0.4 // unknown location: mild neutral credit
  return clamp01(1 - km / zeroAtKm)
}

function vehicleSuitability(vehicle: TransportVehicle, tripClass: TripClass, passengers: number): number {
  const seats = vehicleSeats(vehicle)
  if (seats < passengers) return 0
  // Capacity fit: right-sized vehicles beat sending a bus for two people.
  const fit = clamp01(1 - (seats - passengers) / 18)
  // Class fit: 4×4s shine on valley/trailhead work, buses on long gateway runs.
  const type = (vehicle.type ?? '').toLowerCase()
  let classFit = 0.7
  if (tripClass === 'local' && (type.includes('4') || type.includes('van') || type.includes('shuttle'))) classFit = 1
  if (tripClass === 'regional' && (type.includes('minibus') || type.includes('shuttle') || type.includes('van'))) classFit = 1
  if (tripClass === 'gateway' && (type.includes('minibus') || type.includes('bus') || type.includes('sedan') || type.includes('suv'))) classFit = 1
  return 0.5 + 0.25 * fit + 0.25 * classFit
}

/**
 * Score one company for a request. Weighted factors (max 100 before the
 * follow-on bonus):
 *   region coverage 15 · category fit 10 · vehicle capacity/suitability 15
 *   home-base proximity 12 · current vehicle location 10 · fleet slack 5
 *   driver availability 5 · existing-day load 5 · reliability 8
 *   response time 5 · customer rating 5 · price competitiveness 5
 *   + follow-on bonus up to 15 when the company is already travelling into
 *     the pickup area (so nearby follow-on work beats a distant cold start).
 */
export function scoreCompany(
  company: TransportCompany,
  vehicles: TransportVehicle[],
  drivers: TransportDriver[],
  input: DispatchInput,
  tripClass: TripClass,
  medianRatePerKm: number,
): ScoredCandidate {
  const reasons: string[] = []
  const breakdown: OfferBreakdownLine[] = []
  const add = (factor: string, points: number, max: number, note?: string) => {
    const line = { factor, points: Math.round(points * 10) / 10, max, note }
    breakdown.push(line)
    return line.points
  }

  const pickupCoords = pointCoords(input.pickup)
  const pickupArea = areaForPoint(input.pickup)
  const dropArea = areaForPoint(input.dropoff)
  const homeCoords = pointCoords(company.homeBase)

  // ── Hard eligibility ──
  if (company.status !== 'active') reasons.push('Profile not active')

  const categories = eligibleCategories(tripClass)
  if (!categories.includes(company.category)) {
    reasons.push(`${company.category} operators are not eligible for ${tripClass} trips`)
  }

  // Region coverage: the company must serve the pickup or drop-off — either a
  // declared service area, or within its operating radius of home base.
  const servesArea = (pickupArea && company.serviceAreaIds.includes(pickupArea.id))
    || (dropArea && company.serviceAreaIds.includes(dropArea.id))
  const homeToPickupKm = homeCoords && pickupCoords
    ? haversineKm(homeCoords.lat, homeCoords.lng, pickupCoords.lat, pickupCoords.lng)
    : null
  const withinRadius = homeToPickupKm !== null && homeToPickupKm <= (company.operatingRadiusKm || 100)
  if (!servesArea && !withinRadius) reasons.push('Outside service regions and operating radius')

  const usableVehicles = vehicles.filter(v => vehicleAvailableOn(v, input.date) && vehicleSeats(v) >= input.passengers)
  if (usableVehicles.length === 0) reasons.push('No available vehicle with enough seats on that date')

  const availableDrivers = drivers.filter(driverAvailable).length
  if (availableDrivers === 0) reasons.push('No available driver')

  const eligible = reasons.length === 0

  // ── Weighted score (still computed for excluded companies so the admin
  //    console can show near-misses) ──
  let score = 0

  score += add('Region coverage', (servesArea ? 1 : withinRadius ? 0.6 : 0) * 15, 15,
    servesArea ? 'Declared service area' : withinRadius ? 'Within operating radius' : 'Not covered')

  const categoryRank = categories.indexOf(company.category)
  score += add('Category fit', (categoryRank === 0 ? 1 : categoryRank > 0 ? 0.55 : 0) * 10, 10,
    categoryRank === 0 ? `${tripClass} trip — native category` : undefined)

  const bestVehicle = usableVehicles
    .map(v => ({ v, s: vehicleSuitability(v, tripClass, input.passengers) }))
    .sort((a, b) => b.s - a.s)[0] ?? null
  score += add('Vehicle capacity & suitability', (bestVehicle?.s ?? 0) * 15, 15,
    bestVehicle ? `${bestVehicle.v.name ?? bestVehicle.v.type ?? 'Vehicle'} (${vehicleSeats(bestVehicle.v)} seats)` : 'No usable vehicle')

  score += add('Distance from home base', proximityScore(homeToPickupKm, 320) * 12, 12,
    homeToPickupKm !== null ? `${homeToPickupKm} km from pickup` : 'Unknown')

  // Current location of the nearest available vehicle (falls back to home base).
  let vehicleKm: number | null = homeToPickupKm
  for (const v of usableVehicles) {
    const loc = pointCoords(v.currentLocation) ?? homeCoords
    if (loc && pickupCoords) {
      const km = haversineKm(loc.lat, loc.lng, pickupCoords.lat, pickupCoords.lng)
      if (vehicleKm === null || km < vehicleKm) vehicleKm = km
    }
  }
  score += add('Current vehicle location', proximityScore(vehicleKm, 250) * 10, 10,
    vehicleKm !== null ? `nearest vehicle ${vehicleKm} km away` : 'Unknown')

  score += add('Vehicle availability', clamp01(usableVehicles.length / 3) * 5, 5,
    `${usableVehicles.length} vehicle${usableVehicles.length === 1 ? '' : 's'} free`)

  score += add('Driver availability', clamp01(availableDrivers / 3) * 5, 5,
    `${availableDrivers} driver${availableDrivers === 1 ? '' : 's'} free`)

  const jobsThatDay = (company.openJobs ?? []).filter(j => j.date === input.date).length
  const fleetSize = Math.max(1, vehicles.length)
  score += add('Existing bookings', clamp01(1 - jobsThatDay / fleetSize) * 5, 5,
    jobsThatDay ? `${jobsThatDay} job${jobsThatDay === 1 ? '' : 's'} already on ${input.date}` : 'Clear schedule')

  score += add('Historical reliability', companyReliability(company) * 8, 8,
    `${company.stats?.completedTrips ?? 0} completed / ${company.stats?.cancelledTrips ?? 0} cancelled`)

  const avgResponse = companyAvgResponseMinutes(company)
  score += add('Response time', (avgResponse === null ? 0.6 : clamp01(1 - avgResponse / 240)) * 5, 5,
    avgResponse === null ? 'No history yet' : `avg ${avgResponse} min to respond`)

  score += add('Customer rating', clamp01(companyRating(company) / 5) * 5, 5, `${companyRating(company)} / 5`)

  const rate = company.ratePerKm || medianRatePerKm
  const priceFactor = medianRatePerKm > 0 ? clamp01(1 - (rate - medianRatePerKm) / medianRatePerKm) : 0.5
  score += add('Price competitiveness', priceFactor * 5, 5, `R${rate}/km vs R${medianRatePerKm}/km median`)

  // ── Follow-on bonus: already travelling into the pickup area on that date?
  //    Prioritise this company over one starting cold from a distant city. ──
  let followOn = 0
  let followOnNote: string | undefined
  for (const job of company.openJobs ?? []) {
    if (job.date !== input.date) continue
    if (job.dropLat === undefined || job.dropLng === undefined || !pickupCoords) continue
    const km = haversineKm(job.dropLat, job.dropLng, pickupCoords.lat, pickupCoords.lng)
    const bonus = clamp01(1 - km / 60) * 15
    if (bonus > followOn) {
      followOn = bonus
      followOnNote = `Existing trip ends ${km} km from this pickup on ${job.date}`
    }
  }
  score += add('Return-journey / follow-on', followOn, 15, followOnNote ?? 'No inbound journey that day')

  return {
    company,
    eligible,
    reasons,
    score: Math.round(score * 10) / 10,
    breakdown,
    vehicles,
    bestVehicle: bestVehicle?.v ?? null,
    availableDrivers,
  }
}

/** Load every transport company with its fleet and rank them for a request. */
export async function rankSuppliers(input: DispatchInput): Promise<{ tripClass: TripClass; candidates: ScoredCandidate[] }> {
  const tripClass = classifyTrip(input.distanceKm, input.pickup, input.dropoff)
  const companies = await getTransportCompanies()
  const fleets = await Promise.all(companies.map(c => getFleet(c.supplierId)))

  const rates = companies.map(c => c.ratePerKm).filter(r => r > 0).sort((a, b) => a - b)
  const medianRatePerKm = rates.length ? rates[Math.floor(rates.length / 2)] : 10

  const candidates = companies
    .map((company, i) => scoreCompany(company, fleets[i].vehicles, fleets[i].drivers, input, tripClass, medianRatePerKm))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)

  return { tripClass, candidates }
}

/** Customer's chosen transport partner + vehicle, made at booking time. */
export type PreselectedSupplier = {
  supplierId: string
  companyId: string
  companyName: string
  category: SupplierCategory
  vehicleId?: string
  vehicleName?: string
}

/**
 * Create a transport request. When the customer preselected a supplier (the
 * normal booking journey), the job goes directly and only to that company —
 * with the chosen vehicle noted — and it just has to accept. Otherwise the
 * engine ranks all suppliers and offers the job to the top of the ranking.
 * Returns the stored request (status `offered`, or `unassigned` when no
 * eligible supplier exists yet — admins see those).
 */
export async function createTransportRequest(params: {
  userId: string
  customerName?: string
  bookingId?: string
  bookingReference?: string
  pickup: GeoPoint
  dropoff: GeoPoint
  date: string
  time?: string
  passengers: number
  shuttleType?: string
  distanceKm?: number
  durationMinutes?: number
  quotedPrice: number
  preselected?: PreselectedSupplier
  meetAndGreet?: MeetAndGreetDetails
}): Promise<TransportRequest> {
  const input: DispatchInput = {
    pickup: params.pickup, dropoff: params.dropoff, date: params.date, time: params.time,
    passengers: params.passengers, distanceKm: params.distanceKm, quotedPrice: params.quotedPrice,
  }
  const { tripClass, candidates } = await rankSuppliers(input)
  const now = new Date().toISOString()

  let offers: TransportOffer[]
  if (params.preselected) {
    const scored = candidates.find(c => c.company.supplierId === params.preselected!.supplierId)
    offers = [{
      supplierId: params.preselected.supplierId,
      companyId: params.preselected.companyId,
      companyName: params.preselected.companyName,
      category: params.preselected.category,
      score: scored?.score ?? 0,
      rank: 1,
      breakdown: scored?.breakdown ?? [],
      offeredAt: now,
    }]
  } else {
    offers = candidates
      .filter(c => c.eligible)
      .map((c, i) => ({
        supplierId: c.company.supplierId,
        companyId: c.company.id,
        companyName: c.company.companyName,
        category: c.company.category,
        score: c.score,
        rank: i + 1,
        breakdown: c.breakdown,
        offeredAt: i < OFFER_SHORTLIST_SIZE ? now : undefined,
      }))
  }

  const notified = offers.filter(o => o.offeredAt)

  const request: TransportRequest = {
    id: newEntityId('trq'),
    bookingId: params.bookingId,
    bookingReference: params.bookingReference,
    userId: params.userId,
    customerName: params.customerName,
    status: notified.length > 0 ? 'offered' : 'unassigned',
    pickup: params.pickup,
    dropoff: params.dropoff,
    date: params.date,
    time: params.time,
    passengers: params.passengers,
    shuttleType: params.shuttleType,
    distanceKm: params.distanceKm,
    durationMinutes: params.durationMinutes,
    tripClass,
    quotedPrice: params.quotedPrice,
    requestedVehicleId: params.preselected?.vehicleId,
    requestedVehicleName: params.preselected?.vehicleName,
    meetAndGreet: params.meetAndGreet,
    offers,
    createdAt: now,
  }

  await insertTransportRequest(request, notified.map(o => o.supplierId))

  if (params.preselected) {
    await notify(params.preselected.supplierId, 'booking',
      'You were booked for a transfer',
      `${params.customerName ?? 'A guest'} chose ${params.preselected.companyName}${params.preselected.vehicleName ? ` (${params.preselected.vehicleName})` : ''} for ${params.pickup.address} → ${params.dropoff.address} on ${params.date} · ${params.passengers} pax · R${params.quotedPrice.toLocaleString()}. Accept the job to reserve the vehicle.`,
      '/supplier/jobs')
  } else {
    await Promise.all(notified.map(o =>
      notify(o.supplierId, 'booking',
        'New transfer opportunity',
        `${params.pickup.address} → ${params.dropoff.address} on ${params.date} · ${params.passengers} pax · R${params.quotedPrice.toLocaleString()}. You ranked #${o.rank} of ${offers.length} for this trip.`,
        '/supplier/jobs')
    ))
  }

  return request
}

/**
 * Every shuttle on a customer itinerary becomes a transport request so the
 * job ultimately belongs to a real supplier. Called from addBooking().
 */
export async function createTransportRequestForBooking(booking: SavedBooking): Promise<TransportRequest | null> {
  const shuttle = booking.shuttle
  if (!shuttle) return null

  // The customer picked a supplier + vehicle during the booking journey —
  // route the job straight to them.
  let preselected: PreselectedSupplier | undefined
  if (shuttle.supplierId && shuttle.companyId && shuttle.companyName) {
    const companies = await getTransportCompanies()
    const company = companies.find(c => c.id === shuttle.companyId)
    preselected = {
      supplierId: shuttle.supplierId,
      companyId: shuttle.companyId,
      companyName: shuttle.companyName,
      category: company?.category ?? 'regional',
      vehicleId: shuttle.vehicleId,
      vehicleName: shuttle.vehicleName,
    }
  }

  return createTransportRequest({
    preselected,
    userId: booking.userId,
    customerName: booking.customerName,
    bookingId: booking.id,
    bookingReference: booking.reference,
    pickup: { address: shuttle.pickup ?? shuttle.label, lat: shuttle.pickupLat, lng: shuttle.pickupLng },
    dropoff: { address: shuttle.destination ?? booking.stay?.title ?? booking.region, lat: shuttle.destinationLat, lng: shuttle.destinationLng },
    date: shuttle.date || booking.checkIn,
    time: shuttle.meetAndGreet?.arrivalTime,
    meetAndGreet: shuttle.meetAndGreet,
    passengers: shuttle.passengers ?? booking.guests,
    shuttleType: shuttle.shuttleType,
    distanceKm: shuttle.distanceKm,
    durationMinutes: shuttle.durationMinutes,
    quotedPrice: shuttle.price,
  })
}
