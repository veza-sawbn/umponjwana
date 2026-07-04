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

// Local transfers (stay to activity meeting point) cost more per km than long airport runs, with a lower minimum.
const LOCAL_TRANSFER_RATE_PER_KM = 12
const LOCAL_TRANSFER_MIN_FARE = 350
const LOCAL_TRANSFER_PER_PASSENGER_KM = 1.2

function priceForDistance(distanceKm: number, passengers: number, ratePerKm: number, minFare: number, perPassengerKm: number) {
  const basePrice = Math.max(minFare, Math.round(distanceKm * ratePerKm))
  const extraPassengerFee = Math.round(distanceKm * perPassengerKm) * Math.max(0, passengers - 1)
  return basePrice + extraPassengerFee
}

function hasLocation(addon: BookingAddon) {
  return Boolean(addon.location || (addon.lat && addon.lng))
}

/**
 * Combines a live airport-transfer suggestion and live stay-to-activity transfer suggestions
 * (calculated from real driving distance to the guest's actual selected stay and each addon's
 * real location, in one batched Distance Matrix request) with mock route-table guesses for any
 * addon that has no location data on record. Ready-to-render, capped at `limit`.
 */
export function useShuttleRecommendations(booking: BookingState, limit = 2): ShuttleOption[] {
  const stay = booking.stay
  const passengers = booking.guests || 2
  const addonsWithLocation = booking.addons.filter(hasLocation)
  const addonsWithoutLocation = booking.addons.filter(a => !hasLocation(a))

  const origin: DistancePlace | null = stay
    ? { address: stay.address || `${stay.title}, ${stay.region}, South Africa`, lat: stay.lat, lng: stay.lng }
    : null
  const destinations: DistancePlace[] = [
    ...MAJOR_HUBS.map(hub => ({ address: hub.name })),
    ...addonsWithLocation.map(addon => ({ address: `${addon.location || addon.title}, South Africa`, lat: addon.lat, lng: addon.lng })),
  ]
  const { results, status } = useAutoDrivingDistances(origin, destinations)

  const liveRecommendations: ShuttleOption[] = []

  if (stay && booking.checkIn && status === 'done') {
    type HubDistance = { hub: typeof MAJOR_HUBS[number]; result: DistanceResult }
    const best = results.slice(0, MAJOR_HUBS.length).reduce<HubDistance | null>((closest, result, i) => {
      if (!result) return closest
      if (!closest || result.distanceKm < closest.result.distanceKm) return { hub: MAJOR_HUBS[i], result }
      return closest
    }, null)

    if (best) {
      const price = priceForDistance(best.result.distanceKm, passengers, AIRPORT_TRANSFER_RATE_PER_KM, AIRPORT_TRANSFER_MIN_FARE, AIRPORT_TRANSFER_PER_PASSENGER_KM)
      liveRecommendations.push({
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
        distanceKm: best.result.distanceKm,
        durationText: best.result.durationText,
      })
    }
  }

  if (stay && status === 'done') {
    addonsWithLocation.forEach((addon, i) => {
      const result = results[MAJOR_HUBS.length + i]
      const date = addon.date || booking.checkIn
      if (!result || !date) return
      const addonPassengers = addon.guests || passengers
      const price = priceForDistance(result.distanceKm, addonPassengers, LOCAL_TRANSFER_RATE_PER_KM, LOCAL_TRANSFER_MIN_FARE, LOCAL_TRANSFER_PER_PASSENGER_KM)
      liveRecommendations.push({
        id: `addon-transfer-${addon.id}`,
        label: `${stay.title} → ${addon.title}`,
        price,
        description: `Private transfer on ${date}. ${result.distanceKm} km · ~${result.durationText} drive · ${addonPassengers} passenger${addonPassengers !== 1 ? 's' : ''}. Estimated fare based on live driving distance.`,
        pickup: stay.title,
        destination: addon.title,
        date,
        passengers: addonPassengers,
        shuttleType: 'Private Shuttle',
        durationMinutes: result.durationMinutes,
        vehicleType: 'Touring van',
        distanceKm: result.distanceKm,
        durationText: result.durationText,
      })
    })
  }

  const fallbackRecommendations = buildAddonShuttleRecommendations({ ...booking, addons: addonsWithoutLocation })

  return [...liveRecommendations, ...fallbackRecommendations]
    .filter(rec => rec.id !== booking.shuttle?.id)
    .slice(0, limit)
}
