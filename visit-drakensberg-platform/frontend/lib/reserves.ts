import { supabase } from './auth'

export type ReservePeak = { id: string; name: string; elevation: number; difficulty: 'accessible' | 'moderate' | 'expert' }

export type Reserve = {
  id: string
  slug: string
  /** Region this reserve is filed under (Region.slug). Empty = unassigned. */
  regionSlug: string
  name: string
  shortName: string
  tagline: string
  description: string
  image: string
  viewpointName: string
  bestTime: string
  permits: string
  facilities: string[]
  peaks: ReservePeak[]
  seoTitle: string
  seoDescription: string
  createdAt?: string
  updatedAt?: string
}

// Migrated from the previously hardcoded nature-reserves page. Each reserve is
// filed under a region (regionSlug matches DEFAULT_REGIONS slugs) so the public
// listing and admin console can group and navigate them by region.
export const DEFAULT_RESERVES: Reserve[] = [
  {
    id: 'ukhahlamba',
    slug: 'ukhahlamba',
    regionSlug: 'central-berg',
    name: 'uKhahlamba-Drakensberg Park',
    shortName: 'uKhahlamba',
    tagline: 'UNESCO World Heritage Site · KwaZulu-Natal',
    description:
      "The flagship Drakensberg reserve, inscribed as a UNESCO World Heritage Site in 2000. Stretching across 243,000 hectares of soaring basalt cliffs, ancient San rock art, and highland wilderness, uKhahlamba-Drakensberg Park is one of Africa's most spectacular protected areas. The escarpment reaches its highest points here, with peaks exceeding 3,400 metres providing dramatic vistas across the Kingdom of Lesotho.",
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1400&q=85',
    viewpointName: 'Amphitheatre Viewpoint',
    bestTime: 'April–September (dry season). Avoid December–February (afternoon thunderstorms).',
    permits: 'Ezemvelo KZN Wildlife permit required. R200/person/night for overnight hikes. Day visitors R70/person.',
    facilities: ['Campsite', 'Chalets', 'Guided hikes', 'Visitor centre', 'Restaurant', 'Curio shop'],
    peaks: [
      { id: 'p1', name: 'Champagne Castle', elevation: 3377, difficulty: 'expert' },
      { id: 'p2', name: 'Cathkin Peak', elevation: 3149, difficulty: 'expert' },
      { id: 'p3', name: 'Monks Cowl', elevation: 3234, difficulty: 'expert' },
      { id: 'p4', name: 'Sterkhorn', elevation: 3084, difficulty: 'expert' },
      { id: 'p5', name: 'Ndedema Dome', elevation: 3085, difficulty: 'moderate' },
      { id: 'p6', name: "Dragon's Back", elevation: 3017, difficulty: 'moderate' },
    ],
    seoTitle: 'uKhahlamba-Drakensberg Park | Visit Drakensberg',
    seoDescription: 'Explore the uKhahlamba-Drakensberg Park — a UNESCO World Heritage Site of basalt cliffs, San rock art and highland wilderness.',
  },
  {
    id: 'royal-natal',
    slug: 'royal-natal',
    regionSlug: 'north-berg',
    name: 'Royal Natal National Park',
    shortName: 'Royal Natal',
    tagline: 'Home of the Amphitheatre · Northern Drakensberg',
    description:
      "Famous for the iconic Amphitheatre — a 5-kilometre curved basalt cliff wall rising 1,200 metres from the valley floor — Royal Natal National Park is arguably the most dramatic landscape in the Drakensberg. Tugela Falls, the world's second highest waterfall at 947 metres, plunges from the escarpment in five separate cascades. The park encompasses 8,094 hectares of pristine mountain terrain with exceptional hiking opportunities for all levels.",
    image: 'https://images.unsplash.com/photo-1439853949212-36589f9df9d7?w=1400&q=85',
    viewpointName: 'Thendele Camp Viewpoint',
    bestTime: 'May–August (clear skies, dry). Wildflowers in spring (September–November).',
    permits: 'SANParks permit required. R372/adult/day (international). R186/adult/day (SADC). Chalets must be pre-booked.',
    facilities: ['Thendele Camp (chalets)', 'Mahai Campsite', 'Day visitor area', 'Ranger station', 'Nature walks'],
    peaks: [
      { id: 'p1', name: 'The Sentinel', elevation: 3165, difficulty: 'moderate' },
      { id: 'p2', name: 'Eastern Buttress', elevation: 3047, difficulty: 'expert' },
      { id: 'p3', name: 'Inner Tower', elevation: 2986, difficulty: 'expert' },
      { id: 'p4', name: 'Outer Tower', elevation: 3005, difficulty: 'expert' },
    ],
    seoTitle: 'Royal Natal National Park | Visit Drakensberg',
    seoDescription: 'Explore Royal Natal National Park — home of the Amphitheatre and Tugela Falls, the second highest waterfall on Earth.',
  },
  {
    id: 'giants-castle',
    slug: 'giants-castle',
    regionSlug: 'central-berg',
    name: "Giant's Castle Reserve",
    shortName: "Giant's Castle",
    tagline: 'San Rock Art & Bearded Vultures · Central Drakensberg',
    description:
      "Giant's Castle Reserve protects one of the Drakensberg's most significant San rock art sites — the Main Caves shelter contains over 550 individual paintings. The reserve is also the only place in South Africa where the endangered Bearded Vulture (Lammergeier) can be reliably seen, with a supplementary feeding hide drawing these magnificent birds from November to April. At 3,314 metres, Giant's Castle Peak dominates the reserve skyline.",
    image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1400&q=85',
    viewpointName: "Giant's Castle Main Camp Viewpoint",
    bestTime: 'November–April for Bearded Vulture feeding hide. June–August for summit hikes.',
    permits: 'Ezemvelo KZN Wildlife permit. Main Caves guided tour R60/person. Vulture hide bookings essential — R250/person.',
    facilities: ["Giant's Castle Camp (chalets)", 'Camping', 'Vulture hide', 'Museum', 'Guided rock art tours', 'Horse trails'],
    peaks: [
      { id: 'p1', name: "Giant's Castle", elevation: 3314, difficulty: 'expert' },
      { id: 'p2', name: 'Cleft Peak', elevation: 3281, difficulty: 'expert' },
      { id: 'p3', name: 'Nkosazane', elevation: 3071, difficulty: 'moderate' },
    ],
    seoTitle: "Giant's Castle Reserve | Visit Drakensberg",
    seoDescription: "Explore Giant's Castle Reserve — San rock art at the Main Caves and the Bearded Vulture feeding hide.",
  },
  {
    id: 'injisuthi',
    slug: 'injisuthi',
    regionSlug: 'central-berg',
    name: 'Injisuthi',
    shortName: 'Injisuthi',
    tagline: 'Remote wilderness & Battle Cave · Northern Central Drakensberg',
    description:
      'One of the most remote and least-visited of the major Drakensberg reserves, Injisuthi rewards those who seek it out with pristine wilderness, exceptional San rock art at Battle Cave (over 700 individual figures), and some of the best multi-day hiking in the range. The reserve encompasses the headwaters of the Injisuthi River and offers access to Champagne Castle from the north — a dramatic contrast to the southern approach.',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=85',
    viewpointName: 'Injisuthi Camp Ridge',
    bestTime: 'April–October. Very remote — carry all food and fuel. Cell coverage is non-existent.',
    permits: 'Ezemvelo KZN Wildlife permit. Battle Cave guided tour is mandatory R80/person. Book 3 months ahead in peak season.',
    facilities: ['Injisuthi Camp (chalets)', 'Campsite', 'Guided rock art tours', 'Environmental officer on site'],
    peaks: [
      { id: 'p1', name: 'Champagne Castle', elevation: 3377, difficulty: 'expert' },
      { id: 'p2', name: 'Rockeries Tower', elevation: 2853, difficulty: 'accessible' },
      { id: 'p3', name: 'Outer Tower', elevation: 3005, difficulty: 'expert' },
    ],
    seoTitle: 'Injisuthi | Visit Drakensberg',
    seoDescription: 'Explore Injisuthi — remote wilderness, the San rock art of Battle Cave, and a northern approach to Champagne Castle.',
  },
]

export function slugifyReserve(name: string) {
  return name.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalizeReserve(reserve: Partial<Reserve> & { name: string; id?: string }): Reserve {
  const slug = reserve.slug || slugifyReserve(reserve.name)
  return {
    id: reserve.id || slug,
    slug,
    regionSlug: reserve.regionSlug || '',
    name: reserve.name,
    shortName: reserve.shortName || reserve.name,
    tagline: reserve.tagline || '',
    description: reserve.description || '',
    image: reserve.image || '',
    viewpointName: reserve.viewpointName || '',
    bestTime: reserve.bestTime || '',
    permits: reserve.permits || '',
    facilities: reserve.facilities || [],
    peaks: reserve.peaks || [],
    seoTitle: reserve.seoTitle || `${reserve.name} | Visit Drakensberg`,
    seoDescription: reserve.seoDescription || '',
    createdAt: reserve.createdAt,
    updatedAt: reserve.updatedAt,
  }
}

async function saveReserves(reserves: Reserve[]) {
  const { error } = await supabase.from('site_content').upsert(
    { key: 'admin_reserves', value: { items: reserves }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw error
}

export async function getReserves(): Promise<Reserve[]> {
  const { data, error } = await supabase.from('site_content').select('value').eq('key', 'admin_reserves').maybeSingle()
  if (error) throw error
  if (Array.isArray(data?.value?.items) && data.value.items.length > 0) {
    return data.value.items.map((item: Reserve) => normalizeReserve(item))
  }
  return DEFAULT_RESERVES
}

export async function getReservesByRegion(regionSlug: string): Promise<Reserve[]> {
  const all = await getReserves()
  return all.filter(r => r.regionSlug === regionSlug)
}

export async function saveAllReserves(reserves: Reserve[]): Promise<void> {
  const now = new Date().toISOString()
  await saveReserves(reserves.map(r => normalizeReserve({ ...r, updatedAt: r.updatedAt ?? now })))
}

export async function createReserve(data: Omit<Reserve, 'id' | 'slug' | 'createdAt' | 'updatedAt'>): Promise<Reserve> {
  const all = await getReserves()
  const now = new Date().toISOString()
  const item = normalizeReserve({ ...data, createdAt: now, updatedAt: now })
  await saveReserves([...all.filter(r => r.slug !== item.slug), item])
  return item
}

export async function updateReserve(id: string, data: Omit<Reserve, 'id' | 'slug' | 'createdAt' | 'updatedAt'>): Promise<Reserve> {
  const all = await getReserves()
  const previous = all.find(r => r.id === id)
  const updated = normalizeReserve({ ...data, id, slug: previous?.slug, createdAt: previous?.createdAt, updatedAt: new Date().toISOString() })
  const next = previous ? all.map(r => r.id === id ? updated : r) : [...all, updated]
  await saveReserves(next)
  return updated
}

export async function deleteReserve(id: string): Promise<void> {
  const all = await getReserves()
  await saveReserves(all.filter(r => r.id !== id))
}
