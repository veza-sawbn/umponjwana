import type { BookingState } from './booking-context'
import { PROPERTY_TYPES, propertyTypeSlug } from './properties'

export type DestinationCategory = 'destination' | 'attraction' | 'nature' | 'experience' | 'summer' | 'winter'

// ── Destination-graph navigation (Phase A, wired in Phase E) ────────────────
// This is the reframed primary IA from the destination-graph review: 7
// primaries (Explore · Hikes · Stay · Things to Do · Tours · Plan Your Trip
// · Transport). As of Phase E this is what Navbar.tsx actually renders,
// filtered to 'live' nodes only — PRIMARY_NAVIGATION below is no longer
// consumed by the Navbar but is left in place in case other code still
// reads it. See docs/destination-graph/PHASE_A.md and PHASE_E.md.
//
// Critically, per the graph-first reassessment: most of the original 81-item
// IA are taxonomy values or filter facets, not pages, and are NOT
// represented as nodes here — a facet belongs in a listing page's filter
// module (lib/page-composition.ts, Phase B), not in the navigation tree.
// Only genuine entities, deliberate landing pages and content pages get a
// NavNode. See docs/destination-graph/PHASE_A.md for the full
// entity/taxonomy/facet/page classification this list is drawn from.

export type NavNodeType = 'entity' | 'landing_page' | 'content_page'
export type NavNodeStatus = 'live' | 'planned'

export type NavNode = {
  label: string
  href: string
  type: NavNodeType
  status: NavNodeStatus
  /** What unblocks this node moving from 'planned' to 'live'. Doubles as a
   *  lightweight in-code roadmap — kept deliberately short, full detail
   *  lives in docs/destination-graph/PHASE_A.md. */
  requires?: string
  children?: NavNode[]
}

/** The renderer (Navbar.tsx, Phase E) must only expose 'live' nodes. 'planned' nodes stay
 *  in this array so the full IA is visible to admins/devs without being
 *  linked publicly — resolvability is checked at render time, not by
 *  filtering this array, so a node flips to 'live' by editing one field
 *  here, not by moving it between arrays. */
export const DESTINATION_GRAPH_NAV: NavNode[] = [
  {
    label: 'Explore', href: '/regions', type: 'landing_page', status: 'live',
    children: [
      // Hrefs match the *live* canonical slugs, not the original
      // north-berg/central-berg/south-berg ids Phase A intended to keep
      // stable. An admin saved these regions at least once through the
      // pre-Phase-G admin console (see docs/destination-graph/PHASE_G.md),
      // which never persisted a `slug` — so normalizeRegion() derived one
      // from the renamed display name ("Northern Drakensberg" →
      // "northern-drakensberg") and, as of Phase G, that derived slug is
      // now stabilized in storage. Confirmed against production data.
      { label: 'Northern Drakensberg', href: '/regions/northern-drakensberg', type: 'entity', status: 'live' },
      { label: 'Central Drakensberg', href: '/regions/central-drakensberg', type: 'entity', status: 'live' },
      { label: 'Southern Drakensberg', href: '/regions/southern-drakensberg', type: 'entity', status: 'live' },
      { label: 'Towns & Villages', href: '/towns', type: 'entity', status: 'live' },
      {
        label: 'Mountains & Peaks', href: '/nature-reserves', type: 'landing_page', status: 'planned',
        requires: 'Reserve detail pages (/nature-reserves/[slug]) — peaks render as anchors on their parent reserve, not as separate pages (Peaks decision: nested attribute of Reserve)',
      },
      {
        label: 'Waterfalls', href: '/nature-reserves', type: 'landing_page', status: 'planned',
        requires: 'feature/tag vocabulary on Reserve + filtered view — not a new entity',
      },
      { label: 'Nature & Wildlife', href: '/nature-reserves', type: 'landing_page', status: 'live' },
      {
        label: 'Heritage & Culture', href: '/nature-reserves', type: 'landing_page', status: 'planned',
        requires: 'feature/tag vocabulary on Reserve/Town + filtered view',
      },
      {
        label: 'Viewpoints', href: '/nature-reserves', type: 'landing_page', status: 'planned',
        requires: 'feature/tag vocabulary on Reserve — not a new entity',
      },
      {
        label: 'Maps', href: '/maps', type: 'content_page', status: 'planned',
        requires: 'static regional map utility page',
      },
    ],
  },
  {
    label: 'Hikes', href: '/hikes', type: 'landing_page', status: 'live',
    children: [
      { label: 'All Hikes', href: '/hikes', type: 'landing_page', status: 'live' },
      // Pre-filtered views of the same /hikes listing (facets, not distinct
      // entities) — category via ?category=, matching hikes/page.tsx's
      // CATEGORY_TABS values; region browsing reuses the Explore section's
      // /regions entity rather than duplicating it here.
      { label: 'Day Hikes', href: '/hikes?category=day_hike', type: 'landing_page', status: 'live' },
      { label: 'Multi-Day Hikes', href: '/hikes?category=multi_day_hike', type: 'landing_page', status: 'live' },
      { label: 'Hikes by Region', href: '/regions', type: 'landing_page', status: 'live' },
      { label: 'Grand Traverse', href: '/hikes/grand-traverse', type: 'entity', status: 'live' },
      {
        label: 'Little Berg Traverse', href: '/hikes/little-berg-traverse', type: 'entity', status: 'planned',
        requires: 'admin creates the trail record — no such trail exists in the data yet (only Grand Traverse does)',
      },
      {
        label: "Giant's Cup", href: '/hikes/giants-cup', type: 'entity', status: 'planned',
        requires: 'admin creates the trail record — no such trail exists in the data yet (only Grand Traverse does)',
      },
      {
        label: 'Northern Traverse', href: '/hikes/northern-traverse', type: 'entity', status: 'planned',
        requires: 'admin creates the trail record — no such trail exists in the data yet (only Grand Traverse does)',
      },
      {
        label: 'Hiking Resources', href: '/mydrakensberg', type: 'content_page', status: 'planned',
        requires: 'Article entity (see docs/seo-audit/SEO_GAPS.md G13) — currently no editorial content type for this',
      },
      {
        label: 'Trail Safety', href: '/mydrakensberg', type: 'content_page', status: 'planned',
        requires: 'Article entity',
      },
      {
        label: 'Hiking Gear', href: '/mydrakensberg', type: 'content_page', status: 'planned',
        requires: 'Article entity',
      },
    ],
  },
  {
    label: 'Stay', href: '/stays', type: 'landing_page', status: 'live',
    children: [
      { label: 'All Accommodation', href: '/stays', type: 'landing_page', status: 'live' },
      // One sub-item per accommodation type (lib/properties.ts PROPERTY_TYPES)
      // — a facet, not a distinct page, so it links back to /stays filtered
      // via ?type=<slug> rather than getting its own NavNode entity.
      ...PROPERTY_TYPES.map(t => ({
        label: t, href: `/stays?type=${propertyTypeSlug(t)}`, type: 'landing_page' as const, status: 'live' as const,
      })),
    ],
  },
  {
    label: 'Things to Do', href: '/activities', type: 'landing_page', status: 'live',
    children: [
      { label: 'Activities', href: '/activities', type: 'landing_page', status: 'live' },
      {
        // Public and empty until a supplier publishes a listing — that's the
        // correct state of a real, unpopulated catalogue (Events decision:
        // genuine entity, supplier-populated, see lib/events.ts).
        label: 'Events', href: '/events', type: 'landing_page', status: 'live',
      },
    ],
  },
  {
    label: 'Tours', href: '/tours', type: 'landing_page', status: 'live',
    children: [
      { label: 'Guided Tours', href: '/tours', type: 'landing_page', status: 'live' },
      { label: 'Curated Journeys', href: '/packages', type: 'landing_page', status: 'live' },
    ],
  },
  {
    label: 'Plan Your Trip', href: '/plan', type: 'landing_page', status: 'live',
    children: [
      { label: 'Trip Planner', href: '/plan', type: 'landing_page', status: 'live' },
      {
        label: 'When to Visit', href: '/plan', type: 'content_page', status: 'planned',
        requires: 'dedicated content section or Article entity',
      },
      {
        label: 'What to Pack', href: '/plan', type: 'content_page', status: 'planned',
        requires: 'dedicated content section or Article entity',
      },
      {
        label: 'Getting Here', href: '/plan', type: 'content_page', status: 'planned',
        requires: 'dedicated content section or Article entity',
      },
    ],
  },
  {
    label: 'Transport', href: '/shuttles', type: 'landing_page', status: 'live',
    children: [
      { label: 'Shuttles', href: '/shuttles', type: 'landing_page', status: 'live' },
    ],
  },
]

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

// ── Primary navigation ────────────────────────────────────────────────────────
// Source of truth for the site's main nav categories. Navbar.tsx derives its
// super-menu items from this array so navigation stays in sync with the
// destination intelligence model.

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

// ── Destination nodes ─────────────────────────────────────────────────────────

export const DESTINATIONS: DestinationNode[] = [
  {
    id: 'champagne-valley',
    slug: 'champagne-valley',
    name: 'Champagne Valley',
    region: 'Central Drakensberg',
    subRegion: 'Cathedral Peak & Champagne Valley',
    town: 'Winterton',
    category: 'destination',
    coordinates: { lat: -28.996, lng: 29.438 },
    summary: 'A scenic resort corridor for families, hikers, photographers and soft-adventure travellers beneath Cathkin Peak and Champagne Castle.',
    history: 'Long used as a gateway into Cathedral Peak and the upper valleys, Champagne Valley grew around mountain hotels, farms and conservation access routes.',
    culture: 'The valley connects farm hospitality, Drakensberg Boys Choir performances, craft producers and San rock-art interpretation.',
    wildlife: 'Grassland birding, eland sightings and raptor viewing are common, with bearded vulture habitat in the high Berg.',
    landscape: 'Open foothills, basalt cliffs, river valleys and wide sunrise views define the Central Drakensberg landscape.',
    attractions: ['Drakensberg Boys Choir', 'Monks Cowl', 'Cathkin Peak', 'Falcon Ridge', 'Champagne Castle'],
    towns: ['Winterton', 'Bergville', 'Estcourt'],
    villages: ['Champagne Valley', 'Cathkin Park'],
    nearbyRegionSlugs: ['north-berg', 'south-berg'],
    travelInfo: ['Best for first-time visitors', 'Good base for families', 'Strong access to activities and guided hikes'],
    mapLabel: 'Central Drakensberg hub',
  },
  {
    id: 'cathedral-peak',
    slug: 'cathedral-peak',
    name: 'Cathedral Peak',
    region: 'Central Drakensberg',
    subRegion: 'Cathedral Peak Wilderness',
    town: 'Winterton',
    category: 'nature',
    coordinates: { lat: -28.943, lng: 29.204 },
    summary: 'A dramatic mountain destination for guided hiking, photography, waterfalls and high-Berg scenery.',
    history: 'Cathedral Peak is one of the Drakensberg\'s classic mountain landmarks and a long-standing hub for guided walks and mountain hospitality.',
    culture: 'The surrounding valleys contain important San rock-art heritage and long-established mountain guiding traditions.',
    wildlife: 'Look for eland, mountain reedbuck, jackal buzzards and high-altitude raptors.',
    landscape: 'Needle-like peaks, sandstone foothills, basalt escarpment walls and waterfall-fed ravines.',
    attractions: ['Cathedral Peak Summit', 'Rainbow Gorge', 'Doreen Falls', 'Sherman\'s Cave'],
    towns: ['Winterton', 'Bergville'],
    villages: ['Cathedral Peak', 'Didima'],
    nearbyRegionSlugs: ['champagne-valley', 'north-berg'],
    travelInfo: ['Best with early starts', 'Guides recommended for summit routes', 'Weather changes quickly'],
    mapLabel: 'Mountain hiking hub',
  },
  {
    id: 'royal-natal',
    slug: 'royal-natal',
    name: 'Royal Natal',
    region: 'Northern Drakensberg',
    subRegion: 'Amphitheatre & Sentinel',
    town: 'Bergville',
    category: 'nature',
    coordinates: { lat: -28.716, lng: 28.958 },
    summary: 'Home to the Amphitheatre and Tugela Falls — the most iconic section of the Drakensberg escarpment.',
    history: 'Royal Natal National Park was established in 1916 and contains some of the oldest evidence of human habitation in southern Africa.',
    culture: 'San rock art, Zulu heritage and colonial mountaineering history converge in this extraordinary landscape.',
    wildlife: 'Eland, baboon, mountain reedbuck and a rich variety of raptors including the bearded vulture.',
    landscape: 'The Amphitheatre — a 5km basalt wall rising over 1000m — dominates the skyline above the Thukela river canyon.',
    attractions: ['Tugela Falls', 'The Amphitheatre', 'Chain Ladder', 'Tendele Camp'],
    towns: ['Bergville', 'Harrismith'],
    villages: ['Tendele', 'Mahai'],
    nearbyRegionSlugs: ['central-berg', 'champagne-valley'],
    travelInfo: ['Early start essential for summit hikes', 'Chain ladder is exposed — avoid in thunderstorms', 'Permit required for the Sentinel car park'],
    mapLabel: 'Northern Drakensberg icon',
  },
  {
    id: 'underberg-himeville',
    slug: 'underberg-himeville',
    name: 'Underberg & Himeville',
    region: 'Southern Drakensberg',
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
    mapLabel: 'Southern Drakensberg gateway',
  },
]

// ── Contextual recommendation seeds ───────────────────────────────────────────

export const DESTINATION_RECOMMENDATIONS: Omit<ContextualRecommendation, 'distanceKm' | 'travelTimeMinutes'>[] = [
  { id: 'stay-champagne', title: 'Champagne Valley Mountain Lodge', category: 'Accommodation', region: 'Central Drakensberg', town: 'Champagne Valley', coordinates: { lat: -29.001, lng: 29.429 }, href: '/stays/champagne-lodge', price: 1450, supplierRating: 4.8, availability: 'Available for your dates' },
  { id: 'quad-biking', title: 'Quad Biking Adventure', category: 'Activity', region: 'Central Drakensberg', town: 'Champagne Valley', coordinates: { lat: -28.974, lng: 29.463 }, href: '/activities/a1', price: 650, supplierRating: 4.7, availability: 'Available for your dates' },
  { id: 'horse-riding', title: 'Horse Riding Centre', category: 'Activity', region: 'Central Drakensberg', town: 'Champagne Valley', coordinates: { lat: -28.989, lng: 29.450 }, href: '/activities/horse-riding', price: 350, supplierRating: 4.6, availability: 'Available for your dates' },
  { id: 'cathedral-hike', title: 'Cathedral Peak Guided Hike', category: 'Guided Tour', region: 'Central Drakensberg', town: 'Cathedral Peak', coordinates: { lat: -28.943, lng: 29.204 }, href: '/guides/cathedral-peak', price: 850, supplierRating: 4.9, availability: 'Check schedule' },
  { id: 'choir-event', title: 'Drakensberg Boys Choir', category: 'Event', region: 'Central Drakensberg', town: 'Winterton', coordinates: { lat: -29.009, lng: 29.457 }, href: '/events/boys-choir', price: 220, supplierRating: 4.9, availability: 'Seasonal' },
  { id: 'valley-restaurant', title: 'Valley Farm Restaurant', category: 'Restaurant', region: 'Central Drakensberg', town: 'Champagne Valley', coordinates: { lat: -28.993, lng: 29.444 }, href: '/activities/food-drink', price: 180, supplierRating: 4.5, availability: 'Available for your dates' },
  { id: 'monks-cowl-trail', title: 'Monks Cowl Nature Walk', category: 'Trail', region: 'Central Drakensberg', town: 'Champagne Valley', coordinates: { lat: -29.024, lng: 29.399 }, href: '/hikes/monks-cowl', supplierRating: 4.8, availability: 'Available for your dates' },
  { id: 'private-transfer', title: 'Airport Private Transfer', category: 'Transport', region: 'Central Drakensberg', town: 'Champagne Valley', coordinates: { lat: -28.996, lng: 29.438 }, href: '/shuttles', price: 3640, supplierRating: 4.8, availability: 'Available for your dates' },
]

// ── Utility functions ─────────────────────────────────────────────────────────

/** Haversine straight-line distance in km between two coordinate pairs. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10
}

export function getDestinationBySlug(slug: string): DestinationNode | undefined {
  return DESTINATIONS.find(d => d.slug === slug)
}

/** Resolve the most relevant destination node for the current booking context. */
export function getDestinationForContext(booking: BookingState, fallbackSlug = 'champagne-valley'): DestinationNode {
  const stayTitle = booking.stay?.title.toLowerCase() ?? ''
  if (stayTitle.includes('cathedral')) return getDestinationBySlug('cathedral-peak')!
  if (booking.region.toLowerCase().includes('south')) return getDestinationBySlug('underberg-himeville')!
  if (booking.region.toLowerCase().includes('north') || stayTitle.includes('royal') || stayTitle.includes('natal')) return getDestinationBySlug('royal-natal')!
  if (booking.region.toLowerCase().includes('central') || stayTitle) return getDestinationBySlug('champagne-valley')!
  return getDestinationBySlug(fallbackSlug)!
}

/** Build contextual recommendations sorted by proximity to the destination. */
export function buildDestinationRecommendations(
  booking: BookingState,
  destination: DestinationNode,
): ContextualRecommendation[] {
  const reference = destination.coordinates

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
