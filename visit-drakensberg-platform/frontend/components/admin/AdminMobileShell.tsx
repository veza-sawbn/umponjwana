'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, Plus, LogOut, Mountain, MoreHorizontal, ChevronRight } from 'lucide-react'
import Logo from '@/components/Logo'
import NotificationsBell from '@/components/ui/NotificationsBell'
import { signOut } from '@/lib/auth'
import {
  ADMIN_NAV_GROUPS, ADMIN_TABS, ADMIN_QUICK_ACTIONS,
  adminSectionLabel, isAdminNavActive,
} from '@/lib/admin-nav'

// Mobile chrome for the admin console: a top bar, a slide-in drawer holding the
// full navigation, a bottom tab bar for the four screens used every day, and a
// quick-action sheet behind the gold "+" button. All of it is lg:hidden — the
// desktop sidebar in app/admin/layout.tsx is untouched.
//
// Heights are mirrored by the layout's padding (top 3.5rem, bottom 4rem plus
// the safe-area inset), so content never sits under the bars.

const EASE = [0, 0, 0.2, 1] as const

export default function AdminMobileShell() {
  const pathname = usePathname()
  const router = useRouter()
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(false)

  // Navigating away closes whatever is open.
  useEffect(() => { setDrawer(false); setSheet(false) }, [pathname])

  useEffect(() => {
    const locked = drawer || sheet
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawer, sheet])

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-[#111111] border-b border-white/8 flex items-center px-1.5">
        <button
          onClick={() => setDrawer(true)}
          aria-label="Open admin menu"
          className="p-3 text-white/60 hover:text-white transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex-1 min-w-0 px-1">
          <Logo className="h-2.5 w-auto text-[#C9A96E]" />
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/35 truncate mt-1">
            {adminSectionLabel(pathname)}
          </p>
        </div>
        <div className="pr-1.5">
          <NotificationsBell dark />
        </div>
      </header>

      {/* ── Bottom tab bar ──────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111111] border-t border-white/8"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Admin sections"
      >
        <div className="grid grid-cols-5 h-16">
          {ADMIN_TABS.slice(0, 2).map(item => <Tab key={item.href} item={item} pathname={pathname} />)}

          <button
            onClick={() => setSheet(true)}
            aria-label="Quick actions"
            className="flex flex-col items-center justify-center gap-1 text-[#C9A96E]"
          >
            <span className="w-11 h-11 bg-[#C9A96E] text-black flex items-center justify-center shadow-gold">
              <Plus size={22} />
            </span>
          </button>

          {ADMIN_TABS.slice(2, 3).map(item => <Tab key={item.href} item={item} pathname={pathname} />)}

          <button
            onClick={() => setDrawer(true)}
            className="flex flex-col items-center justify-center gap-1 text-white/45 hover:text-white transition-colors"
          >
            <MoreHorizontal size={18} />
            <span className="font-sans text-[10px] tracking-[0.08em] uppercase">More</span>
          </button>
        </div>
      </nav>

      {/* ── Drawer: the full navigation ─────────────────────────── */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            className="lg:hidden fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDrawer(false)}
          >
            <motion.aside
              className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-[#111111] flex flex-col"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/8 flex items-start justify-between gap-3">
                <Link href="/" className="flex flex-col gap-2 min-w-0">
                  <Logo className="h-3.5 w-auto text-[#C9A96E]" />
                  <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30">Admin Console</p>
                </Link>
                <button onClick={() => setDrawer(false)} aria-label="Close menu" className="p-1 text-white/40 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                {ADMIN_NAV_GROUPS.map(g => (
                  <div key={g.title}>
                    <p className="px-3 pb-1.5 font-sans text-[10px] tracking-[0.14em] uppercase text-white/25">{g.title}</p>
                    {g.items.map(item => {
                      const Icon = item.icon
                      const active = isAdminNavActive(item, pathname)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-3 font-sans text-sm transition-colors ${
                            active ? 'bg-[#C9A96E]/15 text-[#C9A96E]' : 'text-white/55 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon size={16} className={active ? 'text-[#C9A96E]' : ''} />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </nav>

              <div
                className="px-3 py-3 border-t border-white/8"
                style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
              >
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
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick-action sheet ──────────────────────────────────── */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            className="lg:hidden fixed inset-0 z-50 bg-black/60 flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSheet(false)}
          >
            <motion.div
              className="w-full bg-white max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={e => e.stopPropagation()}
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div>
                  <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Quick Actions</p>
                  <h2 className="font-display italic text-2xl text-[#000000]">What are you doing?</h2>
                </div>
                <button onClick={() => setSheet(false)} aria-label="Close quick actions" className="p-1 text-gray-400 hover:text-gray-700">
                  <X size={18} />
                </button>
              </div>

              <div className="divide-y divide-gray-100 border-t border-gray-100">
                {ADMIN_QUICK_ACTIONS.map(action => {
                  const Icon = action.icon
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      onClick={() => setSheet(false)}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F5F2] transition-colors"
                    >
                      <span className="w-10 h-10 bg-[#2d6a4f]/8 flex items-center justify-center shrink-0">
                        <Icon size={17} className="text-[#2d6a4f]" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-sans text-sm text-gray-800">{action.label}</span>
                        <span className="block font-sans text-xs text-gray-400 truncate">{action.hint}</span>
                      </span>
                      <ChevronRight size={16} className="text-gray-300 shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Tab({ item, pathname }: { item: typeof ADMIN_TABS[0]; pathname: string }) {
  const Icon = item.icon
  const active = isAdminNavActive(item, pathname)
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center justify-center gap-1 transition-colors ${
        active ? 'text-[#C9A96E]' : 'text-white/45 hover:text-white'
      }`}
    >
      <Icon size={18} />
      <span className="font-sans text-[10px] tracking-[0.08em] uppercase">{item.short ?? item.label}</span>
    </Link>
  )
}
