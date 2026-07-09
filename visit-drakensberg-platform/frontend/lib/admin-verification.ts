import { supabase } from './auth'
import { listEntities, updateEntity } from './entities'
import { notify } from './notifications'
import { getMyOperatorProfile, type OperatorProfile } from './operators'

// Admin verification console data layer: moderate supplier accounts and the
// catalog entities they submit (guides/instructors, drivers, vehicles,
// properties, rooms). Approval maps onto each kind's public status; suspended
// and rejected rows are automatically hidden from visitors because the
// vd_entities public-read RLS policy only exposes
// active/open/confirmed/full/verified rows.

export type ModerationDecision = 'approved' | 'suspended' | 'rejected'
export type ModerationStatus = ModerationDecision | 'pending'

export type VerificationKind = {
  key: string
  label: string
  entityKind: string           // vd_entities kind
  approvedStatus: string       // status written on approval ('verified' | 'active')
  nameFields: string[]         // first non-empty field becomes the display name
}

export const VERIFICATION_KINDS: VerificationKind[] = [
  { key: 'guides', label: 'Guides & Instructors', entityKind: 'supplier_guides', approvedStatus: 'verified', nameFields: ['name', 'fullName'] },
  { key: 'drivers', label: 'Drivers', entityKind: 'supplier_drivers', approvedStatus: 'verified', nameFields: ['fullName', 'name'] },
  { key: 'vehicles', label: 'Vehicles', entityKind: 'supplier_vehicles', approvedStatus: 'active', nameFields: ['name', 'make', 'reg', 'registration'] },
  { key: 'properties', label: 'Properties', entityKind: 'property', approvedStatus: 'active', nameFields: ['name'] },
  { key: 'rooms', label: 'Rooms', entityKind: 'room', approvedStatus: 'active', nameFields: ['name'] },
]

export type VerificationItem = {
  id: string
  supplierId: string
  name: string
  status: string
  createdAt: string
  fields: Record<string, unknown>
}

/** Normalise an entity's stored status onto the moderation scale. */
export function moderationStatus(status: string): ModerationStatus {
  if (status === 'active' || status === 'verified' || status === 'open') return 'approved'
  if (status === 'suspended') return 'suspended'
  if (status === 'rejected') return 'rejected'
  return 'pending' // pending / draft / anything else awaits review
}

/** Every submitted row of one kind — admins read all rows via RLS. */
export async function adminListKind(kind: VerificationKind): Promise<VerificationItem[]> {
  const rows = await listEntities<Record<string, any>>(kind.entityKind)
  return rows.map(row => {
    const name = kind.nameFields.map(f => row[f]).find(v => typeof v === 'string' && v.trim()) as string | undefined
    return {
      id: String(row.id),
      supplierId: String(row.supplierId ?? ''),
      name: name || `${kind.label.replace(/s$/, '')} ${String(row.id).slice(-6)}`,
      status: String(row.status ?? 'pending'),
      createdAt: String(row.createdAt ?? ''),
      fields: row,
    }
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

const DECISION_STATUS: Record<ModerationDecision, (kind: VerificationKind) => string> = {
  approved: kind => kind.approvedStatus,
  suspended: () => 'suspended',
  rejected: () => 'rejected',
}

const DECISION_COPY: Record<ModerationDecision, { title: (label: string) => string; body: string }> = {
  approved: { title: label => `Your ${label} was approved`, body: 'It has been verified against our listing policies and is now visible on Visit Drakensberg.' },
  suspended: { title: label => `Your ${label} was suspended`, body: 'It is temporarily hidden from Visit Drakensberg while under review. Contact support for details.' },
  rejected: { title: label => `Your ${label} was rejected`, body: 'It did not meet our listing policies and is not visible on Visit Drakensberg. Contact support if you believe this is an error.' },
}

/** Apply an admin decision to one entity and notify the owning supplier. */
export async function adminModerateEntity(kind: VerificationKind, item: VerificationItem, decision: ModerationDecision): Promise<string> {
  const status = DECISION_STATUS[decision](kind)
  await updateEntity(kind.entityKind, item.id, { status })
  const label = `${kind.label.replace(/s$/i, '').toLowerCase()} “${item.name}”`
  const copy = DECISION_COPY[decision]
  await notify(item.supplierId, 'approval', copy.title(label), copy.body, '/supplier')
  return status
}

// ── Supplier accounts ──────────────────────────────────────────────────────

export type SupplierAccount = {
  id: string
  name: string
  email: string
  bio: string
  status: ModerationStatus
  createdAt: string
}

export async function adminListSupplierAccounts(): Promise<SupplierAccount[]> {
  // approval_status arrives with 20260709_supplier_moderation.sql; fall back
  // to the boolean column when the migration hasn't been run yet.
  let rows: any[] | null = null
  const withStatus = await supabase
    .from('profiles')
    .select('id, full_name, email, bio, is_approved, approval_status, created_at')
    .eq('role', 'supplier')
    .order('created_at', { ascending: false })
  if (!withStatus.error) {
    rows = withStatus.data
  } else {
    const legacy = await supabase
      .from('profiles')
      .select('id, full_name, email, bio, is_approved, created_at')
      .eq('role', 'supplier')
      .order('created_at', { ascending: false })
    if (legacy.error) throw legacy.error
    rows = legacy.data
  }
  return (rows ?? []).map((p: any) => ({
    id: p.id,
    name: p.full_name || p.email || 'Unnamed supplier',
    email: p.email || '',
    bio: p.bio || '',
    status: (p.approval_status as ModerationStatus) ?? (p.is_approved ? 'approved' : 'pending'),
    createdAt: p.created_at,
  }))
}

export async function adminSetSupplierStatus(account: SupplierAccount, decision: ModerationDecision): Promise<void> {
  const { error } = await supabase.rpc('admin_set_supplier_status', { p_user: account.id, p_status: decision })
  if (error) {
    // Migration not run yet — fall back to the boolean approval RPC.
    const { error: legacyError } = await supabase.rpc('admin_set_supplier_approval', { p_user: account.id, p_approved: decision === 'approved' })
    if (legacyError) throw legacyError
  }
  const copy = {
    approved: ['Your supplier account is approved', 'You can now publish listings and receive bookings on Visit Drakensberg.'],
    suspended: ['Your supplier account is suspended', 'Your listings are hidden and you cannot publish new ones while suspended. Contact support for details.'],
    rejected: ['Your supplier application was rejected', 'Your application did not meet our verification policies. Contact support if you believe this is an error.'],
  }[decision]
  await notify(account.id, 'approval', copy[0], copy[1], '/supplier')
}

/** The supplier's public directory profile — the application information and
 *  policies (licences, insurance, emergency procedures) admins verify against. */
export async function adminSupplierApplication(supplierId: string): Promise<OperatorProfile | null> {
  return getMyOperatorProfile(supplierId)
}
