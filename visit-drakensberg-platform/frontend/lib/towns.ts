import { supabase } from './auth'

export type Town = {
  id: string
  slug: string
  /** Region this town is filed under (Region.slug). Empty = unassigned. */
  regionSlug: string
  name: string
  /** Short role/label, e.g. "Northern Drakensberg gateway". */
  gateway: string
  description: string
  image: string
  highlights: string[]
  seoTitle: string
  seoDescription: string
  createdAt?: string
  updatedAt?: string
}

// Migrated from the previously hardcoded towns list on the regions page.
export const DEFAULT_TOWNS: Town[] = [
  {
    id: 'bergville', slug: 'bergville', regionSlug: 'north-berg', name: 'Bergville',
    gateway: 'Northern Drakensberg gateway',
    description: 'Main service town for the Northern Drakensberg. Close to Royal Natal National Park and the Amphitheatre.',
    image: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=900&q=80',
    highlights: [], seoTitle: 'Bergville | Visit Drakensberg', seoDescription: '',
  },
  {
    id: 'winterton', slug: 'winterton', regionSlug: 'central-berg', name: 'Winterton',
    gateway: 'Central Drakensberg gateway',
    description: 'Gateway to Cathedral Peak and the Drakensberg resort strip. Home to the Drakensberg Boys Choir.',
    image: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=900&q=80',
    highlights: [], seoTitle: 'Winterton | Visit Drakensberg', seoDescription: '',
  },
  {
    id: 'estcourt', slug: 'estcourt', regionSlug: 'central-berg', name: 'Estcourt',
    gateway: 'Central Drakensberg',
    description: 'Larger regional centre with good access to Giants Castle Game Reserve.',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80',
    highlights: [], seoTitle: 'Estcourt | Visit Drakensberg', seoDescription: '',
  },
  {
    id: 'underberg', slug: 'underberg', regionSlug: 'south-berg', name: 'Underberg',
    gateway: 'Southern Drakensberg gateway',
    description: 'The main town for southern Drakensberg, sitting at the foot of Sani Pass. Practical and unpretentious.',
    image: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=900&q=80',
    highlights: [], seoTitle: 'Underberg | Visit Drakensberg', seoDescription: '',
  },
  {
    id: 'himeville', slug: 'himeville', regionSlug: 'south-berg', name: 'Himeville',
    gateway: 'Southern Drakensberg — boutique',
    description: 'A charming village with a restored fort, trout streams and boutique accommodation. A hidden gem.',
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80',
    highlights: [], seoTitle: 'Himeville | Visit Drakensberg', seoDescription: '',
  },
  {
    id: 'nottingham-road', slug: 'nottingham-road', regionSlug: 'central-berg', name: 'Nottingham Road',
    gateway: 'Midlands',
    description: 'Boutique village on the Midlands Meander. Known for craft beer, cheese, art studios and farm stays on the way to the Berg.',
    image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=900&q=80',
    highlights: [], seoTitle: 'Nottingham Road | Visit Drakensberg', seoDescription: '',
  },
  {
    id: 'champagne-valley', slug: 'champagne-valley', regionSlug: 'central-berg', name: 'Champagne Valley',
    gateway: 'Central Drakensberg',
    description: 'A scenic valley resort corridor with a dense cluster of lodges, spas and adventure operators.',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=80',
    highlights: [], seoTitle: 'Champagne Valley | Visit Drakensberg', seoDescription: '',
  },
]

export function slugifyTown(name: string) {
  return name.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalizeTown(town: Partial<Town> & { name: string; id?: string }): Town {
  const slug = town.slug || slugifyTown(town.name)
  return {
    id: town.id || slug,
    slug,
    regionSlug: town.regionSlug || '',
    name: town.name,
    gateway: town.gateway || '',
    description: town.description || '',
    image: town.image || '',
    highlights: town.highlights || [],
    seoTitle: town.seoTitle || `${town.name} | Visit Drakensberg`,
    seoDescription: town.seoDescription || '',
    createdAt: town.createdAt,
    updatedAt: town.updatedAt,
  }
}

async function saveTowns(towns: Town[]) {
  const { error } = await supabase.from('site_content').upsert(
    { key: 'admin_towns', value: { items: towns }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw error
}

export async function getTowns(): Promise<Town[]> {
  const { data, error } = await supabase.from('site_content').select('value').eq('key', 'admin_towns').maybeSingle()
  if (error) throw error
  if (Array.isArray(data?.value?.items) && data.value.items.length > 0) {
    return data.value.items.map((item: Town) => normalizeTown(item))
  }
  return DEFAULT_TOWNS
}

export async function getTownsByRegion(regionSlug: string): Promise<Town[]> {
  const all = await getTowns()
  return all.filter(t => t.regionSlug === regionSlug)
}

export async function saveAllTowns(towns: Town[]): Promise<void> {
  const now = new Date().toISOString()
  await saveTowns(towns.map(t => normalizeTown({ ...t, updatedAt: t.updatedAt ?? now })))
}

export async function createTown(data: Omit<Town, 'id' | 'slug' | 'createdAt' | 'updatedAt'>): Promise<Town> {
  const all = await getTowns()
  const now = new Date().toISOString()
  const item = normalizeTown({ ...data, createdAt: now, updatedAt: now })
  await saveTowns([...all.filter(t => t.slug !== item.slug), item])
  return item
}

export async function updateTown(id: string, data: Omit<Town, 'id' | 'slug' | 'createdAt' | 'updatedAt'>): Promise<Town> {
  const all = await getTowns()
  const previous = all.find(t => t.id === id)
  const updated = normalizeTown({ ...data, id, slug: previous?.slug, createdAt: previous?.createdAt, updatedAt: new Date().toISOString() })
  const next = previous ? all.map(t => t.id === id ? updated : t) : [...all, updated]
  await saveTowns(next)
  return updated
}

export async function deleteTown(id: string): Promise<void> {
  const all = await getTowns()
  await saveTowns(all.filter(t => t.id !== id))
}
