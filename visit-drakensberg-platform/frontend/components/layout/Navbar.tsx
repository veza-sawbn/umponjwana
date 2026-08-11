'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  X, Menu, ChevronDown, LogOut, LayoutDashboard, CalendarDays,
  Bell, User, Heart, Gift, Star, Settings, MapPin, ChevronRight, ArrowRight,
} from 'lucide-react'
import { supabase, signOut } from '@/lib/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { fade, staggerContainer, staggerChild } from '@/lib/motion'
import Logo from '@/components/Logo'

// ── Types ─────────────────────────────────────────────────────────────────────

type MegaLink     = { label: string; href: string }
type MegaColumn   = { heading: string; links: MegaLink[] }
type MegaFeatured = { src: string; alt: string; label: string; sublabel: string; href: string }
type NavMega      = { featured: MegaFeatured; columns: MegaColumn[] }
type NavLink      = { label: string; href: string; mega?: NavMega }

// ── Nav data ──────────────────────────────────────────────────────────────────

const LEFT_NAV: NavLink[] = [
  {
    label: 'Stays',
    href: '/stays',
    mega: {
      featured: {
        src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        alt: 'Mountain lodge in the Drakensberg',
        label: 'Mountain Escapes',
        sublabel: 'Find your perfect Drakensberg retreat',
        href: '/stays',
      },
      columns: [
        {
          heading: 'By Category',
          links: [
            { label: 'Mountain Lodges', href: '/stays?type=lodge' },
            { label: 'Boutique Guesthouses', href: '/stays?type=guesthouse' },
            { label: 'Self-Catering Cottages', href: '/stays?type=cottage' },
            { label: 'Camping & Glamping', href: '/stays?type=camping' },
            { label: 'Backpacker Hostels', href: '/stays?type=hostel' },
          ],
        },
        {
          heading: 'By Region',
          links: [
            { label: 'Northern Berg', href: '/stays?region=northern' },
            { label: 'Central Berg', href: '/stays?region=central' },
            { label: 'Southern Berg', href: '/stays?region=southern' },
            { label: 'Royal Natal', href: '/stays?region=royal-natal' },
          ],
        },
        {
          heading: 'Travel Styles',
          links: [
            { label: 'Family Getaways', href: '/stays?style=family' },
            { label: 'Romantic Escapes', href: '/stays?style=couples' },
            { label: 'Adventure Base Camps', href: '/stays?style=adventure' },
            { label: 'Luxury Retreats', href: '/stays?style=luxury' },
          ],
        },
      ],
    },
  },
  {
    label: 'Hikes',
    href: '/hikes',
    mega: {
      featured: {
        src: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
        alt: 'Hiker on a Drakensberg trail',
        label: 'World-Class Trails',
        sublabel: 'From gentle walks to summit climbs',
        href: '/hikes',
      },
      columns: [
        {
          heading: 'By Difficulty',
          links: [
            { label: 'Easy Walks', href: '/hikes?difficulty=easy' },
            { label: 'Moderate Trails', href: '/hikes?difficulty=moderate' },
            { label: 'Strenuous Hikes', href: '/hikes?difficulty=strenuous' },
            { label: 'Multi-Day Routes', href: '/hikes?type=multiday' },
          ],
        },
        {
          heading: 'Iconic Routes',
          links: [
            { label: 'Tugela Falls', href: '/hikes?trail=tugela-falls' },
            { label: 'The Amphitheatre', href: '/hikes?trail=amphitheatre' },
            { label: 'Giants Castle', href: '/hikes?trail=giants-castle' },
            { label: 'Injasuti Dome', href: '/hikes?trail=injasuti' },
          ],
        },
        {
          heading: 'Trail Features',
          links: [
            { label: 'Waterfall Hikes', href: '/hikes?feature=waterfalls' },
            { label: 'Summit Peaks', href: '/hikes?feature=peaks' },
            { label: 'San Rock Art', href: '/hikes?feature=rock-art' },
            { label: 'Guided Hikes', href: '/hikes?feature=guided' },
          ],
        },
      ],
    },
  },
  {
    label: 'Activities',
    href: '/activities',
    mega: {
      featured: {
        src: 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=800&q=80',
        alt: 'Activities in the Drakensberg',
        label: 'Adventure Awaits',
        sublabel: 'Unforgettable experiences for every traveller',
        href: '/activities',
      },
      columns: [
        {
          heading: 'Outdoor Adventure',
          links: [
            { label: 'Horse Riding', href: '/activities?cat=horse-riding' },
            { label: 'Rock Climbing', href: '/activities?cat=rock-climbing' },
            { label: 'Fly Fishing', href: '/activities?cat=fly-fishing' },
            { label: 'Mountain Biking', href: '/activities?cat=mountain-biking' },
          ],
        },
        {
          heading: 'Nature & Culture',
          links: [
            { label: 'Bird Watching', href: '/activities?cat=birding' },
            { label: 'San Heritage Tours', href: '/activities?cat=heritage' },
            { label: 'Botanical Walks', href: '/activities?cat=botany' },
            { label: 'Photography Tours', href: '/activities?cat=photography' },
          ],
        },
        {
          heading: 'Family & Wellness',
          links: [
            { label: 'Kids Activities', href: '/activities?cat=kids' },
            { label: 'Spa & Wellness', href: '/activities?cat=wellness' },
            { label: '4x4 Off-Road', href: '/activities?cat=4x4' },
            { label: 'Star Gazing', href: '/activities?cat=stargazing' },
          ],
        },
      ],
    },
  },
  { label: 'Shuttles', href: '/shuttles' },
]

const RIGHT_NAV: NavLink[] = [
  {
    label: 'Regions',
    href: '/regions',
    mega: {
      featured: {
        src: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80',
        alt: 'Drakensberg mountain panorama',
        label: 'Explore the Berg',
        sublabel: "Discover the Drakensberg's distinct regions",
        href: '/regions',
      },
      columns: [
        {
          heading: 'Northern Berg',
          links: [
            { label: 'Royal Natal', href: '/regions?area=royal-natal' },
            { label: 'Monks Cowl', href: '/regions?area=monks-cowl' },
            { label: 'Champagne Valley', href: '/regions?area=champagne-valley' },
            { label: 'Cathedral Peak', href: '/regions?area=cathedral-peak' },
          ],
        },
        {
          heading: 'Central & Southern',
          links: [
            { label: 'Giants Castle', href: '/regions?area=giants-castle' },
            { label: 'Injasuti', href: '/regions?area=injasuti' },
            { label: 'Sani Pass', href: '/regions?area=sani-pass' },
            { label: 'Underberg', href: '/regions?area=underberg' },
          ],
        },
        {
          heading: 'Nature Reserves',
          links: [
            { label: 'All Reserves', href: '/nature-reserves' },
            { label: 'uKhahlamba-Drakensberg', href: '/nature-reserves?park=ukhahlamba' },
            { label: 'Maloti-Drakensberg', href: '/nature-reserves?park=maloti' },
          ],
        },
      ],
    },
  },
  { label: 'Stories', href: '/mydrakensberg' },
  { label: 'Plan', href: '/plan' },
]

const ALL_NAV = [...LEFT_NAV, ...RIGHT_NAV]

const VISITOR_LINKS = [
  { label: 'My Account',       href: '/account/settings',        icon: User },
  { label: 'Bookings & Trips', href: '/account',                  icon: CalendarDays },
  { label: 'Rewards & Wallet', href: '/account/loyalty',          icon: Gift },
  { label: 'Recommendations',  href: '/account/recommendations',  icon: Star },
  { label: 'Saved',            href: '/account/saved',            icon: Heart },
]

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// ── Animation variants ────────────────────────────────────────────────────────

const megaVariants = {
  hidden: { opacity: 0, y: -6 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as number[] } },
  exit:   { opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.4, 0, 1,   1] as number[] } },
}

const dropVariants = {
  hidden: { opacity: 0, scale: 0.97, originX: 1, originY: 0 },
  show:   { opacity: 1, scale: 1,    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as number[] } },
  exit:   { opacity: 0, scale: 0.97, transition: { duration: 0.1,  ease: [0.4, 0, 1,   1] as number[] } },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [scrolled,        setScrolled]        = useState(false)
  const [mobileOpen,      setMobileOpen]      = useState(false)
  const [activeMenu,      setActiveMenu]      = useState<string | null>(null)
  const [dropdownOpen,    setDropdownOpen]    = useState(false)
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [user,            setUser]            = useState<SupabaseUser | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname    = usePathname()
  const router      = useRouter()

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

  const hasActiveMenu  = activeMenu !== null
  const transparent    = !scrolled && !mobileOpen && !hasActiveMenu
  const textColor      = 'text-black'
  const logoColor      = transparent ? 'text-gold' : 'text-forest'

  const userName   = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'My Account'
  const userEmail  = user?.email ?? ''
  const role       = user?.app_metadata?.role ?? user?.user_metadata?.role
  const isSupplier = role === 'supplier'
  const isAdmin    = role === 'admin'

  const activeMega = ALL_NAV.find(l => l.href === activeMenu)?.mega ?? null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          transparent ? 'bg-transparent' : 'bg-white border-b border-black/10'
        }`}
        onMouseLeave={() => setActiveMenu(null)}
      >
        {/* ── Nav bar ── */}
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]">

          {/* ── Col 1: mobile logo · desktop left nav ── */}
          <div className="flex items-center">
            {/* Mobile-only logo */}
            <Link href="/" className="lg:hidden" aria-label="Visit Drakensberg — Home">
              <Logo className="h-3 w-auto text-forest" />
            </Link>

            {/* Desktop left nav */}
            <nav className="hidden lg:flex items-center gap-7">
              {LEFT_NAV.map((link) =>
                link.mega ? (
                  <button
                    key={link.href}
                    onMouseEnter={() => setActiveMenu(link.href)}
                    className={`flex items-center gap-1 font-sans text-sm tracking-wide transition-colors duration-200 ${textColor} hover:text-gold ${activeMenu === link.href ? '!text-gold' : ''}`}
                  >
                    {link.label}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === link.href ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onMouseEnter={() => setActiveMenu(null)}
                    className={`font-sans text-sm tracking-wide transition-colors duration-200 ${textColor} hover:text-gold`}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>
          </div>

          {/* ── Col 2: centred logo (desktop only) ── */}
          <Link href="/" className="hidden lg:block" aria-label="Visit Drakensberg — Home">
            <Logo className={`h-8 w-auto transition-colors duration-300 ${logoColor}`} />
          </Link>

          {/* ── Col 3: desktop right nav + auth · mobile hamburger ── */}
          <div className="flex items-center justify-end gap-5">
            {/* Desktop right nav */}
            <nav className="hidden lg:flex items-center gap-7">
              {RIGHT_NAV.map((link) =>
                link.mega ? (
                  <button
                    key={link.href}
                    onMouseEnter={() => setActiveMenu(link.href)}
                    className={`flex items-center gap-1 font-sans text-sm tracking-wide transition-colors duration-200 ${textColor} hover:text-gold ${activeMenu === link.href ? '!text-gold' : ''}`}
                  >
                    {link.label}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === link.href ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onMouseEnter={() => setActiveMenu(null)}
                    className={`font-sans text-sm tracking-wide transition-colors duration-200 ${textColor} hover:text-gold`}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>

            {/* Desktop auth */}
            {user ? (
              <div className="hidden lg:block relative" ref={dropdownRef}>
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
                      variants={dropVariants}
                      initial="hidden" animate="show" exit="exit"
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
                className="hidden lg:inline-flex font-sans text-sm px-5 py-2 border border-forest text-forest hover:bg-forest hover:text-white transition-all duration-200"
              >
                Sign In
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className={`lg:hidden p-2 transition-colors ${textColor}`}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* ── Super-menu panel (desktop only) ───────────────────────────────── */}
        <AnimatePresence>
          {hasActiveMenu && activeMega && (
            <motion.div
              className="absolute left-0 right-0 top-16 bg-white border-t border-black/6 shadow-[0_8px_40px_rgba(0,0,0,0.11)] hidden lg:block overflow-hidden"
              variants={megaVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="max-w-[1440px] mx-auto flex h-72">

                {/* Featured image */}
                <div className="relative w-72 shrink-0 overflow-hidden">
                  <Image
                    src={activeMega.featured.src}
                    alt={activeMega.featured.alt}
                    fill
                    sizes="288px"
                    className="object-cover"
                    priority
                  />
                  {/* gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 pointer-events-none" />
                  {/* Text content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-7">
                    <p className="font-display italic text-[1.55rem] leading-tight text-white">
                      {activeMega.featured.label}
                    </p>
                    <p className="font-sans text-[13px] text-white/70 mt-1.5 leading-snug">
                      {activeMega.featured.sublabel}
                    </p>
                    <Link
                      href={activeMega.featured.href}
                      onClick={() => setActiveMenu(null)}
                      className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs tracking-wide text-gold hover:text-white transition-colors"
                    >
                      Explore all <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Link columns */}
                <div className="flex-1 flex divide-x divide-black/5">
                  {activeMega.columns.map((col) => (
                    <div key={col.heading} className="flex-1 px-8 py-8">
                      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-5">
                        {col.heading}
                      </p>
                      <ul className="space-y-3">
                        {col.links.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={() => setActiveMenu(null)}
                              className="group flex items-center font-sans text-[13px] text-black/55 hover:text-gold transition-colors leading-snug"
                            >
                              <ChevronRight className="w-3 h-3 mr-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0" />
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══ MOBILE OVERLAY ═══════════════════════════════════════════════════ */}
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

              {/* Profile — logged-in visitor */}
              {user && !isSupplier && (
                <motion.div variants={staggerChild} initial="hidden" animate="show" className="mb-6">
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
                    <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${profileExpanded ? 'rotate-180' : ''}`} />
                  </button>

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
                            <Link key={item.href} href={item.href}
                              className="flex items-center justify-between px-5 py-3.5 font-sans text-sm text-gray-700 hover:bg-[#F7F5F2] border-b border-black/5 last:border-0 transition-colors">
                              <span className="flex items-center gap-3">
                                <Icon size={16} className="text-[#C9A96E]" />
                                {item.label}
                              </span>
                              <ChevronRight size={14} className="text-gray-300" />
                            </Link>
                          )
                        })}
                        <button onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-5 py-3.5 font-sans text-sm text-red-500 hover:bg-red-50 transition-colors">
                          <LogOut size={16} /> Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Profile — supplier */}
              {user && isSupplier && (
                <motion.div variants={staggerChild} initial="hidden" animate="show" className="mb-6 border border-black/8">
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
                    { label: 'Dashboard',   href: '/supplier',          icon: LayoutDashboard },
                    { label: 'My Listings', href: '/supplier/listings', icon: MapPin },
                    { label: 'Bookings',    href: '/supplier/bookings', icon: CalendarDays },
                    { label: 'Settings',    href: '/supplier/settings', icon: Settings },
                  ].map(item => {
                    const Icon = item.icon
                    return (
                      <Link key={item.href} href={item.href} prefetch={false}
                        className="flex items-center justify-between px-5 py-3.5 font-sans text-sm text-gray-700 hover:bg-[#F7F5F2] border-b border-black/5 last:border-0 transition-colors">
                        <span className="flex items-center gap-3">
                          <Icon size={16} className="text-[#2d6a4f]" />
                          {item.label}
                        </span>
                        <ChevronRight size={14} className="text-gray-300" />
                      </Link>
                    )
                  })}
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-5 py-3.5 font-sans text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={16} /> Sign Out
                  </button>
                </motion.div>
              )}

              {/* Main nav links */}
              <motion.nav
                className="flex flex-col gap-1"
                variants={staggerContainer(0.04, 0.05)}
                initial="hidden"
                animate="show"
              >
                {ALL_NAV.map((link) => (
                  <motion.div key={link.href} variants={staggerChild}>
                    <Link
                      href={link.href}
                      className="flex items-center justify-between py-3 border-b border-black/6 font-display italic text-2xl text-forest hover:text-gold transition-colors"
                    >
                      {link.label}
                      <ChevronRight size={18} className="text-gray-200" />
                    </Link>
                    {link.mega && (
                      <div className="flex flex-col border-b border-black/6">
                        {link.mega.columns[0].links.slice(0, 4).map((child) => (
                          <Link key={child.href} href={child.href}
                            className="flex items-center justify-between py-2.5 pl-4 font-sans text-base text-forest/60 hover:text-gold transition-colors">
                            {child.label}
                            <ChevronRight size={15} className="text-gray-200" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.nav>

              {/* Sign in button */}
              <motion.div variants={staggerChild} initial="hidden" animate="show" className="mt-6 flex flex-col gap-3">
                {!user && (
                  <Link href="/auth/login"
                    className="font-sans text-sm px-8 py-3 border border-forest text-forest hover:bg-forest hover:text-white transition-all text-center">
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
