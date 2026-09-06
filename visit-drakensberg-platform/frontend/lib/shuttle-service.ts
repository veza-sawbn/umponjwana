import { useAutoDrivingDistances, type DistancePlace, type DistanceResult } from '@/components/maps/GoogleAddressField'
import type { BookingState, ShuttleOption } from './booking-context'

// ============================================================================
// Shuttle quoting — Google APIs only.
//
// Locations come from Google Places autocomplete and distances/durations from
// the Google Distance Matrix. There is no static provider, location or route
// table anywhere: fares are estimated from live driving distance, and the
// actual operator is chosen after checkout by the marketplace dispatch
// engine (lib/transport-dispatch.ts), which scores real registered transport
// suppliers for every request.
// ============================================================================

// Every transfer on the marketplace is a private vehicle hire. Registered
// operators run their own vehicles on their own rates — none of them pool
// strangers into a shared seat-by-seat service — so 'Private Shuttle' is the
// only shuttle type the platform quotes.
export type ShuttleType = 'Private Shuttle'
export const SHUTTLE_TYPES: ShuttleType[] = ['Private Shuttle']

// Marketplace guide rates used for the customer-facing estimate. Long
// transfers price at a lower per-km rate than short local hops.
const LONG_HAUL_RATE_PER_KM = 9
const LONG_HAUL_MIN_FARE = 650
const LONG_HAUL_PER_PASSENGER_KM = 1

const LOCAL_RATE_PER_KM = 12
const LOCAL_MIN_FARE = 350
const LOCAL_PER_PASSENGER_KM = 1.2

const LOCAL_TRIP_THRESHOLD_KM = 80

/** Estimate a private-transfer fare from live driving distance. */
export function estimateTransferPrice(distanceKm: number, passengers: number): number {
  const local = distanceKm <= LOCAL_TRIP_THRESHOLD_KM
  const ratePerKm = local ? LOCAL_RATE_PER_KM : LONG_HAUL_RATE_PER_KM
  const minFare = local ? LOCAL_MIN_FARE : LONG_HAUL_MIN_FARE
  const perPassengerKm = local ? LOCAL_PER_PASSENGER_KM : LONG_HAUL_PER_PASSENGER_KM

  const basePrice = Math.max(minFare, Math.round(distanceKm * ratePerKm))
  const extraPassengerFee = Math.round(distanceKm * perPassengerKm) * Math.max(0, passengers - 1)
  return basePrice + extraPassengerFee
}

export function suggestedVehicleType(passengers: number): string {
  if (passengers <= 3) return 'Sedan / SUV'
  if (passengers <= 8) return 'Minibus / SUV'
  if (passengers <= 14) return 'Minibus'
  return 'Coach'
}

/** The transport partner + vehicle the customer picked for this transfer. */
export type ShuttleSupplierChoice = {
  supplierId: string
  companyId: string
  companyName: string
  vehicleId: string
  vehicleName: string
  price: number
}

/** Build a cart-ready shuttle option from a live Google Distance Matrix result. */
export function buildShuttleOption(params: {
  id: string
  pickup: DistancePlace
  destination: DistancePlace
  date: string
  passengers: number
  shuttleType?: ShuttleType
  result: DistanceResult
  supplier?: ShuttleSupplierChoice
}): ShuttleOption {
  const { id, pickup, destination, date, passengers, result, supplier } = params
  const shuttleType: ShuttleType = params.shuttleType ?? 'Private Shuttle'
  const price = supplier?.price ?? estimateTransferPrice(result.distanceKm, passengers)
  const operatedBy = supplier
    ? `Operated by ${supplier.companyName} (${supplier.vehicleName}).`
    : 'Operated by a matched local transport partner.'
  return {
    id,
    label: `${pickup.address} → ${destination.address}`,
    price,
    description: `${shuttleType} on ${date}. ${result.distanceKm} km · ~${result.durationText} drive · ${passengers} passenger${passengers !== 1 ? 's' : ''}. ${operatedBy}`,
    pickup: pickup.address,
    destination: destination.address,
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    destinationLat: destination.lat,
    destinationLng: destination.lng,
    supplierId: supplier?.supplierId,
    companyId: supplier?.companyId,
    companyName: supplier?.companyName,
    vehicleId: supplier?.vehicleId,
    vehicleName: supplier?.vehicleName,
    date,
    passengers,
    shuttleType,
    durationMinutes: result.durationMinutes,
    vehicleType: supplier?.vehicleName ?? suggestedVehicleType(passengers),
    distanceKm: result.distanceKm,
    durationText: result.durationText,
  }
}

// The two long-haul anchors most guests arrive through. Used only as Distance
// Matrix *queries* (Google resolves them) — never as a route table. The
// coordinates let the dispatch engine rank transport partners for the
// suggested airport transfer.
const MAJOR_HUBS = [
  { id: 'jnb-or-tambo', name: 'OR Tambo International Airport, Johannesburg', lat: '-26.1367', lng: '28.2411' },
  { id: 'dur-king-shaka', name: 'King Shaka International Airport, Durban', lat: '-29.6144', lng: '31.1197' },
]

function addonPlace(addon: BookingState['addons'][number]): DistancePlace | null {
  if (!addon.location && !(addon.lat && addon.lng)) return null
  return { address: `${addon.location || addon.title}, South Africa`, lat: addon.lat, lng: addon.lng }
}

/** True when the guest already has a shuttle that delivers them to the stay
 *  (picked from this recommendation, or arranged manually via /checkout/shuttle
 *  — which stores a longer `stay.address`-based destination string rather
 *  than the bare `stay.title` this hook generates), so the airport-transfer
 *  suggestion shouldn't be repeated. */
function airportLegCovered(shuttles: ShuttleOption[], stay: NonNullable<BookingState['stay']>): boolean {
  return shuttles.some(shuttle => {
    if (shuttle.destination === stay.title) return true
    if (shuttle.destination?.includes(stay.title)) return true
    if (stay.lat && stay.lng && shuttle.destinationLat === stay.lat && shuttle.destinationLng === stay.lng) return true
    return false
  })
}

/**
 * Live shuttle recommendations for the trip cart: the nearest major airport →
 * stay transfer, plus one stay → activity transfer per addon that has
 * location data, all quoted from one batched Google Distance Matrix request
 * against the guest's actual locations. Addons without any location data are
 * simply skipped — there is no static fallback table. The airport leg drops
 * out once it's already covered by a chosen shuttle, but every local
 * (stay → activity) leg keeps being suggested independently — selecting an
 * airport transfer must never hide the rest.
 */
export function useShuttleRecommendations(booking: BookingState, limit = 8): ShuttleOption[] {
  const stay = booking.stay
  const passengers = booking.guests || 2
  const addonsWithLocation = booking.addons.filter(a => addonPlace(a) !== null)

  const origin: DistancePlace | null = stay
    ? { address: stay.address || `${stay.title}, ${stay.region}, South Africa`, lat: stay.lat, lng: stay.lng }
    : null
  const destinations: DistancePlace[] = [
    ...MAJOR_HUBS.map(hub => ({ address: hub.name })),
    ...addonsWithLocation.map(addon => addonPlace(addon)!),
  ]
  const { results, status } = useAutoDrivingDistances(origin, destinations)

  const recommendations: ShuttleOption[] = []
  if (!stay || status !== 'done') return recommendations

  if (booking.checkIn && !airportLegCovered(booking.shuttles, stay)) {
    type HubDistance = { hub: typeof MAJOR_HUBS[number]; result: DistanceResult }
    const best = results.slice(0, MAJOR_HUBS.length).reduce<HubDistance | null>((closest, result, i) => {
      if (!result) return closest
      if (!closest || result.distanceKm < closest.result.distanceKm) return { hub: MAJOR_HUBS[i], result }
      return closest
    }, null)

    if (best) {
      recommendations.push(buildShuttleOption({
        id: `airport-transfer-${best.hub.id}-${booking.checkIn}`,
        pickup: { address: best.hub.name, lat: best.hub.lat, lng: best.hub.lng },
        destination: { address: stay.title, lat: stay.lat, lng: stay.lng },
        date: booking.checkIn,
        passengers,
        shuttleType: 'Private Shuttle',
        result: best.result,
      }))
    }
  }

  // One recommendation per activity/hike/tour/event the guest has added —
  // every addon with a location gets its own stay → activity transfer quote.
  addonsWithLocation.forEach((addon, i) => {
    const result = results[MAJOR_HUBS.length + i]
    const date = addon.date || booking.checkIn
    if (!result || !date) return
    recommendations.push(buildShuttleOption({
      id: `addon-transfer-${addon.id}`,
      pickup: { address: stay.title, lat: stay.lat, lng: stay.lng },
      destination: { address: addon.title, lat: addon.lat, lng: addon.lng },
      date,
      passengers: addon.guests || passengers,
      shuttleType: 'Private Shuttle',
      result,
    }))
  })

  return recommendations
    .filter(rec => !booking.shuttles.some(sh => sh.id === rec.id))
    .slice(0, limit)
}
