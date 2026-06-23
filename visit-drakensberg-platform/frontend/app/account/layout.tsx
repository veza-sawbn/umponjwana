'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, Heart, Star, Gift, Map, Settings, LogOut, User } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { signOut } from '@/lib/auth'

const NAV = [
  { href: '/account', label: 'My Bookings', icon: CalendarDays, exact: true },
  { href: '/account/saved', label: 'Saved Listings', icon: Heart },
  { href: '/account/loyalty', label: 'Loyalty & Rewards', icon: Gift },
  { href: '/account/recommendations', label: 'Continue Planning', icon: Map },
  { href: '/account/settings', label: 'Settings', icon: Settings },
]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(item: typeof NAV[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-28 pb-16">
        <div className="flex gap-8 items-start">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 sticky top-24">
            <div className="bg-white border border-gray-200 p-5 mb-4">
              <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-xl mb-3">
                <User size={20} />
              </div>
              <p className="font-display italic text-lg leading-tight">My Account</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5">Visitor Portal</p>
            </div>
            <nav className="bg-white border border-gray-200 overflow-hidden">
              {NAV.map(item => {
                const Icon = item.icon
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 font-sans text-sm transition-colors border-b border-gray-100 last:border-0 ${
                      active ? 'bg-[#2d6a4f] text-white' : 'text-gray-600 hover:bg-[#F7F5F2]'
                    }`}
                  >
                    <Icon size={15} className={active ? 'text-white' : 'text-gray-400'} />
                    {item.label}
                  </Link>
                )
              })}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 font-sans text-sm text-gray-400 hover:text-red-400 transition-colors"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
