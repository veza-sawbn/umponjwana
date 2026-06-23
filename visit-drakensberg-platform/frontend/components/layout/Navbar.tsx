'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { X, Menu, ChevronDown, LogOut, LayoutDashboard, User, CalendarDays, Bell } from 'lucide-react'
import { supabase, signOut } from '@/lib/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { scaleFade, fade, staggerContainer, staggerChild } from '@/lib/motion'
import Logo from '@/components/Logo'

const NAV_LINKS = [
  { label: 'Stays', href: '/stays' },
  { label: 'Hikes', href: '/hikes' },
  { label: 'Activities', href: '/activities' },
  { label: 'Reserves', href: '/nature-reserves' },
  { label: 'Regions', href: '/regions' },
  { label: 'Stories', href: '/mydrakensberg' },
  { label: 'Plan', href: '/plan' },
]

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    const onScroll = () => setScrolled(window.scrollY >= 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleSignOut = async () => {
    await signOut()
    setDropdownOpen(false)
    router.push('/')
  }

  const transparent = !scrolled && !mobileOpen
  const textColor = transparent ? 'text-white' : 'text-forest'
  const logoColor = transparent ? 'text-gold' : 'text-forest'

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          transparent ? 'bg-transparent' : 'bg-white border-b border-black/10'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" aria-label="Visit Drakensberg — Home">
            <Logo className={`h-8 w-auto transition-colors duration-300 ${logoColor}`} />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-sans text-sm tracking-wide transition-colors duration-200 ${textColor} hover:text-gold`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="hidden lg:flex items-center gap-5">
            <Link
              href="/supplier"
              className={`font-sans text-sm tracking-wide transition-colors duration-200 ${textColor} hover:text-gold`}
            >
              List Property
            </Link>

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className={`flex items-center gap-2 font-sans text-sm ${textColor}`}
                >
                  <span className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-forest text-xs font-bold">
                    {initials(user.user_metadata?.full_name ?? user.email ?? 'U')}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    className="absolute right-0 top-full mt-2 w-56 bg-white border border-black/8 shadow-card py-1 z-50"
                    variants={scaleFade}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    style={{ originX: 1, originY: 0 }}
                  >
                    <p className="px-4 py-2 font-sans text-xs text-forest/40 border-b border-black/6 truncate">
                      {user.user_metadata?.full_name ?? user.email}
                    </p>

                    {user.user_metadata?.role === 'admin' && (
                      <Link href="/admin" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}

                    {user.user_metadata?.role === 'supplier' ? (
                      <>
                        <Link href="/supplier" onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                          <LayoutDashboard className="w-4 h-4" /> Dashboard
                        </Link>
                        <Link href="/supplier/listings" onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                          <CalendarDays className="w-4 h-4" /> My Listings
                        </Link>
                        <Link href="/supplier/listings/new" onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                          <Bell className="w-4 h-4" /> Add Listing
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href="/dashboard" onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                          <User className="w-4 h-4" /> My Bookings
                        </Link>
                      </>
                    )}

                    <button onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-4 py-2.5 font-sans text-sm text-red-500 hover:bg-mist transition-colors border-t border-black/6">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className={`font-sans text-sm px-5 py-2 border transition-all duration-200 ${
                  transparent
                    ? 'border-white/60 text-white hover:bg-white hover:text-forest'
                    : 'border-forest text-forest hover:bg-forest hover:text-white'
                }`}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={`lg:hidden p-2 transition-colors ${textColor}`}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-white flex flex-col"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="h-16 flex items-center justify-between px-6 border-b border-black/8">
              <Link href="/" aria-label="Visit Drakensberg — Home">
                <Logo className="h-8 w-auto text-forest" />
              </Link>
              <motion.button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-forest"
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            <motion.nav
              className="flex-1 flex flex-col items-center justify-center gap-6"
              variants={staggerContainer(0.05, 0.05)}
              initial="hidden"
              animate="show"
            >
              {NAV_LINKS.map((link) => (
                <motion.div key={link.href} variants={staggerChild}>
                  <Link
                    href={link.href}
                    className="font-display text-4xl text-forest hover:text-gold transition-colors"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div variants={staggerChild} className="h-px w-16 bg-black/10 my-2" />
              <motion.div variants={staggerChild}>
                <Link href="/supplier" className="font-sans text-sm tracking-widest uppercase text-forest/40 hover:text-gold transition-colors">
                  List Property
                </Link>
              </motion.div>
              {!user && (
                <motion.div variants={staggerChild}>
                  <Link href="/auth/login" className="font-sans text-sm px-8 py-3 border border-forest text-forest hover:bg-forest hover:text-white transition-all">
                    Sign In
                  </Link>
                </motion.div>
              )}
              {user && (
                <motion.div variants={staggerChild}>
                  <button onClick={handleSignOut} className="font-sans text-sm text-red-400 hover:text-red-600 transition-colors flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </motion.div>
              )}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
