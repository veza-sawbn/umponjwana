'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  X, Search, ChevronDown, ChevronRight, LogOut, LayoutDashboard, CalendarDays,
  Bell, User, Heart, Gift, Star, Settings, MapPin, ArrowRight, ArrowLeft,
  MessageCircle, Map, Receipt,
} from 'lucide-react'
import { supabase, signOut } from '@/lib/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import Logo from '@/components/Logo'
import { getUnreadCount } from '@/lib/notifications'
import { getThreadsByCustomer } from '@/lib/messages'
import { DESTINATION_GRAPH_NAV } from '@/lib/destination-ia'
import { getSiteContent } from '@/lib/site-content'

// ── Types ─────────────────────────────────────────────────────────────────────

type NavChild = { label: string; href: string }
type NavItem  = {
  label:    string
  href:     string
  image:    string   // default — overridden by admin-editable nav_menu content
  imageAlt: string
  sublabel: string
  children: NavChild[]
}

// ── Navigation data ───────────────────────────────────────────────────────────
// Top-level categories are sourced from DESTINATION_GRAPH_NAV in
// destination-ia.ts — the destination-graph reframed IA (Explore · Hikes ·
// Stay · Things to Do · Tours · Plan Your Trip · Transport), replacing the
// old PRIMARY_NAVIGATION category set. Only 'live' nodes render — a node
// stays in DESTINATION_GRAPH_NAV as 'planned' (visible to admins/devs in
// source) until its `requires` condition is met, at which point flipping
// one field makes it appear here with no further Navbar change. See
// docs/destination-graph/PHASE_A.md and PHASE_E.md.
//
// Each primary is enriched with an editorial image/sublabel for the super
// menu's desktop hero panel — content the graph data itself doesn't carry.

const PRIMARY_ENRICHMENT: Record<string, Pick<NavItem, 'image' | 'imageAlt' | 'sublabel'>> = {
  Explore: {
    image:    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&q=80',
    imageAlt: 'Drakensberg mountain panorama',
    sublabel: "Explore the Berg's distinct regions, towns and nature reserves",
  },
  Hikes: {
    image:    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80',
    imageAlt: 'Hiker on a Drakensberg trail',
    sublabel: 'From easy valley walks to world-class summit trails',
  },
  Stay: {
    image:    'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1200&q=80',
    imageAlt: 'Mountain lodge in the Drakensberg',
    sublabel: 'Mountain lodges, guesthouses, cottages & camping',
  },
  'Things to Do': {
    image:    'https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=1200&q=80',
    imageAlt: 'Activities in the Drakensberg',
    sublabel: 'Horse riding, rock climbing, fly fishing, events & more',
  },
  Tours: {
    image:    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
    imageAlt: 'Guided group hiking in the Drakensberg',
    sublabel: 'Multi-day guided treks with scheduled departures',
  },
  'Plan Your Trip': {
    image:    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80',
    imageAlt: 'Planning a Drakensberg trip',
    sublabel: 'Build an itinerary across stays, hikes and activities',
  },
  Transport: {
    image:    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=80',
    imageAlt: 'Road into the Drakensberg',
    sublabel: 'Door-to-door shuttles and transfers',
  },
}

// A landing-page primary's own href rarely appears among its live children
// (its children are the *sub*-items), so the mobile drill-down and desktop
// sub-column both get a leading "Browse All" link back to the primary page
// — the one navigation path removed by making mobile drill-down, not
// immediate navigation, the primary's tap target (see the mobile menu body
// below). Skipped when a child already points at the same href (e.g. "All
// Hikes"), so nothing is ever listed twice.
function withOverviewLink(item: Pick<NavItem, 'label' | 'href' | 'children'>): NavChild[] {
  if (item.children.some(c => c.href === item.href)) return item.children
  return [{ label: 'Browse All', href: item.href }, ...item.children]
}

const NAV_ITEMS: NavItem[] = DESTINATION_GRAPH_NAV
  .filter(node => node.status === 'live')
  .map(node => ({
    label: node.label,
    href: node.href,
    children: (node.children ?? [])
      .filter(child => child.status === 'live')
      .map(child => ({ label: child.label, href: child.href })),
    ...(PRIMARY_ENRICHMENT[node.label] ?? {
      image:    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80',
      imageAlt: node.label,
      sublabel: '',
    }),
  }))

// Map nav href → nav_menu key so overrides can be looked up
const NAV_IMAGE_KEYS: Record<string, string> = {
  '/stays':      'stays_image',
  '/hikes':      'hikes_image',
  '/activities': 'activities_image',
  '/shuttles':   'shuttles_image',
  '/regions':    'regions_image',
  '/plan':       'plan_image',
  '/tours':      'tours_image',
}

const VISITOR_LINKS = [
  { label: 'Bookings & Trips', href: '/account',                icon: CalendarDays },
  { label: 'Itinerary',        href: '/account/itinerary',      icon: Map },
  { label: 'Messages',         href: '/account/messages',       icon: MessageCircle, badge: 'messages' as const },
  { label: 'Notifications',    href: '/account',                icon: Bell,          badge: 'notifications' as const },
  { label: 'Saved',            href: '/account/saved',          icon: Heart },
  { label: 'Orders',           href: '/account/orders',         icon: Receipt },
  { label: 'Settings',         href: '/account/settings',       icon: Settings },
]

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// ── Animations ────────────────────────────────────────────────────────────────

const overlayAnim = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as number[] } },
  exit:   { opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1,   1] as number[] } },
}

const leftPanelAnim = {
  hidden: { x: -32, opacity: 0 },
  show:   { x: 0, opacity: 1, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] as number[], delay: 0.06 } },
  exit:   { x: -20, opacity: 0, transition: { duration: 0.18 } },
}

const subColAnim = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as number[] } },
  exit:   { opacity: 0, x: -8, transition: { duration: 0.14 } },
}

const imgAnim = {
  hidden: { opacity: 0, scale: 1.04 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] as number[] } },
  exit:   { opacity: 0, transition: { duration: 0.18 } },
}

const dropAnim = {
  hidden: { opacity: 0, y: -4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.14, ease: [0.4, 0, 0.2, 1] as number[] } },
  exit:   { opacity: 0, y: -4, transition: { duration: 0.1 } },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [scrolled,          setScrolled]          = useState(false)
  const [menuOpen,          setMenuOpen]          = useState(false)
  const [hoveredItem,       setHoveredItem]       = useState(NAV_ITEMS[0].href)
  const [dropdownOpen,      setDropdownOpen]      = useState(false)
  const [user,              setUser]              = useState<SupabaseUser | null>(null)
  const [unreadNotifs,      setUnreadNotifs]      = useState(0)
  const [unreadMessages,    setUnreadMessages]    = useState(0)
  const [navImageOverrides, setNavImageOverrides] = useState<Record<string, string>>({})
  // Mobile drill-down: null = primaries-only list; set = that primary's
  // sub-items on "the next tab". Desktop is unaffected — it never reads
  // this, hover still drives the sub-column + image directly.
  const [mobileSection,     setMobileSection]     = useState<NavItem | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname    = usePathname()
  const router      = useRouter()

  // Auth + scroll
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        // Load badge counts after auth — fire and forget
        getUnreadCount().then(setUnreadNotifs).catch(() => {})
        const userId = data.user.id
        const lastSeen = localStorage.getItem(`vd_msgs_last_seen_${userId}`) ?? ''
        getThreadsByCustomer(userId).then(threads => {
          // Count threads that have a supplier message newer than the visitor's last seen timestamp
          setUnreadMessages(threads.filter(t =>
            t.messages.some(m => m.from === 'supplier' && (!lastSeen || m.createdAt > lastSeen))
          ).length)
        }).catch(() => {})
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) { setUnreadNotifs(0); setUnreadMessages(0) }
    })
    const onScroll = () => setScrolled(window.scrollY >= 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('scroll', onScroll) }
  }, [])

  // Fetch admin-editable super menu image overrides
  useEffect(() => {
    getSiteContent('nav_menu').then(data => {
      setNavImageOverrides(data as unknown as Record<string, string>)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    // Re-evaluate the messages badge whenever the user navigates — the messages
    // page writes vd_msgs_last_seen_{userId} on mount, so navigating away from it
    // and back to another page should immediately reflect the cleared count.
    if (user) {
      const lastSeen = localStorage.getItem(`vd_msgs_last_seen_${user.id}`) ?? ''
      getThreadsByCustomer(user.id).then(threads => {
        setUnreadMessages(threads.filter(t =>
          t.messages.some(m => m.from === 'supplier' && (!lastSeen || m.createdAt > lastSeen))
        ).length)
      }).catch(() => {})
    }
  }, [pathname])

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
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // Closing the menu (via a link, the close button, or a route change)
  // always drops back to the primaries-only list next time it opens.
  useEffect(() => {
    if (!menuOpen) setMobileSection(null)
  }, [menuOpen])

  const handleSignOut = async () => {
    await signOut()
    setDropdownOpen(false)
    setMenuOpen(false)
    router.push('/')
  }

  const transparent = !scrolled && !menuOpen
  const activeItem  = NAV_ITEMS.find(i => i.href === hoveredItem) ?? NAV_ITEMS[0]

  // Resolve image: admin override → NAV_ITEMS default
  function resolveImage(item: NavItem) {
    const key = NAV_IMAGE_KEYS[item.href]
    return (key && navImageOverrides[key]) ? navImageOverrides[key] : item.image
  }

  const userName   = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'My Account'
  const role       = user?.app_metadata?.role ?? user?.user_metadata?.role
  const isSupplier = role === 'supplier'
  const isAdmin    = role === 'admin'

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══ HEADER BAR ═══════════════════════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          transparent
            ? 'bg-transparent'
            : 'bg-white border-b border-black/10'
        }`}
      >
        {/* Three-column grid:  [☰ MENU]  [Logo]  [Search · Auth] */}
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-16 grid grid-cols-[1fr_auto_1fr] items-center">

          {/* ── Col 1: Menu trigger ── */}
          <div>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              className={`flex items-center gap-3 group transition-colors ${
                transparent ? 'text-gold' : 'text-black'
              } hover:text-gold`}
            >
              {/* Three-line hamburger — third line short, animates to full on hover */}
              <div className="flex flex-col gap-[5px]" aria-hidden>
                <span className="block h-px bg-current transition-all duration-200 w-[20px]" />
                <span className="block h-px bg-current transition-all duration-200 w-[20px]" />
                <span className="block h-px bg-current transition-all duration-200 w-[13px] group-hover:w-[20px]" />
              </div>
              <span className="hidden lg:block font-sans text-[11px] tracking-[0.2em] uppercase font-semibold">
                Menu
              </span>
            </button>
          </div>

          {/* ── Col 2: Centred logo ── */}
          <Link href="/" aria-label="Visit Drakensberg — Home">
            <Logo className={`h-8 w-auto transition-colors duration-300 ${
              transparent ? 'text-gold' : 'text-forest'
            }`} />
          </Link>

          {/* ── Col 3: Search · Auth ── */}
          <div className="flex items-center justify-end gap-4">

            {/* Search */}
            <Link
              href="/search"
              aria-label="Search"
              className={`p-1 transition-colors ${transparent ? 'text-gold' : 'text-black'} hover:text-gold`}
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Auth — shown on all screen sizes */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className={`flex items-center gap-2 font-sans text-sm transition-colors ${
                    transparent ? 'text-gold' : 'text-black'
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-gold flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials(userName)}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform hidden sm:block ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white border border-black/8 shadow-card z-50 overflow-hidden"
                      variants={dropAnim} initial="hidden" animate="show" exit="exit"
                    >
                      {/* Profile header */}
                      <div className="px-4 py-3 bg-forest flex items-center gap-3 border-b border-white/10">
                        <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {initials(userName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-display italic text-white text-base leading-tight truncate">{userName}</p>
                          <p className="font-sans text-[10px] text-white/40 truncate">{user?.email}</p>
                        </div>
                      </div>

                      <div className="py-1">
                        {isAdmin && (
                          <Link href="/admin" prefetch={false} onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                            <LayoutDashboard className="w-4 h-4 text-forest/40" /> Admin Panel
                          </Link>
                        )}
                        {isSupplier ? (
                          <>
                            <Link href="/supplier" prefetch={false} onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                              <LayoutDashboard className="w-4 h-4 text-forest/40" /> Dashboard
                            </Link>
                            <Link href="/supplier/listings" onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                              <CalendarDays className="w-4 h-4 text-forest/40" /> My Listings
                            </Link>
                          </>
                        ) : (
                          VISITOR_LINKS.map(item => {
                            const Icon = item.icon
                            const count = item.badge === 'notifications' ? unreadNotifs
                              : item.badge === 'messages' ? unreadMessages : 0
                            return (
                              <Link key={`${item.href}-${item.label}`} href={item.href} onClick={() => setDropdownOpen(false)}
                                className="flex items-center gap-2.5 px-4 py-2.5 font-sans text-sm text-forest hover:bg-mist transition-colors">
                                <Icon className="w-4 h-4 text-forest/40 shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {count > 0 && (
                                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-white text-[9px] font-bold flex items-center justify-center">
                                    {count > 9 ? '9+' : count}
                                  </span>
                                )}
                              </Link>
                            )
                          })
                        )}
                      </div>

                      <button onClick={handleSignOut}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 font-sans text-sm text-red-400 hover:bg-mist transition-colors border-t border-black/6">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className={`font-sans text-sm transition-colors ${
                  transparent ? 'text-gold/80 hover:text-gold' : 'text-black hover:text-gold'
                }`}
              >
                Sign In
              </Link>
            )}

          </div>
        </div>
      </header>

      {/* ═══ SUPER MENU OVERLAY ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-[#0D0D0D] flex flex-col"
            variants={overlayAnim}
            initial="hidden" animate="show" exit="exit"
          >
            {/* Top bar */}
            <div className="h-16 flex items-center justify-between px-6 lg:px-12 shrink-0 border-b border-white/[0.06]">
              <Link href="/" onClick={() => setMenuOpen(false)} aria-label="Home">
                <Logo className="h-7 w-auto text-gold" />
              </Link>
              <button
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 text-white/40 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <span className="hidden lg:block font-sans text-[11px] tracking-[0.2em] uppercase font-semibold">
                  Close
                </span>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body: [nav labels] [sub-links col — desktop] [image — desktop] */}
            <div className="flex flex-1 overflow-hidden">

              {/* ── Left: editorial nav labels ── */}
              <motion.div
                className="flex flex-col justify-center px-8 lg:px-14 py-10 overflow-y-auto w-full lg:w-[36%] shrink-0"
                variants={leftPanelAnim}
                initial="hidden" animate="show" exit="exit"
              >
                {mobileSection ? (
                  /* ── Mobile drill-down "next tab": that primary's sub-items only.
                     lg:hidden — desktop never enters this state (mobileSection is
                     never set outside the mobile tap handler below). ── */
                  <div className="lg:hidden flex flex-col">
                    <button
                      onClick={() => setMobileSection(null)}
                      className="flex items-center gap-2 text-white/40 hover:text-white transition-colors font-sans text-[11px] tracking-[0.2em] uppercase font-semibold mb-8 self-start"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> All Categories
                    </button>
                    <p className="font-display italic text-white leading-tight text-[1.9rem] mb-6">
                      {mobileSection.label}
                    </p>
                    <nav className="flex flex-col">
                      {withOverviewLink(mobileSection).map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMenuOpen(false)}
                          className="font-sans text-[15px] text-white/60 hover:text-gold transition-colors py-3 border-b border-white/[0.06]"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </nav>
                  </div>
                ) : (
                  <>
                    <nav className="flex flex-col">
                      {NAV_ITEMS.map((item) => {
                        const active = hoveredItem === item.href
                        const labelClassName = `font-display italic leading-tight py-[0.28em] transition-colors duration-200 text-[1.75rem] lg:text-[2.1rem] xl:text-[2.4rem] ${
                          active ? 'text-white' : 'text-white/25 hover:text-white/60'
                        }`
                        return (
                          <div key={item.href} onMouseEnter={() => setHoveredItem(item.href)}>
                            <div className="flex items-baseline gap-3">
                              {/* Desktop: label is a direct link; hover drives the sub-column + image */}
                              <Link
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className={`hidden lg:inline-block ${labelClassName}`}
                              >
                                {item.label}
                              </Link>
                              {active && (
                                <ArrowRight className="hidden lg:block w-4 h-4 text-gold shrink-0 mb-0.5" aria-hidden />
                              )}
                              {/* Mobile: tapping the primary drills into its sub-items on
                                  the next tab instead of navigating immediately — the
                                  primary page itself is still reachable there via the
                                  "Browse All"/"All X" leading link (withOverviewLink). */}
                              <button
                                onClick={() => setMobileSection(item)}
                                className={`lg:hidden flex items-center justify-between w-full ${labelClassName}`}
                              >
                                <span>{item.label}</span>
                                <ChevronRight className="w-5 h-5 text-white/20 shrink-0" aria-hidden />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </nav>

                    {/* Footer utility links */}
                    <div className="mt-8 pt-5 border-t border-white/[0.06] flex flex-wrap gap-x-6 gap-y-2">
                      {!user && (
                        <Link href="/auth/login" onClick={() => setMenuOpen(false)}
                          className="font-sans text-[11px] text-white/25 hover:text-white/60 transition-colors tracking-wide">
                          Sign In
                        </Link>
                      )}
                      {user && (
                        <>
                          <Link href="/account" onClick={() => setMenuOpen(false)}
                            className="font-sans text-[11px] text-white/25 hover:text-white/60 transition-colors tracking-wide flex items-center gap-1.5">
                            <User size={10} /> My Profile
                          </Link>
                          <Link href="/account/messages" onClick={() => setMenuOpen(false)}
                            className="font-sans text-[11px] text-white/25 hover:text-white/60 transition-colors tracking-wide flex items-center gap-1.5">
                            <MessageCircle size={10} /> Messages
                            {unreadMessages > 0 && (
                              <span className="bg-gold text-black text-[8px] font-bold px-1 rounded-full">
                                {unreadMessages}
                              </span>
                            )}
                          </Link>
                          <button onClick={handleSignOut}
                            className="font-sans text-[11px] text-white/25 hover:text-white/60 transition-colors tracking-wide">
                            Sign Out
                          </button>
                        </>
                      )}
                      <Link href="/mydrakensberg" onClick={() => setMenuOpen(false)}
                        className="font-sans text-[11px] text-white/25 hover:text-white/60 transition-colors tracking-wide">
                        Stories
                      </Link>
                      <Link href="/about" onClick={() => setMenuOpen(false)}
                        className="font-sans text-[11px] text-white/25 hover:text-white/60 transition-colors tracking-wide">
                        About Us
                      </Link>
                      <Link href="/list-your-property" onClick={() => setMenuOpen(false)}
                        className="font-sans text-[11px] text-white/25 hover:text-white/60 transition-colors tracking-wide">
                        List Your Property
                      </Link>
                    </div>
                  </>
                )}
              </motion.div>

              {/* ── Middle: sub-links column (desktop only, updates on hover) ── */}
              <div className="hidden lg:flex flex-col justify-center px-8 py-10 w-[19%] shrink-0 border-l border-white/[0.04]">
                <AnimatePresence mode="wait">
                  {activeItem.children.length > 0 && (
                    <motion.div
                      key={activeItem.href}
                      variants={subColAnim}
                      initial="hidden" animate="show" exit="exit"
                    >
                      <p className="font-sans text-[9px] tracking-[0.18em] uppercase text-gold/50 mb-5">
                        {activeItem.label}
                      </p>
                      <div className="flex flex-col gap-3.5">
                        {activeItem.children.map(child => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMenuOpen(false)}
                            className="font-sans text-[13px] text-white/40 hover:text-gold transition-colors leading-snug"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Right: changing hero image (desktop only) ── */}
              <div className="hidden lg:block flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeItem.href}
                    className="absolute inset-0"
                    variants={imgAnim}
                    initial="hidden" animate="show" exit="exit"
                  >
                    <Image
                      src={resolveImage(activeItem)}
                      alt={activeItem.imageAlt}
                      fill
                      sizes="45vw"
                      className="object-cover"
                      priority
                    />
                    {/* Left fade — blends into the dark left panel */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D]/70 via-[#0D0D0D]/10 to-transparent pointer-events-none" />
                    {/* Bottom vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/50 via-transparent to-transparent pointer-events-none" />

                    {/* Caption */}
                    <div className="absolute bottom-10 right-10 text-right max-w-xs">
                      <p className="font-display italic text-white text-[1.6rem] leading-snug">
                        {activeItem.label}
                      </p>
                      <p className="font-sans text-[13px] text-white/50 mt-1.5 leading-relaxed">
                        {activeItem.sublabel}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
