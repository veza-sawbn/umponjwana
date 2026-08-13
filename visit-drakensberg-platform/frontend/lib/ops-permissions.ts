/**
 * Operations Permission → Tool mapping
 *
 * The supplier portal decides WHAT tools exist based on supplier_type
 * (lib/supplier-config.ts). This module decides WHICH of those tools a
 * VD Operations employee may actually open, based on the permissions[]
 * granted on their assignment for that specific supplier.
 *
 * The two are orthogonal and both must pass:
 *
 *   supplier_type  →  the tool exists for this supplier
 *   permissions[]  →  this employee may use it on this supplier
 *
 * This is deliberately NOT an admin model. An employee with `view_bookings`
 * on Supplier A and `manage_rates` on Supplier B sees exactly the Bookings
 * tool for A and the Rates tools for B — nothing else, nowhere else.
 *
 * Every entry here is a *read* gate (can the tool be opened at all). Write
 * capability inside a tool is enforced separately by RLS at the database
 * layer via has_supplier_permission(), so a mis-mapping here can never
 * escalate what the employee can actually change.
 */

import {
  CalendarDays, Clock, Wallet, Users, Building2, Tag,
  type LucideIcon,
} from 'lucide-react'
import type { NavItem, SupplierType } from './supplier-config'
import { mergeNavForTypes } from './supplier-config'

/**
 * Maps a supplier-portal route to the permission required to open it.
 * A route not listed here falls back to `view_supplier` (the baseline
 * permission every assignment carries).
 */
const ROUTE_PERMISSION: Record<string, string> = {
  '/supplier':               'view_supplier',
  '/supplier/reviews':       'view_supplier',

  // Inventory / catalogue
  '/supplier/properties':    'view_inventory',
  '/supplier/rooms':         'view_inventory',
  '/supplier/activities':    'view_inventory',
  '/supplier/tours':         'view_inventory',
  '/supplier/experiences':   'view_inventory',
  '/supplier/vehicles':      'view_inventory',
  '/supplier/drivers':       'view_inventory',
  '/supplier/guides':        'view_inventory',

  // Availability
  '/supplier/availability':  'view_availability',
  '/supplier/departures':    'view_availability',

  // Rates & pricing
  '/supplier/discounts':     'view_rates',
  '/supplier/estimator':     'view_rates',

  // Bookings
  '/supplier/bookings':      'view_bookings',
  '/supplier/requests':      'view_bookings',
  '/supplier/jobs':          'view_bookings',
  '/supplier/analytics':     'view_bookings',

  // Customers & comms
  '/supplier/messages':      'view_customers',

  // Content
  '/supplier/media':         'manage_content',
  '/supplier/packages':      'manage_packages',

  // Supplier profile / org
  '/supplier/company':       'edit_supplier',
  '/supplier/transport':     'edit_supplier',
  '/supplier/staff':         'edit_supplier',
  '/supplier/property':      'edit_supplier',
  '/supplier/settings':      'edit_supplier',

  // Financials
  '/supplier/earnings':      'view_financials',
}

/** The permission required to open a given supplier-portal route. */
export function permissionForRoute(href: string): string {
  return ROUTE_PERMISSION[href] ?? 'view_supplier'
}

/**
 * Filters a supplier's full tool list down to what this employee may open.
 *
 * @param types       supplier_type(s) of the supplier being managed
 * @param permissions the employee's permissions[] for THAT supplier
 */
export function navForPermissions(
  types: SupplierType[],
  permissions: string[],
): NavItem[] {
  const granted = new Set(permissions)
  return mergeNavForTypes(types).filter(item =>
    granted.has(permissionForRoute(item.href)),
  )
}

/** Parses the comma-separated supplier_type column into a typed array. */
export function parseSupplierTypes(raw: string | null | undefined): SupplierType[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean) as SupplierType[]
}

// ─── Consolidated (cross-supplier) tools ──────────────────────────────────────

/**
 * Tools that aggregate across every supplier the employee is assigned to.
 *
 * A consolidated tool appears as soon as the employee holds its permission on
 * at least one supplier, and it shows data only for the suppliers where that
 * permission is actually held — so a staff member managing four properties but
 * holding view_financials on only two sees a two-property earnings view.
 */
export interface ConsolidatedTool {
  href: string
  label: string
  description: string
  icon: LucideIcon
  /** Permission that must be held on at least one supplier for this to appear. */
  permission: string
}

export const CONSOLIDATED_TOOLS: ConsolidatedTool[] = [
  {
    href: '/operations/bookings',
    label: 'All Bookings',
    description: 'Every booking across the suppliers you manage, in one queue.',
    icon: CalendarDays,
    permission: 'view_bookings',
  },
  {
    href: '/operations/availability',
    label: 'Availability',
    description: 'Side-by-side availability for all your assigned suppliers.',
    icon: Clock,
    permission: 'view_availability',
  },
  {
    href: '/operations/rates',
    label: 'Rates & Discounts',
    description: 'Compare and adjust pricing across your portfolio.',
    icon: Tag,
    permission: 'view_rates',
  },
  {
    href: '/operations/customers',
    label: 'Guest Messages',
    description: 'Consolidated guest enquiries and conversations.',
    icon: Users,
    permission: 'view_customers',
  },
  {
    href: '/operations/financials',
    label: 'Financials',
    description: 'Combined earnings, commission and settlement position.',
    icon: Wallet,
    permission: 'view_financials',
  },
  {
    href: '/operations/portfolio',
    label: 'Portfolio',
    description: 'Profile and commercial detail for each supplier you manage.',
    icon: Building2,
    permission: 'view_supplier',
  },
]

/**
 * The consolidated tools this employee can see, given all their assignments.
 * Each result carries the subset of supplier IDs the tool should cover.
 */
export function consolidatedToolsFor(
  assignments: { supplier_id: string; permissions: string[] }[],
): (ConsolidatedTool & { supplierIds: string[] })[] {
  return CONSOLIDATED_TOOLS
    .map(tool => ({
      ...tool,
      supplierIds: assignments
        .filter(a => a.permissions.includes(tool.permission))
        .map(a => a.supplier_id),
    }))
    .filter(tool => tool.supplierIds.length > 0)
}

/** True when the employee holds `permission` on at least one supplier. */
export function hasAnywhere(
  assignments: { permissions: string[] }[],
  permission: string,
): boolean {
  return assignments.some(a => a.permissions.includes(permission))
}
