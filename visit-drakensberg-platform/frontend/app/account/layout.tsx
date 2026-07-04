'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarDays, Heart, Star, Gift, Map, Settings, LogOut, User, ChevronDown,
} from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { supabase, signOut } from '@/lib/auth'

const NAV = [
  { href: '/account', label: 'Bookings & Trips', icon: CalendarDays, exact: true },
  { href: '/account/saved', label: 'Saved', icon: Heart },
  { href: '/account/loyalty', label: 'Rewards & Wallet', icon: Gift },
  { href: '/account/recommendations', label: 'Planning', icon: Map },
  { href: '/account/itinerary', label: 'Itinerary', icon: Star },
  { href: '/account/settings', label: 'Settings', icon: Settings },
]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [initials, setInitials] = useState<string>('?')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Visitor'
      setUserName(name)
      setUserEmail(user.email || '')
      setInitials(
        name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      )
    })
  }, [])

  useEffect(() => { setMobileMenuOpen(false) }, [pathname])

  function isActive(item: typeof NAV[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const activeItem = NAV.find(item => isActive(item)) || NAV[0]

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-20 sm:pt-24 lg:pt-28 pb-16">

        {/* ── Mobile profile header ── */}
        <div className="lg:hidden mb-4">
          <div className="bg-white border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-xl shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display italic text-lg leading-tight truncate">{userName || 'My Account'}</p>
              <p className="font-sans text-xs text-gray-400 truncate">{userEmail}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 font-sans text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>

        {/* ── Mobile tab strip ── */}
        <div className="lg:hidden mb-4">
          {/* Dropdown selector on very small screens */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="w-full bg-white border border-gray-200 px-4 py-3 flex items-center justify-between font-sans text-sm text-gray-700"
            >
              <span className="flex items-center gap-2">
                {(() => { const Icon = activeItem.icon; return <Icon size={15} className="text-[#2d6a4f]" /> })()}
                {activeItem.label}
              </span>
              <ChevronDown size={15} className={`text-gray-400 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileMenuOpen && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white border border-t-0 border-gray-200 shadow-md">
                {NAV.map(item => {
                  const Icon = item.icon
                  const active = isActive(item)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 font-sans text-sm border-b border-gray-100 last:border-0 transition-colors ${
                        active ? 'text-[#2d6a4f] bg-[#2d6a4f]/5 font-medium' : 'text-gray-600 hover:bg-[#F7F5F2]'
                      }`}
                    >
                      <Icon size={15} className={active ? 'text-[#2d6a4f]' : 'text-gray-400'} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Horizontal scroll tabs on sm */}
          <div className="hidden sm:flex overflow-x-auto scrollbar-none gap-1 bg-white border border-gray-200 p-1">
            {NAV.map(item => {
              const Icon = item.icon
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 font-sans text-xs whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#2d6a4f] text-white'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-[#F7F5F2]'
                  }`}
                >
                  <Icon size={13} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Desktop layout: sidebar + content ── */}
        <div className="flex gap-8 items-start">

          {/* Desktop sidebar */}
          <aside className="w-56 shrink-0 sticky top-24 hidden lg:block">
            <div className="bg-white border border-gray-200 p-5 mb-4">
              <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-xl mb-3">
                {initials}
              </div>
              <p className="font-display italic text-lg leading-tight truncate">{userName || 'My Account'}</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5 truncate">{userEmail || 'Visitor Portal'}</p>
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

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
