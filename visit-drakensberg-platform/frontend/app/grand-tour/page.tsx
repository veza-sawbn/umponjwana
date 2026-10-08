import type { Metadata } from 'next'
import { getActivities } from '@/lib/activities'
import { getTours } from '@/lib/tours'
import { publicSupabase } from '@/lib/supabase-public'
import { grandTourActivities } from '@/lib/grand-tour'
import { getGrandTourContent } from '@/lib/grand-tour-content'
import { getSupplierEntities } from '@/lib/supplier-entities'
import type { Event } from '@/lib/events'
import { isEventUpcoming } from '@/lib/upcoming'
import { getGrandTourFeatures, activityItem, eventItem, tourItem, type CatalogueItem } from '@/lib/grand-tour-features'
import GrandTourExperience, { type RelatedProduct } from '@/components/grand-tour/GrandTourExperience'

// Rendered on every request, never from a cache. The page is three live
// things — the day tours VD Operations publishes, their seat counts, and the
// copy an admin edits at /admin/grand-tour — and each must show the moment
// it changes. `revalidate = 300` was not enough: on Next 14.2 the Supabase
// reads still went to the Data Cache, so a day tour published after the
// cache filled never appeared. Same fix as app/experiences/[id]/page.tsx.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getGrandTourContent(publicSupabase)
  const description =
    `The Drakensberg from north to south in ${content.stages.length} stages: ${content.stages.map(s => s.name).join(', ')}. Book a seat on a day tour with pickup from your hotel.`
  return {
    title: content.hero.title || 'Grand Tour Drakensberg',
    description,
    alternates: { canonical: '/grand-tour' },
    openGraph: {
      title: content.hero.title || 'Grand Tour Drakensberg',
      description: content.hero.subtitle || description,
      images: content.hero.image ? [{ url: content.hero.image }] : undefined,
    },
  }
}

export default async function GrandTourPage() {
  const [content, activities, guidedTours, events, features] = await Promise.all([
    getGrandTourContent(publicSupabase),
    getActivities(publicSupabase).catch(() => []),
    getTours(publicSupabase).catch(() => []),
    getSupplierEntities<Event>('events', undefined, publicSupabase).catch(() => [] as Event[]),
    getGrandTourFeatures(publicSupabase),
  ])
  const tours = grandTourActivities(activities)

  // Only what VD Operations or an admin hand-picked for each stage — nothing
  // is added automatically. Resolved against the live catalogue on every
  // request, so a feature whose listing went to draft, or an event that has
  // passed, simply drops out.
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

  return <GrandTourExperience tours={tours} featured={featured} content={content} />
}
