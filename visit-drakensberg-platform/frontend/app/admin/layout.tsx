'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ListChecks, Users, CalendarDays,
  FileText, BarChart2, Search, Settings, LogOut, Mountain,
  Globe, MapPin, Image, Store, Package, ShieldCheck,
  Receipt, Landmark, Banknote, ClipboardList, MessageSquare, Bus,
  TreePine, Building2, FileSignature, UserCog,
} from 'lucide-react'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(item: typeof NAV[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-[#111111] border-r border-white/8 flex flex-col fixed inset-y-0 left-0 z-40">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/8">
          <Link href="/" className="flex flex-col gap-2">
            <Logo className="h-4 w-auto text-gold" />
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30">Admin Console</p>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 font-sans text-sm transition-colors ${
                  active
                    ? 'bg-[#C9A96E]/15 text-[#C9A96E]'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} className={active ? 'text-[#C9A96E]' : ''} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/8">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-white/40 hover:text-white transition-colors">
            <Mountain size={16} /> View Site
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-white/40 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-60 flex-1 min-h-screen bg-[#F7F5F2]">
        {children}
      </div>
    </div>
  )
}
