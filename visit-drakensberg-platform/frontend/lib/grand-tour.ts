import { timeslotsForDate, slotRemaining, type Activity, type ActivityTimeslot } from './activities'
import { todayISO } from './upcoming'

// ─── Grand Tour Drakensberg ──────────────────────────────────────────────────
//
// The Grand Tour is an editorial route along the escarpment, north to south,
// told as stages with highlights — the page at /grand-tour reads like an
// itinerary the visitor scrolls through. What makes it bookable is the day
// tours experience suppliers attach to it: an ordinary Activity with
// timeslots (its scheduled departures) plus the `grandTour` listing below,
// which says which highlights the tour visits and where it collects guests.
//
// Seats are booked through the normal activity checkout (a held activity
// timeslot), and once payment clears every seat becomes a scannable ticket —
// see supabase/migrations/20261008_grand_tour_boarding.sql.

/** A hotel or meeting point the tour bus collects guests from. */
export type PickupPoint = {
  id: string
  /** As guests know it, e.g. "Champagne Sports Resort". */
  name: string
  /** Area it sits in, e.g. "Champagne Valley" — used to group the picker. */
  area?: string
  /** How long before the departure time the bus is at this pickup. The
   *  ticket prints the resulting clock time, so one setting serves every
   *  departure of the tour. */
  minutesBefore: number
}

/** The Grand Tour part of an Activity listing. Absent = not on the Grand Tour. */
export type GrandTourListing = {
  enabled: boolean
  /** GrandTourHighlight ids this day tour visits, in visiting order. */
  highlightIds: string[]
  /** Where the tour starts from, when that differs from where it goes —
   *  e.g. a Southern Drakensberg tour departing Champagne Valley. */
  departsFrom?: string
  pickupPoints: PickupPoint[]
}

export type GrandTourHighlight = {
  id: string
  name: string
  blurb: string
  /** Optional fact chip shown with the highlight, e.g. "948 m". */
  fact?: string
}

export type GrandTourStage = {
  id: string
  /** 1-based position on the route. */
  number: number
  area: 'Northern Drakensberg' | 'Central Drakensberg' | 'Southern Drakensberg'
  regionSlug: string
  name: string
  kicker: string
  intro: string
  image: string
  /** Rough driving time from the previous stage, shown between stages. */
  legFromPrevious?: string
  highlights: GrandTourHighlight[]
  /** Trail ids of guided tours (lib/tours.ts) that start in this stage — the
   *  bookable fallback shown while no day tour covers it. */
  relatedTrailIds?: string[]
  /** The stage that shows its area's other activities as that fallback, so
   *  an activity in "Central Drakensberg" appears once, not on every
   *  Central stage. */
  areaHome?: boolean
}

const img = (id: string) => `https://images.unsplash.com/${id}?w=1800&q=80&auto=format&fit=crop`

export const GRAND_TOUR_STAGES: GrandTourStage[] = [
  {
    id: 'royal-natal',
    relatedTrailIds: ['thukela-falls', 'tugela-falls', 'northen-traverse', 'northern-traverse'],
    areaHome: true,
    number: 1,
    area: 'Northern Drakensberg',
    regionSlug: 'north-berg',
    name: 'Royal Natal & the Amphitheatre',
    kicker: 'Where the escarpment begins',
    intro:
      'The route opens with the most famous wall of rock in Southern Africa: five kilometres of sheer basalt cliff, with the Tugela River pouring off its rim.',
    image: img('photo-1506905925346-21bda4d32df4'),
    highlights: [
      { id: 'amphitheatre', name: 'The Amphitheatre', fact: '5 km cliff face', blurb: 'A crescent of cliffs between the Sentinel and Eastern Buttress, best seen in early light from the Tugela Gorge or the Thendele viewpoints.' },
      { id: 'tugela-falls', name: 'Tugela Falls', fact: '948 m drop', blurb: 'Among the highest waterfalls on earth, falling in five leaps from the plateau. Reached from below through the Tugela Gorge, or from the top via the Sentinel chain ladders.' },
      { id: 'tugela-gorge', name: 'Tugela Gorge', blurb: 'A riverside walk through yellowwood forest to the tunnel, where the gorge narrows beneath the Amphitheatre wall.' },
    ],
  },
  {
    id: 'cathedral-peak',
    relatedTrailIds: ['mnweni-circuit', 'cathedral-peak'],
    number: 2,
    area: 'Northern Drakensberg',
    regionSlug: 'north-berg',
    name: 'Cathedral Peak',
    kicker: 'Spires and San heritage',
    intro:
      'Free-standing peaks rise straight out of the Mlambonja valley here, and the region holds some of the richest rock art in the range.',
    image: img('photo-1464822759023-fed622ff2c3b'),
    legFromPrevious: 'About 1 h 30 by road',
    highlights: [
      { id: 'cathedral-peak-summit', name: 'Cathedral Peak', fact: '3,004 m', blurb: 'One of the few Drakensberg summits reachable without technical climbing: a long, rewarding day with a short scramble at the top.' },
      { id: 'didima-rock-art', name: 'Didima San Art Centre', blurb: 'An introduction to the people who painted these valleys, before you go looking for the paintings themselves.' },
      { id: 'mikes-pass', name: "Mike's Pass", blurb: 'A high road onto the Little Berg, with views across the Cathedral range from the top.' },
    ],
  },
  {
    id: 'champagne-valley',
    relatedTrailIds: ['champagne-castle', 'sterkhorn'],
    areaHome: true,
    number: 3,
    area: 'Central Drakensberg',
    regionSlug: 'central-berg',
    name: 'Champagne Valley',
    kicker: 'The heart of the Berg, and the Grand Tour’s home base',
    intro:
      'Resorts, craft stops and the boys’ choir sit beneath Champagne Castle. Most day tours start here, with buses collecting guests at the hotels.',
    image: img('photo-1590098563548-8f14eed3a47f'),
    legFromPrevious: 'About 1 h by road',
    highlights: [
      { id: 'champagne-castle', name: 'Champagne Castle', fact: '3,377 m', blurb: 'The second-highest peak in South Africa, watching over the valley that took its name.' },
      { id: 'drakensberg-boys-choir', name: 'Drakensberg Boys’ Choir', blurb: 'A world-touring choir school in the valley, with public concerts on many Wednesdays during term.' },
      { id: 'monks-cowl', name: "Monk's Cowl", blurb: 'Trailheads to Sterkspruit Falls, the Blind Man’s Corner circuit and the long walk up Grey’s Pass.' },
      { id: 'falcon-ridge', name: 'Falcon Ridge raptor flights', blurb: 'Birds of prey flown on the hillside: an easy, family-friendly half-morning.' },
    ],
  },
  {
    id: 'giants-castle',
    relatedTrailIds: ['mafadi', 'giants-castle'],
    number: 4,
    area: 'Central Drakensberg',
    regionSlug: 'central-berg',
    name: 'Giant’s Castle',
    kicker: 'Vultures, eland and the Main Caves',
    intro:
      'A high, open reserve beneath the Giant’s Castle massif, protecting the rare bearded vulture and some of the finest San painting sites in the country.',
    image: img('photo-1501854140801-50d01698950b'),
    legFromPrevious: 'About 1 h 15 by road',
    highlights: [
      { id: 'main-caves', name: 'Main Caves', blurb: 'A guided walk to rock shelters with hundreds of San paintings and a small site museum.' },
      { id: 'vulture-hide', name: 'Bearded vulture hide', blurb: 'A cliff-edge hide where the endangered lammergeier comes in to feed, when the hide is running.' },
      { id: 'eland', name: 'Eland country', blurb: 'Herds of Africa’s largest antelope, the animal the San painted more than any other.' },
    ],
  },
  {
    id: 'kamberg',
    number: 5,
    area: 'Southern Drakensberg',
    regionSlug: 'south-berg',
    name: 'Kamberg & Lotheni',
    kicker: 'Quiet valleys and trout streams',
    intro:
      'The road south turns rural: trout dams, rolling foothills and one of the most important rock art sites in Southern Africa.',
    image: img('photo-1441974231531-c6227db76b6e'),
    legFromPrevious: 'About 1 h 30 by road',
    highlights: [
      { id: 'game-pass-shelter', name: 'Game Pass Shelter', blurb: 'Called the “Rosetta Stone” of San rock art: the panel that helped researchers begin to read the paintings’ meaning. Guided visits only.' },
      { id: 'kamberg-trout', name: 'Kamberg trout waters', blurb: 'Fly-fishing dams and streams in a landscape built for slow days.' },
    ],
  },
  {
    id: 'sani-pass',
    areaHome: true,
    number: 6,
    area: 'Southern Drakensberg',
    regionSlug: 'south-berg',
    name: 'Sani Pass',
    kicker: 'Over the top, into Lesotho',
    intro:
      'The only road over the escarpment on this side climbs in tight switchbacks to the Lesotho border post at the top. Bring your passport.',
    image: img('photo-1551632811-561732d1e306'),
    legFromPrevious: 'About 1 h 30 by road',
    highlights: [
      { id: 'sani-pass-ascent', name: 'The switchbacks', fact: '±2,876 m at the top', blurb: 'A 4×4-only climb from the South African border post to Lesotho, rising about 1,300 m over the last stretch.' },
      { id: 'sani-top', name: 'Sani Top', blurb: 'Lunch on the edge of the escarpment at one of Africa’s highest pubs, with the whole route you have travelled laid out below.' },
      { id: 'basotho-village', name: 'Basotho village visit', blurb: 'Bread, beer and a warm welcome at a highland village, on most Sani Pass day tours.' },
    ],
  },
  {
    id: 'garden-castle',
    number: 7,
    area: 'Southern Drakensberg',
    regionSlug: 'south-berg',
    name: 'Garden Castle & Bushman’s Nek',
    kicker: 'The quiet end of the range',
    intro:
      'The tour ends where the escarpment turns west: Rhino Peak, the Mzimkhulu valley and long walks with nobody else on them.',
    image: img('photo-1486870591958-9b9d0d1dda99'),
    legFromPrevious: 'About 1 h by road',
    highlights: [
      { id: 'rhino-peak', name: 'Rhino Peak', fact: '3,051 m', blurb: 'The horn-shaped summit that dominates the southern skyline, and a big day out for strong hikers.' },
      { id: 'bushmans-nek', name: 'Bushman’s Nek', blurb: 'An old border crossing on foot or horseback into Sehlabathebe National Park in Lesotho.' },
    ],
  },
]

const HIGHLIGHT_STAGE = new Map<string, GrandTourStage>(
  GRAND_TOUR_STAGES.flatMap(s => s.highlights.map(h => [h.id, s] as const)),
)

export function stageForHighlight(highlightId: string): GrandTourStage | undefined {
  return HIGHLIGHT_STAGE.get(highlightId)
}

export function highlightById(highlightId: string): GrandTourHighlight | undefined {
  return HIGHLIGHT_STAGE.get(highlightId)?.highlights.find(h => h.id === highlightId)
}

/** Live, bookable Grand Tour day tours among a set of activities. */
export function grandTourActivities(activities: Activity[]): Activity[] {
  return activities.filter(a =>
    a.status === 'active' && a.grandTour?.enabled && (a.timeslots?.length ?? 0) > 0,
  )
}

/** The stages a day tour visits, in route order. */
export function stagesForActivity(activity: Pick<Activity, 'grandTour'>): GrandTourStage[] {
  const ids = new Set(
    (activity.grandTour?.highlightIds ?? [])
      .map(id => stageForHighlight(id)?.id)
      .filter((id): id is string => !!id),
  )
  return GRAND_TOUR_STAGES.filter(s => ids.has(s.id))
}

/** Clock time the bus is at a pickup for a given departure ("07:30" − 45 min → "06:45"). */
export function pickupTime(departure: Pick<ActivityTimeslot, 'time'>, pickup: Pick<PickupPoint, 'minutesBefore'>): string {
  const [h, m] = departure.time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return departure.time
  const total = (((h * 60 + m - (pickup.minutesBefore || 0)) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Every distinct pickup point across the given tours, for the "pick up from my hotel" filter. */
export function allPickupNames(activities: Activity[]): string[] {
  const names = new Set<string>()
  for (const a of activities) for (const p of a.grandTour?.pickupPoints ?? []) if (p.name.trim()) names.add(p.name.trim())
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

/** Canonical public URL of a Grand Tour day tour. */
export function dayTourHref(tour: Pick<Activity, 'id' | 'slug'>): string {
  return `/grand-tour/${tour.slug || tour.id}`
}

export type UpcomingDeparture = { date: string; timeslotId: string; time: string; seatsLeft: number }

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The next departures that still have seats, from today (South African time). */
export function upcomingDepartures(
  tour: Pick<Activity, 'timeslots' | 'slotBookings'>,
  { days = 60, limit = 8, from = todayISO() }: { days?: number; limit?: number; from?: string } = {},
): UpcomingDeparture[] {
  const out: UpcomingDeparture[] = []
  for (let i = 0; i < days && out.length < limit; i++) {
    const date = addDays(from, i)
    for (const slot of timeslotsForDate(tour, date)) {
      const seatsLeft = slotRemaining(tour, date, slot.id)
      if (seatsLeft > 0 && out.length < limit) out.push({ date, timeslotId: slot.id, time: slot.time, seatsLeft })
    }
  }
  return out
}
