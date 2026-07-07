import { listEntities, getEntity, insertEntity, updateEntity } from './entities'
import { getSupplierEntities, type SupplierEntity } from './supplier-entities'

// Supplier directory: Tour Operator → Guide Team → Guide Profile.
// Operator public profiles are `operator_profile` entities owned by the
// supplier's auth account (id = `opr-<auth uuid>` so each supplier has exactly
// one). Guides are the existing `supplier_guides` entities, enriched with
// optional public-profile fields. Showcase entries keep the directory alive
// while the live marketplace is still filling up, mirroring /stays.

export type OperatorProfile = {
  id: string                 // `opr-${supplierId}`
  supplierId: string         // auth user id of the tour operator
  companyName: string
  logo: string
  location: string
  yearsOperating: number
  certifications: string[]
  languages: string[]
  activities: string[]
  overview: string
  operatingRegions: string[]
  licences: string[]
  insurance: string
  emergencyProcedures: string
  equipmentOwned: string[]
  rating: number | null
  reviewCount: number
  status: 'active' | 'draft'
  createdAt: string
  showcase?: boolean
}

export type GuideProfile = SupplierEntity & {
  name: string
  certs: string
  guideNo: string
  speciality: string
  languages: string
  rating: number
  tours: number
  status: string
  blocked?: string[]
  // Optional public-profile fields
  portrait?: string
  bio?: string
  qualifications?: string
  yearsExperience?: number
  specialisations?: string
  highestSummit?: string
  completedExpeditions?: number
}

const KIND = 'operator_profile'

export const DEFAULT_OPERATORS: OperatorProfile[] = [
  {
    id: 'opr-showcase-berg-adventures',
    supplierId: '',
    companyName: 'Berg Adventures',
    logo: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
    location: 'Winterton, Central Berg',
    yearsOperating: 14,
    certifications: ['FGASA Accredited', 'TBCSA Registered', 'Mountain Club of SA'],
    languages: ['English', 'Zulu', 'Afrikaans'],
    activities: ['Multi-day traverses', 'Summit hikes', 'San rock art tours'],
    overview: 'Berg Adventures has led guided expeditions across the full Drakensberg escarpment since 2012. From single-day summit pushes to the full Grand Traverse, every departure runs with certified guides, satellite communication and comprehensive safety cover.',
    operatingRegions: ['Royal Natal National Park', 'Northern Berg', 'Central Berg'],
    licences: ['KZN Tourism Operator Licence 4471', 'Wilderness Area Access Permit'],
    insurance: 'Public liability cover to R10m through SATIB. All clients covered for mountain rescue evacuation.',
    emergencyProcedures: 'Every departure carries a satellite phone, first-aid kit and emergency shelter. Guides hold Wilderness First Responder certification. Routes are lodged with Mountain Rescue before departure.',
    equipmentOwned: ['Expedition tents', 'Satellite phones', 'Technical rope kit', 'Group first-aid kits'],
    rating: 4.9,
    reviewCount: 143,
    status: 'active',
    createdAt: '2020-01-01T00:00:00.000Z',
    showcase: true,
  },
  {
    id: 'opr-showcase-amphitheatre-treks',
    supplierId: '',
    companyName: 'Amphitheatre Treks',
    logo: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=400&q=80',
    location: 'Bergville, Northern Berg',
    yearsOperating: 9,
    certifications: ['FGASA Accredited', 'TBCSA Registered'],
    languages: ['English', 'Zulu', 'Sotho', 'German'],
    activities: ['Day hikes', 'Chain ladder ascents', 'Photography walks'],
    overview: 'Specialists in the Amphitheatre and Royal Natal area. Small groups, flexible departures and a strong focus on first-time Berg visitors and photographers chasing golden-hour light on the escarpment.',
    operatingRegions: ['Royal Natal National Park', 'Northern Berg'],
    licences: ['KZN Tourism Operator Licence 5120'],
    insurance: 'Public liability cover to R5m. Client evacuation cover included on all bookings.',
    emergencyProcedures: 'Guides carry two-way radios with base contact. Weather is assessed at 04:30 on departure days; chain ladder ascents are cancelled in high wind.',
    equipmentOwned: ['Trekking poles', 'Emergency shelters', 'Two-way radios'],
    rating: 4.8,
    reviewCount: 78,
    status: 'active',
    createdAt: '2020-01-01T00:00:00.000Z',
    showcase: true,
  },
]

export const DEFAULT_DIRECTORY_GUIDES: GuideProfile[] = [
  {
    id: 'g1', supplierId: '', createdAt: '2019-01-01T00:00:00.000Z',
    name: 'Sipho Dlamini', certs: 'FGASA Level 3', guideNo: 'TBCSA-G-0091',
    speciality: 'San rock art & multi-day traverses', languages: 'English, Zulu, Sotho',
    rating: 4.9, tours: 87, status: 'verified',
    bio: 'Born and raised in the shadow of the Drakensberg, Sipho has spent 15 years guiding across the full escarpment.',
    qualifications: 'FGASA Level 3, Wilderness First Responder',
    yearsExperience: 15, specialisations: 'Rock climbing, Birding, San rock art, Multi-day traverses',
    highestSummit: 'Mafadi (3,450m)', completedExpeditions: 210,
  },
  {
    id: 'g2', supplierId: '', createdAt: '2021-01-01T00:00:00.000Z',
    name: 'Anele Mokoena', certs: 'FGASA Level 2', guideNo: 'TBCSA-G-0144',
    speciality: 'Day hikes & wildflower identification', languages: 'English, Xhosa',
    rating: 4.8, tours: 54, status: 'verified',
    bio: 'Anele is a passionate conservationist with a deep love for the endemic flora of the Drakensberg.',
    qualifications: 'FGASA Level 2, Botanical Society Certification',
    yearsExperience: 6, specialisations: 'Day hikes, Wildflower identification, Photography',
    highestSummit: 'Cathkin Peak (3,149m)', completedExpeditions: 95,
  },
  {
    id: 'g3', supplierId: '', createdAt: '2020-01-01T00:00:00.000Z',
    name: 'Thabo Ndlovu', certs: 'FGASA Level 3', guideNo: 'TBCSA-G-0203',
    speciality: 'Multi-day wilderness traverses', languages: 'English, Zulu, Afrikaans',
    rating: 4.9, tours: 112, status: 'verified',
    bio: 'A former park ranger who turned his skills into a guiding career, Thabo specialises in multi-day wilderness traverses and survival skills.',
    qualifications: 'FGASA Level 3, Advanced Wilderness Life Support',
    yearsExperience: 12, specialisations: 'Multi-day hikes, Survival skills, Wildlife tracking',
    highestSummit: 'Thabana Ntlenyana (3,482m)', completedExpeditions: 180,
  },
]

// Showcase guide team assignments (guide id → showcase operator id)
export const SHOWCASE_TEAMS: Record<string, string[]> = {
  'opr-showcase-berg-adventures': ['g1', 'g3'],
  'opr-showcase-amphitheatre-treks': ['g2'],
}

export function operatorProfileId(supplierId: string): string {
  return `opr-${supplierId}`
}

/** Live operator profiles merged with showcase entries (live first). */
export async function getOperators(): Promise<OperatorProfile[]> {
  const live = (await listEntities<OperatorProfile>(KIND)).filter(o => o.status === 'active')
  return [...live, ...DEFAULT_OPERATORS]
}

export async function getOperatorById(id: string): Promise<OperatorProfile | null> {
  const showcase = DEFAULT_OPERATORS.find(o => o.id === id)
  if (showcase) return showcase
  return getEntity<OperatorProfile>(KIND, id)
}

/** The signed-in supplier's own profile (draft or active). */
export async function getMyOperatorProfile(supplierId: string): Promise<OperatorProfile | null> {
  return getEntity<OperatorProfile>(KIND, operatorProfileId(supplierId))
}

export async function saveOperatorProfile(
  supplierId: string,
  data: Omit<OperatorProfile, 'id' | 'supplierId' | 'createdAt'>,
): Promise<OperatorProfile> {
  const id = operatorProfileId(supplierId)
  const existing = await getEntity<OperatorProfile>(KIND, id)
  if (existing) {
    await updateEntity(KIND, id, { ...data, supplierId })
    return { ...existing, ...data, id, supplierId }
  }
  const profile: OperatorProfile = { ...data, id, supplierId, createdAt: new Date().toISOString() }
  return insertEntity(KIND, profile)
}

/** Verified guides for one operator (live) or a showcase team. */
export async function getGuidesByOperator(operator: OperatorProfile): Promise<GuideProfile[]> {
  if (operator.showcase) {
    const team = SHOWCASE_TEAMS[operator.id] ?? []
    return DEFAULT_DIRECTORY_GUIDES.filter(g => team.includes(g.id))
  }
  const guides = await getSupplierEntities<GuideProfile>('guides', operator.supplierId)
  return guides.filter(g => g.status === 'verified')
}

/** All publicly listed guides (live verified + showcase). */
export async function getDirectoryGuides(): Promise<GuideProfile[]> {
  const live = (await getSupplierEntities<GuideProfile>('guides')).filter(g => g.status === 'verified')
  return [...live, ...DEFAULT_DIRECTORY_GUIDES]
}

export async function getGuideById(id: string): Promise<GuideProfile | null> {
  const showcase = DEFAULT_DIRECTORY_GUIDES.find(g => g.id === id)
  if (showcase) return showcase
  return getEntity<GuideProfile>('supplier_guides', id)
}

/** The operator a guide belongs to (live guides only; showcase via SHOWCASE_TEAMS). */
export async function getOperatorForGuide(guide: GuideProfile): Promise<OperatorProfile | null> {
  const showcaseTeam = Object.entries(SHOWCASE_TEAMS).find(([, ids]) => ids.includes(guide.id))
  if (showcaseTeam) return DEFAULT_OPERATORS.find(o => o.id === showcaseTeam[0]) ?? null
  if (!guide.supplierId) return null
  return getEntity<OperatorProfile>(KIND, operatorProfileId(guide.supplierId))
}
