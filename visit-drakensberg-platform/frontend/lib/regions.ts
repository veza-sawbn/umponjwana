import { supabase } from './auth'

export type Subregion = { id: string; name: string; description: string }

export type Region = {
  id: string
  slug: string
  name: string
  tagline: string
  heroImage: string
  heroVideo: string
  overview: string
  highlights: string[]
  gettingThere: string
  bestTime: string
  keyAttractions: { id: string; name: string; description: string }[]
  subregions: Subregion[]
  seoTitle: string
  seoDescription: string
  createdAt?: string
  updatedAt?: string
}

export const DEFAULT_REGIONS: Region[] = [
  {
    id: 'north-berg',
    slug: 'north-berg',
    name: 'North Berg',
    tagline: 'Royal Natal National Park · Amphitheatre',
    heroImage: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1200&q=85',
    heroVideo: '',
    overview: 'The Amphitheatre — a 5 km sheer basalt cliff — anchors the North Berg. The Tugela River drops 948 metres over five falls here, making it the second highest waterfall on Earth. Royal Natal National Park offers some of the most dramatic scenery in Africa.',
    highlights: ['Tugela Falls Circuit', 'Amphitheatre via Chain Ladder', 'Policemans Helmet', 'Mont-aux-Sources'],
    gettingThere: '',
    bestTime: '',
    keyAttractions: [],
    subregions: [],
    seoTitle: 'North Berg | Visit Drakensberg',
    seoDescription: 'Explore Royal Natal National Park, the Amphitheatre and Tugela Falls.',
  },
  {
    id: 'central-berg',
    slug: 'central-berg',
    name: 'Central Berg',
    tagline: 'Cathedral Peak · Giants Castle · Champagne Valley',
    heroImage: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1200&q=85',
    heroVideo: '',
    overview: 'Cathedral Peak rises to 3,004 m at the heart of the Central Berg, surrounded by the richest concentration of San rock art in the world. Giants Castle Game Reserve protects bearded vultures and herds of eland against a backdrop of jagged peaks.',
    highlights: ['Cathedral Peak Summit', 'Giants Castle Hike', 'Injasuti Cave', 'Champagne Castle'],
    gettingThere: '',
    bestTime: '',
    keyAttractions: [],
    subregions: [],
    seoTitle: 'Central Berg | Visit Drakensberg',
    seoDescription: 'Explore Cathedral Peak, Giants Castle and Champagne Valley.',
  },
  {
    id: 'south-berg',
    slug: 'south-berg',
    name: 'South Berg',
    tagline: 'Sani Pass · Mkhomazi · Underberg',
    heroImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85',
    heroVideo: '',
    overview: 'The Sani Pass climbs 1,332 m in 9 km through a series of hairpin bends carved into the escarpment, crossing into the mountain Kingdom of Lesotho at 2,873 m. The Mkhomazi Wilderness Area below is one of the least visited and most pristine parts of the berg.',
    highlights: ['Sani Pass 4x4', 'Mkhomazi Wilderness', 'Garden Castle', 'Mzimkhulu Gorge'],
    gettingThere: '',
    bestTime: '',
    keyAttractions: [],
    subregions: [],
    seoTitle: 'South Berg | Visit Drakensberg',
    seoDescription: 'Explore Sani Pass, Mkhomazi and Underberg.',
  },
]

export function slugifyRegion(name: string) {
  return name.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Region names are entered freely in a few places (trail regions, showcase
// content) and canonically elsewhere (property/activity region dropdowns),
// so "North Berg", "Northern Berg" and "Royal Natal National Park" all need
// to be treated as compatible. Normalize the Northern/Southern adjective
// forms and fall back to substring matching (either name containing the
// other) so "Royal Natal" matches "Royal Natal National Park", etc.
export function normalizeRegionName(region: string | undefined | null): string {
  return (region || '').toLowerCase().trim().replace(/\bnorthern\b/, 'north').replace(/\bsouthern\b/, 'south')
}

export function regionsMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false
  const na = normalizeRegionName(a)
  const nb = normalizeRegionName(b)
  if (!na || !nb) return false
  return na.includes(nb) || nb.includes(na)
}

function normalizeRegion(region: Partial<Region> & { name: string; id?: string }): Region {
  const slug = region.slug || slugifyRegion(region.name)
  return {
    id: region.id || slug,
    slug,
    name: region.name,
    tagline: region.tagline || '',
    heroImage: region.heroImage || '',
    heroVideo: region.heroVideo || '',
    overview: region.overview || '',
    highlights: region.highlights || [],
    gettingThere: region.gettingThere || '',
    bestTime: region.bestTime || '',
    keyAttractions: region.keyAttractions || [],
    subregions: region.subregions || [],
    seoTitle: region.seoTitle || `${region.name} | Visit Drakensberg`,
    seoDescription: region.seoDescription || '',
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  }
}

async function saveRegions(regions: Region[]) {
  const { error } = await supabase.from('site_content').upsert(
    { key: 'admin_regions', value: { items: regions }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw error
}

export async function getRegions(): Promise<Region[]> {
  try {
    const { data } = await supabase.from('site_content').select('value').eq('key', 'admin_regions').maybeSingle()
    if (Array.isArray(data?.value?.items) && data.value.items.length > 0) {
      return data.value.items.map((item: Region) => normalizeRegion(item))
    }
  } catch {}
  return DEFAULT_REGIONS
}

export async function getRegionNames(): Promise<string[]> {
  const regions = await getRegions()
  return regions.map(region => region.name)
}

export async function createRegion(data: Omit<Region, 'id' | 'slug' | 'createdAt' | 'updatedAt'>): Promise<Region> {
  const all = await getRegions()
  const now = new Date().toISOString()
  const item = normalizeRegion({ ...data, createdAt: now, updatedAt: now })
  await saveRegions([...all.filter(region => region.slug !== item.slug), item])
  return item
}

export async function updateRegion(id: string, data: Omit<Region, 'id' | 'slug' | 'createdAt' | 'updatedAt'>): Promise<Region> {
  const all = await getRegions()
  const previous = all.find(region => region.id === id)
  const updated = normalizeRegion({ ...data, id, createdAt: previous?.createdAt, updatedAt: new Date().toISOString() })
  await saveRegions(all.map(region => region.id === id ? updated : region))
  return updated
}

export async function deleteRegion(id: string): Promise<void> {
  const all = await getRegions()
  await saveRegions(all.filter(region => region.id !== id))
}
