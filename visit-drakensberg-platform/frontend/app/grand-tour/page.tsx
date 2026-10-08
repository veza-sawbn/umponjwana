import type { Metadata } from 'next'
import { getActivities } from '@/lib/activities'
import { publicSupabase } from '@/lib/supabase-public'
import { grandTourActivities, GRAND_TOUR_STAGES } from '@/lib/grand-tour'
import GrandTourExperience from '@/components/grand-tour/GrandTourExperience'

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
  const tours = await getActivities(publicSupabase)
    .then(grandTourActivities)
    .catch(() => [])
  return <GrandTourExperience tours={tours} />
}
