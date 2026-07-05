'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  X, Menu, ChevronDown, LogOut, LayoutDashboard, CalendarDays,
  Bell, User, Heart, Gift, Star, Settings, MapPin, ChevronRight,
} from 'lucide-react'
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

const VISITOR_LINKS = [
  { label: 'My Account', href: '/account/settings', icon: User },
  { label: 'Bookings & Trips', href: '/account', icon: CalendarDays },
  { label: 'Rewards & Wallet', href: '/account/loyalty', icon: Gift },
  { label: 'Recommendations', href: '/account/recommendations', icon: Star },
  { label: 'Saved', href: '/account/saved', icon: Heart },
]

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profileExpanded, setProfileExpanded] = useState(false)
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

  useEffect(() => { setMobileOpen(false); setProfileExpanded(false) }, [pathname])

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
    setMobileOpen(false)
    router.push('/')
  }

  const transparent = !scrolled && !mobileOpen
  const textColor = transparent ? 'text-white' : 'text-forest'
  const logoColor = transparent ? 'text-gold' : 'text-forest'

  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'My Account'
  const userEmail = user?.email ?? ''
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role
  const isSupplier = role === 'supplier'
  const isAdmin = role === 'admin'

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
            <Logo className={`h-3 lg:h-8 w-auto transition-colors duration-300 ${logoColor}`} />
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
              prefetch={false}
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
                    {initials(userName)}
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
                        {userName}
                      </p>

                      {isAdmin && (
                        <Link href="/admin" prefetch={false} onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                          <LayoutDashboard className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}

                      {isSupplier ? (
                        <>
                          <Link href="/supplier" prefetch={false} onClick={() => setDropdownOpen(false)}
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
                        VISITOR_LINKS.map(item => {
                          const Icon = item.icon
                          return (
                            <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-2 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                              <Icon className="w-4 h-4" /> {item.label}
                            </Link>
                          )
                        })
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
            className="fixed inset-0 z-40 bg-white flex flex-col overflow-y-auto"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* Mobile header bar */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-black/8 shrink-0">
              <Link href="/" aria-label="Visit Drakensberg — Home">
                <Logo className="h-3 w-auto text-forest" />
              </Link>
              <motion.button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-forest"
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="flex flex-col flex-1 px-6 py-6 gap-0">

              {/* ── Profile section (logged-in visitor) ── */}
              {user && !isSupplier && (
                <motion.div
                  variants={staggerChild}
                  initial="hidden"
                  animate="show"
                  className="mb-6"
                >
                  {/* Profile header tap target */}
                  <button
                    className="w-full flex items-center gap-4 bg-[#F7F5F2] px-4 py-4 border border-black/8"
                    onClick={() => setProfileExpanded(v => !v)}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#C9A96E] flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {initials(userName)}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-display italic text-lg text-[#000000] leading-tight truncate">{userName}</p>
                      <p className="font-sans text-xs text-gray-400 truncate">{userEmail}</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${profileExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Visitor sub-items */}
                  <AnimatePresence>
                    {profileExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border border-t-0 border-black/8"
                      >
                        {VISITOR_LINKS.map((item) => {
                          const Icon = item.icon
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="flex items-center justify-between px-5 py-3.5 font-sans text-sm text-gray-700 hover:bg-[#F7F5F2] border-b border-black/5 last:border-0 transition-colors"
                            >
                              <span className="flex items-center gap-3">
                                <Icon size={16} className="text-[#C9A96E]" />
                                {item.label}
                              </span>
                              <ChevronRight size={14} className="text-gray-300" />
                            </Link>
                          )
                        })}
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-5 py-3.5 font-sans text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={16} />
                          Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Supplier profile ── */}
              {user && isSupplier && (
                <motion.div
                  variants={staggerChild}
                  initial="hidden"
                  animate="show"
                  className="mb-6 border border-black/8"
                >
                  <div className="flex items-center gap-4 bg-[#F7F5F2] px-4 py-4 border-b border-black/8">
                    <div className="w-12 h-12 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {initials(userName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display italic text-lg leading-tight truncate">{userName}</p>
                      <p className="font-sans text-xs text-gray-400">Supplier account</p>
                    </div>
                  </div>
                  {[
                    { label: 'Dashboard', href: '/supplier', icon: LayoutDashboard },
                    { label: 'My Listings', href: '/supplier/listings', icon: MapPin },
                    { label: 'Bookings', href: '/supplier/bookings', icon: CalendarDays },
                    { label: 'Settings', href: '/supplier/settings', icon: Settings },
                  ].map(item => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        className="flex items-center justify-between px-5 py-3.5 font-sans text-sm text-gray-700 hover:bg-[#F7F5F2] border-b border-black/5 last:border-0 transition-colors"
                      >
                        <span className="flex items-center gap-3">
                          <Icon size={16} className="text-[#2d6a4f]" />
                          {item.label}
                        </span>
                        <ChevronRight size={14} className="text-gray-300" />
                      </Link>
                    )
                  })}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-5 py-3.5 font-sans text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </motion.div>
              )}

              {/* ── Main nav links ── */}
              <motion.nav
                className="flex flex-col gap-1"
                variants={staggerContainer(0.04, 0.05)}
                initial="hidden"
                animate="show"
              >
                {NAV_LINKS.map((link) => (
                  <motion.div key={link.href} variants={staggerChild}>
                    <Link
                      href={link.href}
                      className="flex items-center justify-between py-3 border-b border-black/6 font-display italic text-2xl text-forest hover:text-gold transition-colors"
                    >
                      {link.label}
                      <ChevronRight size={18} className="text-gray-200" />
                    </Link>
                  </motion.div>
                ))}
              </motion.nav>

              {/* ── Bottom actions ── */}
              <motion.div
                variants={staggerChild}
                initial="hidden"
                animate="show"
                className="mt-6 flex flex-col gap-3"
              >
                <Link
                  href="/supplier"
                  prefetch={false}
                  className="font-sans text-sm tracking-widest uppercase text-forest/40 hover:text-gold transition-colors"
                >
                  List your property →
                </Link>

                {!user && (
                  <Link
                    href="/auth/login"
                    className="font-sans text-sm px-8 py-3 border border-forest text-forest hover:bg-forest hover:text-white transition-all text-center"
                  >
                    Sign In
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
