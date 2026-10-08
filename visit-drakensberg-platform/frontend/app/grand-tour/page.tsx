import type { Metadata } from 'next'
import { getActivities } from '@/lib/activities'
import { getTours } from '@/lib/tours'
import { publicSupabase } from '@/lib/supabase-public'
import { grandTourActivities, GRAND_TOUR_STAGES } from '@/lib/grand-tour'
import { getSupplierEntities } from '@/lib/supplier-entities'
import type { Event } from '@/lib/events'
import { isEventUpcoming } from '@/lib/upcoming'
import { getGrandTourFeatures, activityItem, eventItem, tourItem, type CatalogueItem } from '@/lib/grand-tour-features'
import GrandTourExperience, { type RelatedProduct } from '@/components/grand-tour/GrandTourExperience'

// Server shell: the editorial route is static (lib/grand-tour.ts), the day
// tours on it are live supplier listings. Same short ISR window as the
// activity pages, since seat counts and departures change through the day.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Grand Tour Drakensberg',
  description:
    'The Drakensberg from north to south in seven stages: the Amphitheatre, Cathedral Peak, Champagne Valley, Giant’s Castle, Kamberg, Sani Pass and Garden Castle. Book a seat on a day tour with pickup from your hotel.',
  alternates: { canonical: '/grand-tour' },
  openGraph: {
    title: 'Grand Tour Drakensberg',
    description: 'Seven stages along the escarpment, and day tours that collect you from your hotel.',
    images: [{ url: GRAND_TOUR_STAGES[0].image }],
  },
}

export default async function GrandTourPage() {
  const [activities, guidedTours, events, features] = await Promise.all([
    getActivities(publicSupabase).catch(() => []),
    getTours(publicSupabase).catch(() => []),
    getSupplierEntities<Event>('events', undefined, publicSupabase).catch(() => [] as Event[]),
    getGrandTourFeatures(publicSupabase),
  ])
  const tours = grandTourActivities(activities)
  const dayTourIds = new Set(tours.map(t => t.id))

  // A stage no day tour covers yet still offers what IS bookable there: the
  // guided tours that start on its trails, and (on the stage that is home to
  // its area) the area's other live activities. Every stage then ends in
  // something a visitor can actually buy.
  const related: Record<string, RelatedProduct[]> = {}
  for (const stage of GRAND_TOUR_STAGES) {
    const trailIds = new Set(stage.relatedTrailIds ?? [])
    const fromTours: RelatedProduct[] = guidedTours
      .filter(t => t.status === 'active' && trailIds.has(t.trailId))
      .map(t => ({
        id: t.id, kind: 'Guided tour', name: t.name.trim(), href: `/tours/${t.slug || t.id}`,
        price: t.pricePerPerson || undefined, detail: t.days ? `${t.days} day${t.days === 1 ? '' : 's'}` : undefined,
      }))
    const fromActivities: RelatedProduct[] = stage.areaHome
      ? activities
          .filter(a => a.status === 'active' && !dayTourIds.has(a.id) && a.region === stage.area)
          .map(a => ({
            id: a.id, kind: 'Activity', name: a.name, href: `/activities/${a.slug || a.id}`,
            image: a.photos?.[0], price: a.pricePerPerson || undefined, detail: a.category || undefined,
          }))
      : []
    related[stage.id] = [...fromTours, ...fromActivities].slice(0, 4)
  }

  // What VD Operations hand-picked for each stage (/operations/grand-tour).
  // Resolved against the live catalogue on every render, so a feature whose
  // listing went to draft, or an event that has passed, simply drops out.
  const catalogue = new Map<string, CatalogueItem>()
  for (const a of activities) catalogue.set(`activity:${a.id}`, activityItem(a))
  for (const t of guidedTours) catalogue.set(`tour:${t.id}`, tourItem(t))
  for (const e of events) {
    const upcoming = (e.sessions ?? []).some(s => s.status === 'active' && isEventUpcoming(s)) || isEventUpcoming(e)
    if (upcoming) catalogue.set(`event:${e.id}`, eventItem(e))
  }
  const featured: Record<string, RelatedProduct[]> = {}
  for (const f of features) {
    const item = catalogue.get(`${f.kind}:${f.entityId}`)
    if (!item?.live) continue
    ;(featured[f.stageId] ??= []).push({
      id: item.id, kind: item.kindLabel, name: item.name, href: item.href,
      image: item.image, price: item.price, detail: item.detail, note: f.note ?? undefined,
    })
  }

  return <GrandTourExperience tours={tours} related={related} featured={featured} />
}
