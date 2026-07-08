import { listEntities, getEntity, insertEntity, updateEntity } from './entities'
import { getSupplierEntities, type SupplierEntity } from './supplier-entities'

// Supplier directory: Tour Operator → Guide Team → Guide Profile.
// Operator public profiles are `operator_profile` entities owned by the
// supplier's auth account (id = `opr-<auth uuid>` so each supplier has exactly
// one). Guides are the existing `supplier_guides` entities, enriched with
// optional public-profile fields.

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

export function operatorProfileId(supplierId: string): string {
  return `opr-${supplierId}`
}

/** Published operator profiles. */
export async function getOperators(): Promise<OperatorProfile[]> {
  return (await listEntities<OperatorProfile>(KIND)).filter(o => o.status === 'active')
}

export async function getOperatorById(id: string): Promise<OperatorProfile | null> {
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

/** Verified guides for one operator. */
export async function getGuidesByOperator(operator: OperatorProfile): Promise<GuideProfile[]> {
  if (!operator.supplierId) return []
  const guides = await getSupplierEntities<GuideProfile>('guides', operator.supplierId)
  return guides.filter(g => g.status === 'verified')
}

/** All publicly listed guides (live verified). */
export async function getDirectoryGuides(): Promise<GuideProfile[]> {
  return (await getSupplierEntities<GuideProfile>('guides')).filter(g => g.status === 'verified')
}

export async function getGuideById(id: string): Promise<GuideProfile | null> {
  return getEntity<GuideProfile>('supplier_guides', id)
}

/** The operator a guide belongs to. */
export async function getOperatorForGuide(guide: GuideProfile): Promise<OperatorProfile | null> {
  if (!guide.supplierId) return null
  return getEntity<OperatorProfile>(KIND, operatorProfileId(guide.supplierId))
}
