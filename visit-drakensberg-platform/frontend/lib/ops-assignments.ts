import { supabase } from './auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpsRole =
  | 'reservation_agent'
  | 'reservations_manager'
  | 'asset_manager'
  | 'ops_administrator'

export const OPS_ROLES: { value: OpsRole; label: string; description: string }[] = [
  {
    value: 'reservation_agent',
    label: 'Reservation Agent',
    description:
      'View assigned suppliers, listings, and availability. Manage bookings and customer communications.',
  },
  {
    value: 'reservations_manager',
    label: 'Reservations Manager',
    description:
      'Everything a Reservation Agent can do, plus manage inventory, availability, rates, bookings, and supplier assignments.',
  },
  {
    value: 'asset_manager',
    label: 'Asset Manager',
    description:
      'Everything a Reservations Manager can do, plus manage listings/content, pricing, packages, and commercial configuration.',
  },
  {
    value: 'ops_administrator',
    label: 'Operations Administrator',
    description:
      'Broad operational administration of all managed suppliers. Does NOT grant unrestricted platform administration.',
  },
]

export const OPS_ROLE_LABEL: Record<OpsRole, string> = {
  reservation_agent: 'Reservation Agent',
  reservations_manager: 'Reservations Manager',
  asset_manager: 'Asset Manager',
  ops_administrator: 'Operations Administrator',
}

// Default permission sets per role (used when inviting or assigning)
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<OpsRole, string[]> = {
  reservation_agent: [
    'view_supplier',
    'view_inventory',
    'view_availability',
    'view_bookings',
    'view_customers',
    'manage_customers',
  ],
  reservations_manager: [
    'view_supplier',
    'edit_supplier',
    'view_inventory',
    'manage_inventory',
    'view_availability',
    'manage_availability',
    'view_rates',
    'manage_rates',
    'view_bookings',
    'manage_bookings',
    'view_customers',
    'manage_customers',
  ],
  asset_manager: [
    'view_supplier',
    'edit_supplier',
    'view_inventory',
    'manage_inventory',
    'view_availability',
    'manage_availability',
    'view_rates',
    'manage_rates',
    'view_bookings',
    'manage_bookings',
    'view_customers',
    'manage_customers',
    'manage_content',
    'manage_packages',
    'view_financials',
    'manage_financials',
    'view_contract',
  ],
  ops_administrator: [
    'view_supplier',
    'edit_supplier',
    'view_inventory',
    'manage_inventory',
    'view_availability',
    'manage_availability',
    'view_rates',
    'manage_rates',
    'view_bookings',
    'manage_bookings',
    'view_customers',
    'manage_customers',
    'manage_content',
    'manage_packages',
    'view_financials',
    'manage_financials',
    'view_contract',
    'manage_contract',
  ],
}

export const ALL_PERMISSIONS = [
  { key: 'view_supplier',        label: 'View Supplier' },
  { key: 'edit_supplier',        label: 'Edit Supplier Profile' },
  { key: 'view_inventory',       label: 'View Inventory' },
  { key: 'manage_inventory',     label: 'Manage Inventory' },
  { key: 'view_availability',    label: 'View Availability' },
  { key: 'manage_availability',  label: 'Manage Availability' },
  { key: 'view_rates',           label: 'View Rates' },
  { key: 'manage_rates',         label: 'Manage Rates' },
  { key: 'view_bookings',        label: 'View Bookings' },
  { key: 'manage_bookings',      label: 'Manage Bookings' },
  { key: 'view_customers',       label: 'View Customers' },
  { key: 'manage_customers',     label: 'Manage Customers & Communications' },
  { key: 'manage_content',       label: 'Manage Content & Listings' },
  { key: 'manage_packages',      label: 'Manage Packages' },
  { key: 'view_financials',      label: 'View Financials' },
  { key: 'manage_financials',    label: 'Manage Financials' },
  { key: 'view_contract',        label: 'View Commercial Agreement' },
  { key: 'manage_contract',      label: 'Manage Commercial Agreement' },
]

// ─── Assignment types ─────────────────────────────────────────────────────────

export type OpsAssignment = {
  id: string
  employee_id: string
  supplier_id: string
  permissions: string[]
  started_at: string
  ended_at: string | null
  is_active: boolean
  assigned_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ManagedSupplierSummary = {
  supplier_id: string
  supplier_name: string | null
  supplier_email: string | null
  supplier_type: string | null
  approval_status: string | null
  permissions: string[]
  is_active: boolean
  started_at: string
  ended_at: string | null
  management_model: string
  management_status: string
  agreement_type: string
  commission_rate: number | null
  management_fee: number | null
}

export type OpsAssignmentDetails = OpsAssignment & {
  employee_name: string | null
  employee_email: string | null
  ops_role: OpsRole | null
  organisation: string | null
  supplier_name: string | null
  supplier_email: string | null
  supplier_type: string | null
  approval_status: string | null
  management_model: string | null
  management_status: string | null
  agreement_type: string | null
  commission_rate: number | null
}

// ─── Functions ────────────────────────────────────────────────────────────────

/** Get the list of suppliers the current user is assigned to manage. */
export async function getMyManagedSuppliers(): Promise<ManagedSupplierSummary[]> {
  try {
    const { data } = await supabase
      .from('vd_managed_suppliers_summary')
      .select('*')
    return (data ?? []) as ManagedSupplierSummary[]
  } catch {
    return []
  }
}

/** Check if the current user has an active assignment for a specific supplier. */
export async function isManagedSupplier(supplierId: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('is_managed_supplier', {
      p_supplier_id: supplierId,
    })
    return Boolean(data)
  } catch {
    return false
  }
}

/** Get all assignment details — for the admin assignments view. */
export async function getAllAssignmentDetails(): Promise<OpsAssignmentDetails[]> {
  try {
    const { data } = await supabase
      .from('vd_ops_assignment_details')
      .select('*')
      .order('created_at', { ascending: false })
    return (data ?? []) as OpsAssignmentDetails[]
  } catch {
    return []
  }
}

/** Get assignments for a specific supplier — for the admin supplier detail view. */
export async function getAssignmentsForSupplier(supplierId: string): Promise<OpsAssignmentDetails[]> {
  try {
    const { data } = await supabase
      .from('vd_ops_assignment_details')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
    return (data ?? []) as OpsAssignmentDetails[]
  } catch {
    return []
  }
}

/** Get assignments for a specific employee — for the admin employee detail view. */
export async function getAssignmentsForEmployee(employeeId: string): Promise<OpsAssignmentDetails[]> {
  try {
    const { data } = await supabase
      .from('vd_ops_assignment_details')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    return (data ?? []) as OpsAssignmentDetails[]
  } catch {
    return []
  }
}

/** Create or update a management assignment (admin only — goes through API route). */
export async function setAssignment(params: {
  employeeId: string
  supplierId: string
  permissions: string[]
  isActive?: boolean
  endedAt?: string | null
  notes?: string | null
}): Promise<string> {
  const res = await fetch('/api/admin/ops/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Could not save assignment')
  return json.assignmentId as string
}

/**
 * Get all VD Operations employees — for the Operations Team table and assignment form.
 *
 * Queries by staff_role='operations' rather than ops_role/organisation so that
 * users who were invited before the migration (or whose profile was already
 * present and skipped by ON CONFLICT DO NOTHING) are still visible.
 * The UI shows these as "Setup Required" and lets the admin set their ops_role.
 */
export async function getOpsEmployees(): Promise<{
  id: string
  full_name: string | null
  email: string | null
  staff_role: string | null
  ops_role: OpsRole | null
  organisation: string | null
  created_at: string
  /** True when ops_role + organisation are both set — false means profile needs configuration */
  setup_complete: boolean
}[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, staff_role, ops_role, organisation, created_at')
      .eq('staff_role', 'operations')
      .order('full_name', { ascending: true })
    return (data ?? []).map((row: any) => ({
      ...row,
      setup_complete: !!(row.ops_role && row.organisation === 'vd_operations'),
    })) as any[]
  } catch {
    return []
  }
}
