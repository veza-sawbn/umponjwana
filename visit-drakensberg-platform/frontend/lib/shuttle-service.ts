import { useAutoDrivingDistances, type DistancePlace, type DistanceResult } from '@/components/maps/GoogleAddressField'
import type { BookingAddon, BookingState, ShuttleOption } from './booking-context'

export type LocationType = 'Accommodation' | 'Airport' | 'Hiking trail' | 'Town' | 'Attraction' | 'Landmark' | 'GPS location'
export type ShuttleType = 'Shared Shuttle' | 'Private Shuttle' | 'Premium Shuttle'

export type ShuttleLocation = {
  id: string
  name: string
  type: LocationType
  region: string
}

export type ShuttleRoute = {
  id: string
  pickupId: string
  destinationId: string
  durationMinutes: number
  vehicleType: string
  capacity: number
  shuttleTypes: ShuttleType[]
  schedules: string[]
  pricing: {
    sharedPerPerson: number
    privateBase: number
    privatePerPassenger: number
  }
}

export type ShuttleSearch = {
  pickupId: string
  destinationId: string
  date: string
  passengers: number
  shuttleType: ShuttleType
}

export const SHUTTLE_LOCATIONS: ShuttleLocation[] = [
  { id: 'jnb-or-tambo', name: 'Johannesburg OR Tambo', type: 'Airport', region: 'Gauteng' },
  { id: 'dur-king-shaka', name: 'Durban King Shaka Airport', type: 'Airport', region: 'KwaZulu-Natal' },
  { id: 'champagne-valley', name: 'Champagne Valley accommodation', type: 'Accommodation', region: 'Central Berg' },
  { id: 'cathedral-peak-hotel', name: 'Cathedral Peak Hotel', type: 'Accommodation', region: 'Northern Berg' },
  { id: 'cathedral-peak-trailhead', name: 'Cathedral Peak Trailhead', type: 'Hiking trail', region: 'Northern Berg' },
  { id: 'horse-riding-centre', name: 'Horse Riding Centre', type: 'Attraction', region: 'Central Berg' },
  { id: 'underberg-town', name: 'Underberg', type: 'Town', region: 'Southern Berg' },
  { id: 'royal-natal', name: 'Royal Natal National Park', type: 'Landmark', region: 'Northern Berg' },
]

export const SHUTTLE_ROUTES: ShuttleRoute[] = [
  { id: 'r-jnb-cathedral', pickupId: 'jnb-or-tambo', destinationId: 'cathedral-peak-hotel', durationMinutes: 300, vehicleType: 'Minibus / SUV', capacity: 7, shuttleTypes: ['Private Shuttle', 'Shared Shuttle'], schedules: ['07:30', '12:00', '16:30'], pricing: { sharedPerPerson: 1100, privateBase: 3200, privatePerPassenger: 350 } },
  { id: 'r-jnb-champagne', pickupId: 'jnb-or-tambo', destinationId: 'champagne-valley', durationMinutes: 270, vehicleType: 'Minibus / SUV', capacity: 7, shuttleTypes: ['Private Shuttle', 'Shared Shuttle'], schedules: ['08:00', '13:00', '17:00'], pricing: { sharedPerPerson: 1050, privateBase: 3000, privatePerPassenger: 320 } },
  { id: 'r-dur-champagne', pickupId: 'dur-king-shaka', destinationId: 'champagne-valley', durationMinutes: 210, vehicleType: 'Minibus', capacity: 10, shuttleTypes: ['Private Shuttle', 'Shared Shuttle'], schedules: ['09:00', '14:00'], pricing: { sharedPerPerson: 850, privateBase: 2400, privatePerPassenger: 260 } },
  { id: 'r-accom-cathedral', pickupId: 'champagne-valley', destinationId: 'cathedral-peak-trailhead', durationMinutes: 55, vehicleType: 'Touring van', capacity: 8, shuttleTypes: ['Private Shuttle', 'Shared Shuttle'], schedules: ['05:30', '06:30', '07:30'], pricing: { sharedPerPerson: 280, privateBase: 900, privatePerPassenger: 90 } },
  { id: 'r-accom-horse', pickupId: 'champagne-valley', destinationId: 'horse-riding-centre', durationMinutes: 25, vehicleType: 'Touring van', capacity: 8, shuttleTypes: ['Private Shuttle', 'Shared Shuttle'], schedules: ['08:30', '10:30', '14:00'], pricing: { sharedPerPerson: 160, privateBase: 520, privatePerPassenger: 60 } },
  { id: 'r-dur-underberg', pickupId: 'dur-king-shaka', destinationId: 'underberg-town', durationMinutes: 150, vehicleType: 'Minibus', capacity: 10, shuttleTypes: ['Private Shuttle', 'Shared Shuttle'], schedules: ['09:30', '15:00'], pricing: { sharedPerPerson: 720, privateBase: 2100, privatePerPassenger: 220 } },
]

export function calculateShuttlePrice(route: ShuttleRoute, shuttleType: ShuttleType, passengers: number) {
  if (shuttleType === 'Shared Shuttle') return route.pricing.sharedPerPerson * passengers
  return route.pricing.privateBase + route.pricing.privatePerPassenger * passengers
}

export function findAvailableRoutes(search: ShuttleSearch) {
  return SHUTTLE_ROUTES.filter(route => route.pickupId === search.pickupId && route.destinationId === search.destinationId && route.shuttleTypes.includes(search.shuttleType) && search.passengers <= route.capacity)
    .map(route => ({ route, price: calculateShuttlePrice(route, search.shuttleType, search.passengers) }))
}

export function toShuttleOption(route: ShuttleRoute, search: ShuttleSearch): ShuttleOption {
  const pickup = SHUTTLE_LOCATIONS.find(l => l.id === route.pickupId)!
  const destination = SHUTTLE_LOCATIONS.find(l => l.id === route.destinationId)!
  const price = calculateShuttlePrice(route, search.shuttleType, search.passengers)
  return {
    id: `${route.id}-${search.date}-${search.shuttleType}`,
    label: `${pickup.name} → ${destination.name}`,
    price,
    description: `${search.shuttleType} on ${search.date}. ${Math.round(route.durationMinutes / 60 * 10) / 10}h estimated travel time · ${route.vehicleType} · ${search.passengers} passenger${search.passengers !== 1 ? 's' : ''}.`,
    pickup: pickup.name,
    destination: destination.name,
    date: search.date,
    passengers: search.passengers,
    shuttleType: search.shuttleType,
    durationMinutes: route.durationMinutes,
    vehicleType: route.vehicleType,
  }
}

function locationForAddon(addon: BookingAddon) {
  const text = `${addon.title} ${addon.type}`.toLowerCase()
  if (text.includes('cathedral') || addon.type === 'hike') return 'cathedral-peak-trailhead'
  if (text.includes('horse')) return 'horse-riding-centre'
  return 'cathedral-peak-trailhead'
}

/** Addon-to-accommodation shuttle guesses from the static mock route table (used only when no real stay address is available). */
function buildAddonShuttleRecommendations(booking: BookingState): ShuttleOption[] {
  const recommendations: ShuttleOption[] = []
  const passengers = booking.guests || 2
  const accommodationId = booking.stay?.title.toLowerCase().includes('cathedral') ? 'cathedral-peak-hotel' : 'champagne-valley'

  booking.addons.forEach(addon => {
    const date = addon.date || booking.checkIn
    const destinationId = locationForAddon(addon)
    if (!date) return
    const route = SHUTTLE_ROUTES.find(r => r.pickupId === accommodationId && r.destinationId === destinationId)
    if (route && passengers <= route.capacity) recommendations.push(toShuttleOption(route, { pickupId: route.pickupId, destinationId, date, passengers, shuttleType: 'Private Shuttle' }))
  })

  return recommendations
}

/** Kept for backwards compatibility with any remaining direct callers; prefer useShuttleRecommendations(). */
export function buildContextualShuttleRecommendations(booking: BookingState): ShuttleOption[] {
  return buildAddonShuttleRecommendations(booking).filter(rec => rec.id !== booking.shuttle?.id)
}

const MAJOR_HUBS = [
  { id: 'jnb-or-tambo', name: 'OR Tambo International Airport, Johannesburg' },
  { id: 'dur-king-shaka', name: 'King Shaka International Airport, Durban' },
]

const AIRPORT_TRANSFER_RATE_PER_KM = 9
const AIRPORT_TRANSFER_MIN_FARE = 650
const AIRPORT_TRANSFER_PER_PASSENGER_KM = 1

/** Calculates a real driving-distance-based airport transfer suggestion to the guest's actual selected stay, using Google Distance Matrix. */
export function useAirportTransferRecommendation(booking: BookingState): { recommendation: ShuttleOption | null; status: 'idle' | 'calculating' | 'done' | 'error' } {
  const stay = booking.stay
  const origin: DistancePlace | null = stay
    ? { address: stay.address || `${stay.title}, ${stay.region}, South Africa`, lat: stay.lat, lng: stay.lng }
    : null
  const destinations: DistancePlace[] = MAJOR_HUBS.map(hub => ({ address: hub.name }))
  const { results, status } = useAutoDrivingDistances(origin, destinations)

  if (!stay || !booking.checkIn || status !== 'done') return { recommendation: null, status }

  type HubDistance = { hub: typeof MAJOR_HUBS[number]; result: DistanceResult }
  const best = results.reduce<HubDistance | null>((closest, result, i) => {
    if (!result) return closest
    if (!closest || result.distanceKm < closest.result.distanceKm) return { hub: MAJOR_HUBS[i], result }
    return closest
  }, null)
  if (!best) return { recommendation: null, status: 'error' }

  const passengers = booking.guests || 2
  const basePrice = Math.max(AIRPORT_TRANSFER_MIN_FARE, Math.round(best.result.distanceKm * AIRPORT_TRANSFER_RATE_PER_KM))
  const extraPassengerFee = Math.round(best.result.distanceKm * AIRPORT_TRANSFER_PER_PASSENGER_KM) * Math.max(0, passengers - 1)
  const price = basePrice + extraPassengerFee

  return {
    recommendation: {
      id: `airport-transfer-${best.hub.id}-${booking.checkIn}`,
      label: `${best.hub.name} → ${stay.title}`,
      price,
      description: `Private transfer on ${booking.checkIn}. ${best.result.distanceKm} km · ~${best.result.durationText} drive · ${passengers} passenger${passengers !== 1 ? 's' : ''}. Estimated fare based on live driving distance.`,
      pickup: best.hub.name,
      destination: stay.title,
      date: booking.checkIn,
      passengers,
      shuttleType: 'Private Shuttle',
      durationMinutes: best.result.durationMinutes,
      vehicleType: 'Minibus / SUV',
    },
    status: 'done',
  }
}

/** Combines the live airport-transfer suggestion with addon-based shuttle guesses into one ready-to-render list. */
export function useShuttleRecommendations(booking: BookingState, limit = 2): ShuttleOption[] {
  const { recommendation: airportTransfer } = useAirportTransferRecommendation(booking)
  const addonRecommendations = buildAddonShuttleRecommendations(booking)
  return [...(airportTransfer ? [airportTransfer] : []), ...addonRecommendations]
    .filter(rec => rec.id !== booking.shuttle?.id)
    .slice(0, limit)
}
