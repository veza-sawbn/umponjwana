import type { SeasonalItem } from './modules'
import { formatMoney } from './allocation'

const FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'

export type SeasonCard = {
  id: string
  kind: 'Trail' | 'Activity'
  href: string
  image: string
  eyebrow: string
  title: string
  description: string
  price: string
  priceNote: string
}

/** Normalizes a Trail or Activity into the shared card shape the season
 *  page's grid and mobile carousel both render — see
 *  docs/destination-graph/PHASE_I.md for why these two entity kinds need
 *  a common display shape here. */
export function toSeasonCard(entry: SeasonalItem): SeasonCard {
  if (entry.kind === 'trail') {
    const t = entry.item
    return {
      id: t.id,
      kind: 'Trail',
      href: `/hikes/${t.slug || t.id}`,
      image: t.image || FALLBACK,
      eyebrow: `${t.distance} · ${t.difficulty}`,
      title: t.name,
      description: t.description,
      price: t.permit_required && t.permit_cost > 0 ? formatMoney(t.permit_cost) : '',
      priceNote: t.permit_required ? 'permit req.' : '',
    }
  }
  const a = entry.item
  return {
    id: a.id,
    kind: 'Activity',
    href: `/activities/${a.slug || a.id}`,
    image: a.photos?.[0] || FALLBACK,
    eyebrow: a.category,
    title: a.name,
    description: a.description,
    price: a.pricePerPerson ? formatMoney(a.pricePerPerson) : 'Contact for rates',
    priceNote: a.pricePerPerson ? 'pp' : '',
  }
}
