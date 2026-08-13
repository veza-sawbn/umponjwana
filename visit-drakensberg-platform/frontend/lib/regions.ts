import { supabase } from './auth'
import type { SupabaseClient } from '@supabase/supabase-js'

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
    // id/slug intentionally unchanged — these back live URLs (/regions/north-berg)
    // and are not part of the public terminology rename. See
    // docs/destination-graph/PHASE_A.md "Region naming" for the rationale:
    // display name changes, canonical URL does not.
    id: 'north-berg',
    slug: 'north-berg',
    name: 'Northern Drakensberg',
    tagline: 'Royal Natal National Park · Amphitheatre',
    heroImage: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1200&q=85',
    heroVideo: '',
    overview: 'The Amphitheatre — a 5 km sheer basalt cliff — anchors the Northern Drakensberg. The Tugela River drops 948 metres over five falls here, making it the second highest waterfall on Earth. Royal Natal National Park offers some of the most dramatic scenery in Africa.',
    highlights: ['Tugela Falls Circuit', 'Amphitheatre via Chain Ladder', 'Policemans Helmet', 'Mont-aux-Sources'],
    gettingThere: '',
    bestTime: '',
    keyAttractions: [],
    subregions: [],
    seoTitle: 'Northern Drakensberg | Visit Drakensberg',
    seoDescription: 'Explore Royal Natal National Park, the Amphitheatre and Tugela Falls.',
  },
  {
    id: 'central-berg',
    slug: 'central-berg',
    name: 'Central Drakensberg',
    tagline: 'Cathedral Peak · Giants Castle · Champagne Valley',
    heroImage: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1200&q=85',
    heroVideo: '',
    overview: 'Cathedral Peak rises to 3,004 m at the heart of the Central Drakensberg, surrounded by the richest concentration of San rock art in the world. Giants Castle Game Reserve protects bearded vultures and herds of eland against a backdrop of jagged peaks.',
    highlights: ['Cathedral Peak Summit', 'Giants Castle Hike', 'Injasuti Cave', 'Champagne Castle'],
    gettingThere: '',
    bestTime: '',
    keyAttractions: [],
    subregions: [],
    seoTitle: 'Central Drakensberg | Visit Drakensberg',
    seoDescription: 'Explore Cathedral Peak, Giants Castle and Champagne Valley.',
  },
  {
    id: 'south-berg',
    slug: 'south-berg',
    name: 'Southern Drakensberg',
    tagline: 'Sani Pass · Mkhomazi · Underberg',
    heroImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85',
    heroVideo: '',
    overview: 'The Sani Pass climbs 1,332 m in 9 km through a series of hairpin bends carved into the escarpment, crossing into the mountain Kingdom of Lesotho at 2,873 m. The Mkhomazi Wilderness Area below is one of the least visited and most pristine parts of the Southern Drakensberg.',
    highlights: ['Sani Pass 4x4', 'Mkhomazi Wilderness', 'Garden Castle', 'Mzimkhulu Gorge'],
    gettingThere: '',
    bestTime: '',
    keyAttractions: [],
    subregions: [],
    seoTitle: 'Southern Drakensberg | Visit Drakensberg',
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
//
// SUBREGION_ALIASES maps normalised park / subregion names → normalised parent
// region name. This covers cases where substring matching cannot work because
// the park name shares no words with the parent region name (e.g. "royal natal
// national park" ↔ "north drakensberg").
//
// Target values use the current canonical region names ("Northern/Central/
// Southern Drakensberg", normalised). The first three entries are a
// backward-compatibility bridge: any entity whose free-text `region` field
// still says "North Berg" / "Central Berg" / "South Berg" — the previous
// public terminology, and still perfectly valid supplier/admin-entered data —
// continues to resolve correctly against the renamed canonical regions with
// no data migration required. Do not remove these without confirming no
// live entity still carries the old wording.
const SUBREGION_ALIASES: Record<string, string> = {
  'north berg':                'north drakensberg',
  'central berg':              'central drakensberg',
  'south berg':                'south drakensberg',

  'royal natal national park': 'north drakensberg',
  'royal natal':               'north drakensberg',
  'amphitheatre':              'north drakensberg',
  "giant's castle":            'central drakensberg',
  'giants castle':             'central drakensberg',
  'monks cowl':                'central drakensberg',
  'cathedral peak':            'central drakensberg',
  'champagne valley':          'central drakensberg',
  'champagne castle':          'central drakensberg',
  'mkhomazi':                  'south drakensberg',
  'mkhomazi wilderness':       'south drakensberg',
  'garden castle':             'south drakensberg',
  "bushman's nek":             'south drakensberg',
  'bushmans nek':              'south drakensberg',
  'sani pass':                 'south drakensberg',
  'drakensberg gardens':       'south drakensberg',
}

export function normalizeRegionName(region: string | undefined | null): string {
  return (region || '').toLowerCase().trim().replace(/\bnorthern\b/, 'north').replace(/\bsouthern\b/, 'south')
}

export function regionsMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false
  const na = normalizeRegionName(a)
  const nb = normalizeRegionName(b)
  if (!na || !nb) return false
  // Exact / substring match (handles "North Berg" ↔ "Northern Berg" etc.)
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  // Subregion alias — check whether either side is an alias for the other's parent region
  const aliasA = SUBREGION_ALIASES[na]
  const aliasB = SUBREGION_ALIASES[nb]
  if (aliasA && (aliasA === nb || nb.includes(aliasA) || aliasA.includes(nb))) return true
  if (aliasB && (aliasB === na || na.includes(aliasB) || aliasB.includes(na))) return true
  return false
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

// Accepts an optional Supabase client so Server Components can pass a
// session-less client (lib/supabase-public.ts) instead of the browser
// client-component client this module defaults to — every existing caller
// is unaffected since the parameter defaults to the current behaviour.
export async function getRegions(client: SupabaseClient = supabase): Promise<Region[]> {
  try {
    const { data } = await client.from('site_content').select('value').eq('key', 'admin_regions').maybeSingle()
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
