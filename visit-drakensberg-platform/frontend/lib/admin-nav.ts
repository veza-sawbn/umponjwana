import {
  LayoutDashboard, ListChecks, Users, CalendarDays,
  FileText, BarChart2, Search, Settings, Mountain,
  Globe, MapPin, Image, Store, Package, ShieldCheck,
  Receipt, Landmark, Banknote, ClipboardList, MessageSquare, Bus,
  TreePine, Building2, FileSignature, UserCog, Wallet, Send, Briefcase,
  UserCircle,
} from 'lucide-react'

// Single source of truth for admin navigation. The desktop sidebar renders
// ADMIN_NAV flat and in this order; the mobile drawer renders the same items
// grouped by ADMIN_NAV_GROUPS, and the mobile tab bar surfaces ADMIN_TABS.

export type AdminNavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Short label for the mobile tab bar, where width is tight. */
  short?: string
  exact?: boolean
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Overview', short: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/admin/customers', label: 'Customers', icon: UserCircle },
  { href: '/admin/listings', label: 'Listings', icon: ListChecks },
  { href: '/admin/suppliers', label: 'Suppliers', icon: Users },
  { href: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/admin/orders', label: 'Orders', icon: Receipt },
  { href: '/admin/invoices', label: 'Invoices', icon: FileText },
  { href: '/admin/quotes', label: 'Quotes', icon: FileSignature },
  { href: '/admin/finance', label: 'Finance', icon: Landmark },
  { href: '/admin/settlements', label: 'Settlements', icon: Banknote },
  { href: '/admin/operations', label: 'Operations', icon: ClipboardList },
  { href: '/admin/operations/managed-suppliers', label: 'Managed Suppliers', icon: Briefcase },
  { href: '/admin/transport', label: 'Transport', icon: Bus },
  { href: '/admin/messages', label: 'Communications', icon: MessageSquare },
  { href: '/admin/marketplace', label: 'Marketplace', icon: Store },
  { href: '/admin/packages', label: 'Package Builder', icon: Package },
  { href: '/admin/blog', label: 'Blog & Content', icon: FileText },
  { href: '/admin/editor', label: 'Visual Editor', icon: Globe },
  { href: '/admin/website', label: 'Website Settings', icon: Settings },
  { href: '/admin/trails', label: 'Hiking Trails', icon: Mountain },
  { href: '/admin/regions', label: 'Regions', icon: MapPin },
  { href: '/admin/reserves', label: 'Nature Reserves', icon: TreePine },
  { href: '/admin/towns', label: 'Towns & Cities', icon: Building2 },
  { href: '/admin/media', label: 'Media Library', icon: Image },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/seo', label: 'SEO', icon: Search },
  { href: '/admin/roles', label: 'Roles & Permissions', icon: UserCog },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

const BY_HREF = new Map(ADMIN_NAV.map(item => [item.href, item]))

function group(title: string, hrefs: string[]) {
  return {
    title,
    items: hrefs.map(href => BY_HREF.get(href)).filter((i): i is AdminNavItem => Boolean(i)),
  }
}

/** Mobile drawer grouping — daily work first, everything else below it. */
export const ADMIN_NAV_GROUPS = [
  group('Daily Work', [
    '/admin', '/admin/customers', '/admin/invoices', '/admin/quotes', '/admin/orders',
    '/admin/bookings', '/admin/messages', '/admin/operations', '/admin/transport',
    '/admin/operations/managed-suppliers',
  ]),
  group('Money', ['/admin/finance', '/admin/settlements']),
  group('Supply', ['/admin/listings', '/admin/suppliers', '/admin/verification', '/admin/marketplace', '/admin/packages']),
  group('Content', ['/admin/blog', '/admin/editor', '/admin/website', '/admin/media', '/admin/seo']),
  group('Places', ['/admin/trails', '/admin/regions', '/admin/reserves', '/admin/towns']),
  group('Platform', ['/admin/analytics', '/admin/roles', '/admin/settings']),
]

/** The four destinations that sit either side of the mobile "+" button. */
export const ADMIN_TABS: AdminNavItem[] = [
  '/admin', '/admin/invoices', '/admin/quotes', '/admin/orders',
].map(href => BY_HREF.get(href)).filter((i): i is AdminNavItem => Boolean(i))

export type AdminQuickAction = {
  label: string
  hint: string
  href: string
  icon: typeof LayoutDashboard
}

// Each href carries the query flag the destination page reads through
// useQuickParam — so tapping "New invoice" lands on the invoice list with the
// form already open, which is the whole point of doing this from a phone.
export const ADMIN_QUICK_ACTIONS: AdminQuickAction[] = [
  { label: 'New invoice', hint: 'Bill a phone or walk-in booking', href: '/admin/invoices?new=invoice', icon: FileText },
  { label: 'New quote', hint: 'Price a trip the customer can accept', href: '/admin/quotes?new=quote', icon: FileSignature },
  { label: 'Record a payment', hint: 'Deposit, instalment or refund', href: '/admin/invoices?filter=unpaid', icon: Wallet },
  { label: 'Email an invoice', hint: 'Send an issued invoice again', href: '/admin/invoices', icon: Send },
  { label: 'Check bookings', hint: 'Pending bookings awaiting confirmation', href: '/admin/bookings?filter=pending', icon: CalendarDays },
  { label: 'Approve a supplier', hint: 'Verification queue', href: '/admin/verification', icon: ShieldCheck },
]

export function isAdminNavActive(item: AdminNavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

/** Longest matching nav label, for the mobile top bar title. */
export function adminSectionLabel(pathname: string) {
  let best: AdminNavItem | undefined
  for (const item of ADMIN_NAV) {
    if (!isAdminNavActive(item, pathname)) continue
    if (!best || item.href.length > best.href.length) best = item
  }
  return best?.label ?? 'Admin Console'
}
