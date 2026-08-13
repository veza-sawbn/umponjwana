import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId } from './entities'
import type { GraphFields } from './graph-fields'
import type { SupabaseClient } from '@supabase/supabase-js'

// Marketplace packages are administrator-managed products, curated by Visit
// Drakensberg from services supplied by multiple businesses. Suppliers cannot
// create packages. Stored as `package` entities owned by the admin account;
// the entity status column mirrors public visibility ('active' only while
// packageStatus === 'published'), while the full lifecycle lives in
// `packageStatus`.

export type PackageStatus =
  | 'draft'
  | 'supplier_review'
  | 'pending_confirmation'
  | 'ready_for_sale'
  | 'published'
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'archived'

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  draft: 'Draft',
  supplier_review: 'Supplier Review',
  pending_confirmation: 'Pending Confirmation',
  ready_for_sale: 'Ready for Sale',
  published: 'Published',
  booked: 'Booked',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
}

export type PackageComponentType =
  | 'accommodation'
  | 'activity'
  | 'trail'
  | 'experience'
  | 'guide'
  | 'transfer'
  | 'restaurant'
  | 'equipment'
  | 'local_experience'
  | 'flight'
  | 'insurance'

export const COMPONENT_TYPE_LABELS: Record<PackageComponentType, string> = {
  accommodation: 'Accommodation',
  activity: 'Activity',
  trail: 'Hiking Trail',
  experience: 'Experience',
  guide: 'Guide',
  transfer: 'Transfer',
  restaurant: 'Restaurant',
  equipment: 'Equipment Rental',
  local_experience: 'Local Experience',
  flight: 'Flight (future)',
  insurance: 'Insurance (future)',
}

export type PackageComponent = {
  id: string
  type: PackageComponentType
  title: string
  // Supplier relationship — each supplier only ever receives the fulfilment
  // record for their own component, never the whole package.
  supplierId: string          // auth uuid where known, '' for internal/manual
  supplierName: string
  supplierContact: string
  costPrice: number
  sellingPrice: number
  commissionPct: number
  availability: string
  bookingRules: string
  cancellationRules: string
  notes: string               // operational notes forwarded to the supplier
  trailId?: string            // set when the component references a hiking trail
  refId?: string              // linked catalog entity (property/activity/tour id)
}

export function componentMargin(c: PackageComponent): number {
  return c.sellingPrice - c.costPrice
}

export type MarketplacePackage = {
  id: string
  title: string
  summary: string
  description: string
  image: string
  region: string
  durationNights: number
  maxGuests: number
  pricePerPerson: number
  originalPrice?: number
  tag?: string
  featured: boolean
  trailIds: string[]          // packages may contain one or more Trail IDs
  components: PackageComponent[]
  packageStatus: PackageStatus
  publishFrom?: string        // scheduled publishing window
  publishTo?: string
  status: 'active' | 'draft'  // entity column mirror: 'active' ⇔ publicly visible
  supplierId?: string         // owner (admin account) for the entity row
  createdAt: string
  updatedAt?: string
} & GraphFields

const KIND = 'package'

const publicStatus = (s: PackageStatus): 'active' | 'draft' => (s === 'published' ? 'active' : 'draft')

export function packageTotals(pkg: MarketplacePackage) {
  const cost = pkg.components.reduce((s, c) => s + c.costPrice, 0)
  const sell = pkg.components.reduce((s, c) => s + c.sellingPrice, 0)
  return { cost, sell, margin: sell - cost }
}

export async function getPackages(client?: SupabaseClient): Promise<MarketplacePackage[]> {
  return client ? listEntities<MarketplacePackage>(KIND, client) : listEntities<MarketplacePackage>(KIND)
}

/** Packages visible on the public site (published, inside their window). */
export async function getPublishedPackages(): Promise<MarketplacePackage[]> {
  const today = new Date().toISOString().slice(0, 10)
  return (await getPackages()).filter(p =>
    p.packageStatus === 'published' &&
    (!p.publishFrom || p.publishFrom <= today) &&
    (!p.publishTo || p.publishTo >= today)
  )
}

export async function getPackageById(id: string, client?: SupabaseClient): Promise<MarketplacePackage | null> {
  return client ? getEntity<MarketplacePackage>(KIND, id, client) : getEntity<MarketplacePackage>(KIND, id)
}

export async function addPackage(
  pkg: Omit<MarketplacePackage, 'id' | 'status' | 'createdAt'>,
  adminId: string,
): Promise<MarketplacePackage> {
  const item: MarketplacePackage = {
    ...pkg,
    id: newEntityId('pkg'),
    status: publicStatus(pkg.packageStatus),
    supplierId: adminId,
    createdAt: new Date().toISOString(),
  }
  return insertEntity(KIND, item)
}

export async function updatePackage(id: string, patch: Partial<MarketplacePackage>): Promise<void> {
  const withStatus = patch.packageStatus
    ? { ...patch, status: publicStatus(patch.packageStatus) }
    : patch
  await updateEntity(KIND, id, { ...withStatus, updatedAt: new Date().toISOString() })
}

export async function setPackageStatus(id: string, packageStatus: PackageStatus): Promise<void> {
  await updatePackage(id, { packageStatus })
}

export async function duplicatePackage(id: string, adminId: string): Promise<MarketplacePackage | null> {
  const original = await getPackageById(id)
  if (!original) return null
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original
  return addPackage(
    { ...rest, title: `${original.title} (copy)`, packageStatus: 'draft', featured: false },
    adminId,
  )
}

export async function deletePackage(id: string): Promise<void> {
  await deleteEntity(KIND, id)
}
