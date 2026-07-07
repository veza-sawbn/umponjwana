import {
  LayoutDashboard, List, Building2, BedDouble, Zap, Map, Users, Truck,
  Sparkles, CalendarDays, Tag, BarChart2, Image, MessageSquare, Star, Clock,
  Calculator, CalendarPlus,
  type LucideIcon,
} from 'lucide-react'

export type SupplierType = 'Accommodation' | 'Activity' | 'Guided Tours' | 'Shuttle' | 'Experience'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface SupplierTypeConfig {
  label: string
  description: string
  primaryNoun: string   // e.g. "Property", "Activity", "Tour"
  nav: NavItem[]
}

const SHARED_NAV: NavItem[] = [
  { href: '/supplier/bookings',     label: 'Bookings',      icon: CalendarDays },
  { href: '/supplier/availability', label: 'Availability',  icon: Clock },
  { href: '/supplier/discounts',    label: 'Discounts',     icon: Tag },
  { href: '/supplier/reviews',      label: 'Reviews',       icon: Star },
  { href: '/supplier/media',        label: 'Media',         icon: Image },
  { href: '/supplier/analytics',    label: 'Analytics',     icon: BarChart2 },
  { href: '/supplier/messages',     label: 'Messages',      icon: MessageSquare },
]

export const SUPPLIER_CONFIG: Record<SupplierType, SupplierTypeConfig> = {
  Accommodation: {
    label: 'Accommodation',
    description: 'Lodges, guesthouses, hotels and self-catering',
    primaryNoun: 'Property',
    nav: [
      { href: '/supplier',            label: 'Overview',      icon: LayoutDashboard },
      { href: '/supplier/properties', label: 'Properties',    icon: Building2 },
      { href: '/supplier/rooms',      label: 'Room Types',    icon: BedDouble },
      ...SHARED_NAV,
    ],
  },
  Activity: {
    label: 'Activity',
    description: 'Abseiling, zip-line, horseback and outdoor activities',
    primaryNoun: 'Activity',
    nav: [
      { href: '/supplier',            label: 'Overview',      icon: LayoutDashboard },
      { href: '/supplier/activities', label: 'Activities',    icon: Zap },
      ...SHARED_NAV,
    ],
  },
  'Guided Tours': {
    label: 'Guided Tours',
    description: 'Multi-day hikes, summit attempts and cultural tours',
    primaryNoun: 'Tour',
    nav: [
      { href: '/supplier',            label: 'Overview',      icon: LayoutDashboard },
      { href: '/supplier/tours',      label: 'Tours',         icon: Map },
      { href: '/supplier/guides',     label: 'Guides',        icon: Users },
      { href: '/supplier/departures', label: 'Departures',    icon: CalendarDays },
      { href: '/supplier/requests',   label: 'Trip Requests', icon: CalendarPlus },
      { href: '/supplier/company',    label: 'Company Profile', icon: Building2 },
      { href: '/supplier/staff',      label: 'Staff',         icon: List },
      ...SHARED_NAV,
    ],
  },
  Shuttle: {
    label: 'Shuttle',
    description: 'Airport runs, trailhead drops and 4×4 transfers',
    primaryNoun: 'Vehicle',
    nav: [
      { href: '/supplier',               label: 'Overview',   icon: LayoutDashboard },
      { href: '/supplier/vehicles',      label: 'Vehicles',   icon: Truck },
      { href: '/supplier/routes',        label: 'Routes',     icon: Map },
      { href: '/supplier/drivers',       label: 'Drivers',    icon: Users },
      { href: '/supplier/estimator',     label: 'Estimator',  icon: Calculator },
      ...SHARED_NAV,
    ],
  },
  Experience: {
    label: 'Experience',
    description: 'Photography workshops, stargazing and wellness retreats',
    primaryNoun: 'Experience',
    nav: [
      { href: '/supplier',               label: 'Overview',     icon: LayoutDashboard },
      { href: '/supplier/experiences',   label: 'Experiences',  icon: Sparkles },
      { href: '/supplier/packages',      label: 'Packages',     icon: List },
      ...SHARED_NAV,
    ],
  },
}

export function getSupplierConfig(type: string | undefined): SupplierTypeConfig | null {
  if (!type) return null
  return SUPPLIER_CONFIG[type as SupplierType] ?? null
}

export function mergeNavForTypes(types: SupplierType[]): NavItem[] {
  if (types.length === 0) return []
  if (types.length === 1) return SUPPLIER_CONFIG[types[0]].nav

  // Multi-type: start with overview, then union all type-specific nav, then shared
  const seen = new Set<string>()
  const result: NavItem[] = [{ href: '/supplier', label: 'Overview', icon: LayoutDashboard }]
  seen.add('/supplier')

  for (const t of types) {
    for (const item of SUPPLIER_CONFIG[t].nav) {
      if (!seen.has(item.href) && !SHARED_NAV.find(s => s.href === item.href)) {
        result.push(item)
        seen.add(item.href)
      }
    }
  }
  for (const item of SHARED_NAV) {
    if (!seen.has(item.href)) {
      result.push(item)
      seen.add(item.href)
    }
  }
  return result
}
