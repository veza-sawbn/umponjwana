import { getTours, type Tour } from './tours'
import { getDepartures, type Departure } from './departures'
import { getTrails, type Trail } from './trails'

// A "Trekking Experience" is the marketplace view of one scheduled departure
// joined with its parent tour product. Suppliers keep creating Tours and
// Departures exactly as before (both already reference a Trail ID); this
// module composes the two into the commercial product shown on
// /experiences/[id] and in the "Upcoming Trekking Experiences" section of
// the hiking directory. The experience id IS the departure id.

export type TrekkingExperience = {
  id: string               // departure id
  tourId: string
  trailId: string
  trailName: string
  title: string
  operator: string
  operatorId: string
  leadGuide: string
  departureDate: string    // ISO yyyy-mm-dd
  returnDate: string
  durationDays: number
  spacesTotal: number
  spacesAvailable: number
  pricePerPerson: number
  difficulty: string
  includedServices: string[]
  meetingPoint: string
  gpsLat: string
  gpsLng: string
  region: string
  rating: number | null
  reviewCount: number
  featured: boolean
  description: string
  fitnessNotes: string
  cancellation: string
  minAge: number
  maxGroup: number
  accommodationStyle: string
  mealsIncluded: string
  transportIncluded: boolean
  equipmentIncluded: boolean
  guideExperienceYears: number | null
  status: Departure['status']
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function compose(dep: Departure, tour: Tour, trail?: Trail): TrekkingExperience {
  const days = dep.tourDays || tour.days || 1
  return {
    id: dep.id,
    tourId: tour.id,
    trailId: dep.trailId || tour.trailId,
    trailName: tour.trailName || trail?.name || '',
    title: tour.name,
    operator: dep.supplierName || tour.supplierName,
    operatorId: dep.supplierId || tour.supplierId,
    leadGuide: dep.guide || tour.leadGuide || '',
    departureDate: dep.date,
    returnDate: addDays(dep.date, Math.max(0, days - 1)),
    durationDays: days,
    spacesTotal: dep.maxSeats,
    spacesAvailable: Math.max(0, dep.maxSeats - dep.bookedSeats),
    pricePerPerson: dep.pricePerPerson || tour.pricePerPerson,
    difficulty: tour.difficulty,
    includedServices: tour.included ?? [],
    meetingPoint: tour.meetingPoint,
    gpsLat: tour.gpsLat,
    gpsLng: tour.gpsLng,
    region: trail?.region ?? '',
    rating: typeof tour.rating === 'number' && tour.rating > 0 ? tour.rating : null,
    reviewCount: tour.reviewCount ?? 0,
    featured: !!tour.featured,
    description: tour.description,
    fitnessNotes: tour.fitnessNotes,
    cancellation: tour.cancellation,
    minAge: tour.minAge,
    maxGroup: tour.maxGroup,
    accommodationStyle: tour.accommodationStyle ?? '',
    mealsIncluded: tour.mealsIncluded ?? (tour.included?.includes('Meals') ? 'Meals included' : ''),
    transportIncluded: tour.transportIncluded ?? !!tour.included?.includes('Transport'),
    equipmentIncluded: tour.equipmentIncluded ?? !!tour.included?.includes('Equipment'),
    guideExperienceYears: tour.guideExperienceYears ?? null,
    status: dep.status,
  }
}

async function loadAll(): Promise<TrekkingExperience[]> {
  const [departures, tours, trails] = await Promise.all([getDepartures(), getTours(), getTrails()])
  const tourById = new Map(tours.filter(t => t.status === 'active').map(t => [t.id, t]))
  const trailById = new Map(trails.map(t => [t.id, t]))
  const list: TrekkingExperience[] = []
  for (const dep of departures) {
    const tour = tourById.get(dep.tourId)
    if (!tour) continue // draft or deleted tour → not published
    list.push(compose(dep, tour, trailById.get(dep.trailId || tour.trailId)))
  }
  return list
}

/** All published upcoming experiences, soonest first. */
export async function getUpcomingExperiences(): Promise<TrekkingExperience[]> {
  const today = new Date().toISOString().slice(0, 10)
  return (await loadAll())
    .filter(e => e.departureDate >= today)
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
}

/** Published upcoming experiences that use a specific hiking trail. */
export async function getExperiencesByTrail(trailId: string): Promise<TrekkingExperience[]> {
  return (await getUpcomingExperiences()).filter(e => e.trailId === trailId)
}

/** One experience by its id (departure id) — includes past departures. */
export async function getExperienceById(id: string): Promise<TrekkingExperience | null> {
  return (await loadAll()).find(e => e.id === id) ?? null
}
