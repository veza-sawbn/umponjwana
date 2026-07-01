import type { BookingState } from './booking-context'

export type DestinationCategory = 'destination' | 'attraction' | 'nature' | 'experience' | 'summer' | 'winter'

export type Coordinates = {
  lat: number
  lng: number
}

export type DestinationNode = {
  id: string
  slug: string
  name: string
  region: string
  subRegion: string
  town: string
  category: DestinationCategory
  coordinates: Coordinates
  summary: string
  history: string
  culture: string
  wildlife: string
  landscape: string
  attractions: string[]
  towns: string[]
  villages: string[]
  nearbyRegionSlugs: string[]
  travelInfo: string[]
  mapLabel: string
}

export type ContextualRecommendation = {
  id: string
  title: string
  category: 'Accommodation' | 'Activity' | 'Guided Tour' | 'Experience' | 'Event' | 'Restaurant' | 'Trail' | 'Transport'
  region: string
  town: string
  coordinates: Coordinates
  href: string
  price?: number
  supplierRating?: number
  availability: 'Available for your dates' | 'Check schedule' | 'Seasonal'
  distanceKm: number
  travelTimeMinutes: number
}

export const PRIMARY_NAVIGATION = [
  {
    label: 'Destinations',
    href: '/regions',
    items: ['Holiday Destinations', 'Cities & Towns', 'Summer Destinations', 'Winter Destinations', 'Family Destinations', 'Regions', 'View All Destinations'],
  },
  {
    label: 'Attractions',
    href: '/nature-reserves',
    items: ['Top Attractions', 'UNESCO Heritage', 'Museums', 'Historical Sites', 'Scenic Routes', 'Culture & Heritage', 'Nature Reserves', 'View All Attractions'],
  },
  {
    label: 'Nature',
    href: '/hikes',
    items: ['Mountains', 'Rivers', 'Waterfalls', 'Nature Reserves', 'Scenic Landscapes', 'Wildlife', 'Geology', 'View All Nature'],
  },
  {
    label: 'Experiences',
    href: '/activities',
    items: ['Cities & Culture', 'Architecture', 'Photography', 'Museums', 'Cultural Experiences', 'Food & Drink', 'Events', 'Family Experiences', 'Group Experiences', 'Wedding Experiences', 'Adventure Experiences', 'Read All'],
  },
  {
    label: 'Summer',
    href: '/hikes',
    items: ['Hiking', 'Mountain Biking', 'Adventure Activities', 'Water Activities', 'Nature Walks', 'Excursions', 'Read All'],
  },
  {
    label: 'Winter',
    href: '/stories',
    items: ['Snow', 'Winter Hiking', 'Snow Adventures', 'Mountain Experiences', 'Seasonal Events', 'Read All'],
  },
]

export const DESTINATIONS: DestinationNode[] = [
  {
    id: 'champagne-valley',
    slug: 'champagne-valley',
    name: 'Champagne Valley',
    region: 'Central Berg',
    subRegion: 'Cathedral Peak & Champagne Valley',
    town: 'Winterton',
    category: 'destination',
    coordinates: { lat: -28.996, lng: 29.438 },
    summary: 'A scenic resort corridor for families, hikers, photographers and soft-adventure travellers beneath Cathkin Peak and Champagne Castle.',
    history: 'Long used as a gateway into Cathedral Peak and the upper valleys, Champagne Valley grew around mountain hotels, farms and conservation access routes.',
    culture: 'The valley connects farm hospitality, Drakensberg Boys Choir performances, craft producers and San rock-art interpretation.',
    wildlife: 'Grassland birding, eland sightings and raptor viewing are common, with bearded vulture habitat in the high Berg.',
    landscape: 'Open foothills, basalt cliffs, river valleys and wide sunrise views define the Central Berg landscape.',
    attractions: ['Drakensberg Boys Choir', 'Monks Cowl', 'Cathkin Peak', 'Falcon Ridge', 'Champagne Castle'],
    towns: ['Winterton', 'Bergville', 'Estcourt'],
    villages: ['Champagne Valley', 'Cathkin Park'],
    nearbyRegionSlugs: ['north-berg', 'south-berg'],
    travelInfo: ['Best for first-time visitors', 'Good base for families', 'Strong access to activities and guided hikes'],
    mapLabel: 'Central Berg hub',
  },
  {
    id: 'cathedral-peak',
    slug: 'cathedral-peak',
    name: 'Cathedral Peak',
    region: 'Central Berg',
    subRegion: 'Cathedral Peak Wilderness',
    town: 'Winterton',
    category: 'nature',
    coordinates: { lat: -28.943, lng: 29.204 },
    summary: 'A dramatic mountain destination for guided hiking, photography, waterfalls and high-Berg scenery.',
    history: 'Cathedral Peak is one of the Drakensberg’s classic mountain landmarks and a long-standing hub for guided walks and mountain hospitality.',
    culture: 'The surrounding valleys contain important San rock-art heritage and long-established mountain guiding traditions.',
    wildlife: 'Look for eland, mountain reedbuck, jackal buzzards and high-altitude raptors.',
    landscape: 'Needle-like peaks, sandstone foothills, basalt escarpment walls and waterfall-fed ravines.',
    attractions: ['Cathedral Peak Summit', 'Rainbow Gorge', 'Doreen Falls', 'Sherman’s Cave'],
    towns: ['Winterton', 'Bergville'],
    villages: ['Cathedral Peak', 'Didima'],
    nearbyRegionSlugs: ['champagne-valley', 'north-berg'],
    travelInfo: ['Best with early starts', 'Guides recommended for summit routes', 'Weather changes quickly'],
    mapLabel: 'Mountain hiking hub',
  },
  {
    id: 'underberg-himeville',
    slug: 'underberg-himeville',
    name: 'Underberg & Himeville',
    region: 'South Berg',
    subRegion: 'Sani Pass Gateway',
    town: 'Underberg',
    category: 'destination',
    coordinates: { lat: -29.791, lng: 29.494 },
    summary: 'A southern Drakensberg base for Sani Pass, trout waters, rural hospitality and wilderness access.',
    history: 'These gateway towns developed around farming, mountain passes and access to the southern wilderness areas.',
    culture: 'Expect country pubs, local museums, farm stays and cross-border mountain-route stories.',
    wildlife: 'Wetlands, grasslands and mountain slopes support cranes, antelope and excellent birding.',
    landscape: 'Rolling foothills, cold rivers, sandstone ridges and the dramatic climb to Lesotho.',
    attractions: ['Sani Pass', 'Himeville Museum', 'Mkhomazi Wilderness', 'Garden Castle'],
    towns: ['Underberg', 'Himeville'],
    villages: ['Pevensey', 'Sani Valley'],
    nearbyRegionSlugs: ['central-berg'],
    travelInfo: ['Best for Sani Pass tours', 'Cool winter mornings', '4x4 routes require planning'],
    mapLabel: 'Southern Berg gateway',
  },
]

export const DESTINATION_RECOMMENDATIONS: Omit<ContextualRecommendation, 'distanceKm' | 'travelTimeMinutes'>[] = [
  { id: 'stay-champagne', title: 'Champagne Valley Mountain Lodge', category: 'Accommodation', region: 'Central Berg', town: 'Champagne Valley', coordinates: { lat: -29.001, lng: 29.429 }, href: '/stays/champagne-lodge', price: 1450, supplierRating: 4.8, availability: 'Available for your dates' },
  { id: 'quad-biking', title: 'Quad Biking Adventure', category: 'Activity', region: 'Central Berg', town: 'Champagne Valley', coordinates: { lat: -28.974, lng: 29.463 }, href: '/activities/a1', price: 650, supplierRating: 4.7, availability: 'Available for your dates' },
  { id: 'horse-riding', title: 'Horse Riding Centre', category: 'Activity', region: 'Central Berg', town: 'Champagne Valley', coordinates: { lat: -28.989, lng: 29.450 }, href: '/activities/horse-riding', price: 350, supplierRating: 4.6, availability: 'Available for your dates' },
  { id: 'cathedral-hike', title: 'Cathedral Peak Guided Hike', category: 'Guided Tour', region: 'Central Berg', town: 'Cathedral Peak', coordinates: { lat: -28.943, lng: 29.204 }, href: '/guides/cathedral-peak', price: 850, supplierRating: 4.9, availability: 'Check schedule' },
  { id: 'choir-event', title: 'Drakensberg Boys Choir', category: 'Event', region: 'Central Berg', town: 'Winterton', coordinates: { lat: -29.009, lng: 29.457 }, href: '/events/boys-choir', price: 220, supplierRating: 4.9, availability: 'Seasonal' },
  { id: 'valley-restaurant', title: 'Valley Farm Restaurant', category: 'Restaurant', region: 'Central Berg', town: 'Champagne Valley', coordinates: { lat: -28.993, lng: 29.444 }, href: '/activities/food-drink', price: 180, supplierRating: 4.5, availability: 'Available for your dates' },
  { id: 'monks-cowl-trail', title: 'Monks Cowl Nature Walk', category: 'Trail', region: 'Central Berg', town: 'Champagne Valley', coordinates: { lat: -29.024, lng: 29.399 }, href: '/hikes/monks-cowl', supplierRating: 4.8, availability: 'Available for your dates' },
  { id: 'private-transfer', title: 'Airport Private Transfer', category: 'Transport', region: 'Central Berg', town: 'Champagne Valley', coordinates: { lat: -28.996, lng: 29.438 }, href: '/shuttles', price: 3640, supplierRating: 4.8, availability: 'Available for your dates' },
]

export function distanceKm(a: Coordinates, b: Coordinates) {
  const earthRadiusKm = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10
}

export function getDestinationBySlug(slug: string) {
  return DESTINATIONS.find(destination => destination.slug === slug)
}

export function getDestinationForContext(booking: BookingState, fallbackSlug = 'champagne-valley') {
  const stayTitle = booking.stay?.title.toLowerCase() || ''
  if (stayTitle.includes('cathedral')) return getDestinationBySlug('cathedral-peak')!
  if (booking.region.toLowerCase().includes('south')) return getDestinationBySlug('underberg-himeville')!
  if (booking.region.toLowerCase().includes('central') || stayTitle) return getDestinationBySlug('champagne-valley')!
  return getDestinationBySlug(fallbackSlug)!
}

export function buildDestinationRecommendations(booking: BookingState, destination: DestinationNode) {
  const reference = booking.stay?.title
    ? destination.coordinates
    : destination.coordinates

  return DESTINATION_RECOMMENDATIONS
    .filter(item => item.region === destination.region || item.category === 'Transport')
    .map(item => {
      const km = distanceKm(reference, item.coordinates)
      return {
        ...item,
        distanceKm: km,
        travelTimeMinutes: Math.max(5, Math.round((km / 45) * 60)),
        availability: booking.checkIn ? item.availability : 'Check schedule',
      }
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
}
