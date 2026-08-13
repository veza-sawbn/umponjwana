'use client'

/**
 * PortalShell — responsive chrome shared by the supplier portal and the
 * operations environment.
 *
 * Desktop (lg+): the sidebar is fixed on the left exactly as before.
 * Mobile/tablet: it collapses into an off-canvas drawer behind a top bar,
 * so the content column gets the full viewport width instead of sitting in
 * the 240px gutter a fixed sidebar would leave behind.
 *
 * The drawer closes on route change, on backdrop press, and on Escape, and
 * body scroll is locked while it is open so the page underneath doesn't
 * scroll away behind it.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import Logo from '@/components/Logo'

export interface PortalShellProps {
  /** Sidebar content — the same markup used for the desktop rail. */
  sidebar: ReactNode
  /** Short label under the logo in the mobile bar, e.g. "Operations". */
  label?: string
  /** Where the logo links to. */
  homeHref?: string
  /** Rendered at the right of the mobile top bar (e.g. notifications bell). */
  mobileActions?: ReactNode
  /** Rendered top-right on desktop. */
  desktopActions?: ReactNode
  children: ReactNode
}

export default function PortalShell({
  sidebar,
  label = 'Portal',
  homeHref = '/',
  mobileActions,
  desktopActions,
  children,
}: PortalShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Navigating inside the drawer should dismiss it.
  useEffect(() => { setOpen(false) }, [pathname])

  // Escape closes; body scroll locks while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <div className="min-h-screen bg-[#0a0a0a] lg:flex">
      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 bg-[#111111] border-b border-white/8 px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="p-2 -ml-2 text-white/60 hover:text-white transition-colors"
        >
          <Menu size={20} />
        </button>
        <Link href={homeHref} className="flex items-center gap-2 min-w-0">
          <Logo className="h-3.5 w-auto text-[#C9A96E] shrink-0" />
          <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30 truncate">
            {label}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">{mobileActions}</div>
      </header>

      {/* ── Backdrop ───────────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar: drawer on mobile, fixed rail on desktop ───────────── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-[17rem] max-w-[85vw] transform transition-transform duration-200 ease-out
          lg:w-60 lg:max-w-none lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Close affordance, mobile only — the rail has no chrome on desktop */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="lg:hidden absolute top-3 right-3 z-10 p-2 text-white/40 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
        {sidebar}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 min-h-screen bg-[#F7F5F2] lg:ml-60">
        {desktopActions && (
          <div className="hidden lg:flex items-center justify-end px-8 pt-4 -mb-4">
            {desktopActions}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
