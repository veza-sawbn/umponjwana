'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, User, LogOut, LayoutDashboard, CalendarDays, Bell, ChevronDown } from 'lucide-react'
import { supabase, signOut } from '@/lib/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const NAV_LINKS = [
  { href: '/stays', label: 'Stays' },
  { href: '/hikes', label: 'Hikes' },
  { href: '/activities', label: 'Activities' },
  { href: '/nature-reserves', label: 'Reserves' },
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
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    setDropdownOpen(false)
    router.push('/')
  }

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-forest/95 backdrop-blur-md shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">

            {/* Logo */}
            <Link
              href="/"
              className="font-display text-2xl italic font-bold text-gold hover:text-gold/80 transition-colors shrink-0"
            >
              Visit Drakensberg
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="font-sans text-sm font-medium text-white/80 hover:text-gold transition-colors duration-200 tracking-wide"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <Link
                href="/supplier"
                className="hidden md:block font-sans text-sm font-medium text-white/60 hover:text-gold transition-colors"
              >
                List Property
              </Link>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="flex items-center gap-2 border border-white/20 rounded-full px-4 py-2 hover:border-gold/50 transition-all duration-200"
                  >
                    <User className="h-4 w-4 text-white/70" />
                    <span className="hidden sm:block font-sans text-sm font-medium text-white/80 max-w-[110px] truncate">
                      {user.user_metadata?.full_name ?? user.email}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 text-white/50 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-forest/98 border border-white/10 rounded-2xl shadow-2xl py-2 z-50 backdrop-blur-xl">
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="font-sans text-xs font-semibold text-white/40 uppercase tracking-wider">Signed in as</p>
                        <p className="font-sans text-sm text-white/80 font-medium truncate mt-0.5">
                          {user.user_metadata?.full_name ?? user.email}
                        </p>
                      </div>

                      <div className="py-1">
                        {user.user_metadata?.role === 'supplier' ? (
                          <>
                            <Link
                              href="/supplier"
                              className="flex items-center gap-3 px-4 py-2.5 font-sans text-sm text-white/70 hover:text-gold hover:bg-white/5 transition-colors"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <LayoutDashboard className="h-4 w-4" /> Supplier Dashboard
                            </Link>
                            <Link
                              href="/supplier/listings"
                              className="flex items-center gap-3 px-4 py-2.5 font-sans text-sm text-white/70 hover:text-gold hover:bg-white/5 transition-colors"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <CalendarDays className="h-4 w-4" /> My Listings
                            </Link>
                            <Link
                              href="/supplier/listings/new"
                              className="flex items-center gap-3 px-4 py-2.5 font-sans text-sm text-white/70 hover:text-gold hover:bg-white/5 transition-colors"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <Bell className="h-4 w-4" /> Add Listing
                            </Link>
                          </>
                        ) : user.user_metadata?.role === 'admin' ? (
                          <Link
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-2.5 font-sans text-sm text-white/70 hover:text-gold hover:bg-white/5 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <LayoutDashboard className="h-4 w-4" /> Admin Dashboard
                          </Link>
                        ) : (
                          <>
                            <Link
                              href="/dashboard"
                              className="flex items-center gap-3 px-4 py-2.5 font-sans text-sm text-white/70 hover:text-gold hover:bg-white/5 transition-colors"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <LayoutDashboard className="h-4 w-4" /> Dashboard
                            </Link>
                            <Link
                              href="/dashboard/bookings"
                              className="flex items-center gap-3 px-4 py-2.5 font-sans text-sm text-white/70 hover:text-gold hover:bg-white/5 transition-colors"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <CalendarDays className="h-4 w-4" /> My Bookings
                            </Link>
                          </>
                        )}
                      </div>

                      <div className="border-t border-white/10 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 w-full px-4 py-2.5 font-sans text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                        >
                          <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="font-sans text-sm font-semibold bg-gold text-forest px-5 py-2.5 rounded-full hover:bg-brown-600 hover:text-white transition-all duration-300"
                >
                  Sign In
                </Link>
              )}

              {/* Hamburger */}
              <button
                className="md:hidden text-white p-1"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile full-screen overlay ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-forest flex flex-col">
          {/* Close button */}
          <div className="flex items-center justify-between px-6 h-20">
            <Link
              href="/"
              className="font-display text-2xl italic font-bold text-gold"
              onClick={() => setMenuOpen(false)}
            >
              Visit Drakensberg
            </Link>
            <button onClick={() => setMenuOpen(false)} className="text-white/60 hover:text-white p-1">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Links */}
          <nav className="flex-1 flex flex-col justify-center px-8 gap-2">
            {NAV_LINKS.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="font-display text-4xl font-bold text-white/80 hover:text-gold transition-colors py-2 border-b border-white/5"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/supplier"
              onClick={() => setMenuOpen(false)}
              className="font-display text-4xl font-bold text-white/40 hover:text-gold transition-colors py-2"
            >
              List Property
            </Link>
          </nav>

          {/* Bottom actions */}
          <div className="px-8 pb-12">
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 font-sans text-sm font-medium text-white/40 hover:text-red-400 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setMenuOpen(false)}
                className="inline-block font-sans font-semibold bg-gold text-forest px-8 py-4 rounded-full hover:bg-brown-600 hover:text-white transition-all duration-300 text-sm"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}
