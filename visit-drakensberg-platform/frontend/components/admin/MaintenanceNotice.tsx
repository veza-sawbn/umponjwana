'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { getSiteContent, setSiteContent } from '@/lib/site-content'
import { resolveStaffAccess } from '@/lib/auth'

/**
 * Strip across the top of the console while maintenance mode is on.
 *
 * The console keeps working with the banner up — that is the point of the
 * middleware bypass — but "public site is offline" is otherwise invisible from
 * in here, which is how a site ends up left behind the banner for a day after
 * the work is done. Admins can lift it from wherever they happen to be.
 */
export default function MaintenanceNotice() {
  const [on, setOn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSiteContent('platform_settings')
      .then(s => setOn(Boolean(s.maintenance_mode)))
      .catch(() => {})
    resolveStaffAccess()
      .then(({ isAdmin }) => setIsAdmin(isAdmin))
      .catch(() => {})
  }, [])

  async function bringOnline() {
    setBusy(true)
    try {
      // Re-read before writing so a concurrent settings save isn't clobbered
      // by whatever this tab loaded on mount.
      const current = await getSiteContent('platform_settings')
      await setSiteContent('platform_settings', { ...current, maintenance_mode: false })
      setOn(false)
    } catch {
      setBusy(false)
    }
  }

  if (!on) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-2.5 bg-[#C9A96E]/15 border-b border-[#C9A96E]/30">
      <AlertTriangle size={14} className="text-[#8a6d2f] shrink-0" />
      <p className="font-sans text-xs text-[#6b5525]">
        <strong className="font-medium">Maintenance mode is on.</strong>{' '}
        Visitors see the maintenance page — the console, the visual editor and
        supplier dashboards keep working as normal.
      </p>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/admin/settings"
          className="font-sans text-xs text-[#6b5525]/70 hover:text-[#6b5525] underline underline-offset-2"
        >
          Settings
        </Link>
        {isAdmin && (
          <button
            onClick={bringOnline}
            disabled={busy}
            className="font-sans text-xs px-3 py-1.5 bg-[#0a0a0a] text-white hover:bg-[#2d2d2d] transition-colors disabled:opacity-50"
          >
            {busy ? 'Bringing online…' : 'Bring site back online'}
          </button>
        )}
      </div>
    </div>
  )
}
