'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mountain, Menu, X, User, Bell, LogOut, LayoutDashboard, CalendarDays } from 'lucide-react'
import { supabase, signOut } from '@/lib/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const NAV_LINKS = [
  { href: '/stays', label: 'Stays' },
  { href: '/activities', label: 'Activities' },
  { href: '/hikes', label: 'Hikes' },
  { href: '/shuttles', label: 'Shuttles' },
  { href: '/packages', label: 'Packages' },
]

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('scroll', onScroll) }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <nav className={`sticky top-0 z-50 bg-white transition-shadow ${scrolled ? 'shadow-md' : 'shadow-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-primary-500 font-bold text-lg shrink-0">
            <Mountain className="h-7 w-7" />
            <span className="hidden sm:block">Visit Drakensberg</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-primary-500 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link href="/supplier" className="hidden md:block text-sm font-medium text-gray-600 hover:text-primary-500 transition-colors">
              List your property
            </Link>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                    {user.user_metadata?.full_name ?? user.email}
                  </span>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    <Link href="/dashboard/bookings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                      <CalendarDays className="h-4 w-4" /> My Bookings
                    </Link>
                    <Link href="/dashboard/notifications" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                      <Bell className="h-4 w-4" /> Notifications
                    </Link>
                    <div className="border-t my-1" />
                    <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth/login" className="bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors">
                Sign In
              </Link>
            )}

            <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t py-4 flex flex-col gap-3">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-gray-700 hover:text-primary-500" onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
