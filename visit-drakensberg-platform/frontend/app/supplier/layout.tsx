'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Mountain } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { SupplierProvider, useSupplier } from '@/lib/supplier-context'
import { ManagedSupplierProvider, useManagedSupplier } from '@/lib/managed-supplier-context'
import Logo from '@/components/Logo'
import NotificationsBell from '@/components/ui/NotificationsBell'
import ManagedSupplierBanner from '@/components/operations/ManagedSupplierBanner'
import PortalShell from '@/components/layout/PortalShell'

function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()

  // For normal suppliers, use the standard SupplierContext.
  // For VD Operations employees acting-as a managed supplier, use the
  // ManagedSupplierContext which provides nav based on the managed supplier's type.
  const supplierCtx = useSupplier()
  const managedCtx = useManagedSupplier()

  // If the user is an ops employee acting-as a supplier, use the managed context's nav.
  // Otherwise fall back to the normal supplier context.
  const isActingAs = managedCtx.isActingAs
  const nav = isActingAs ? managedCtx.nav : supplierCtx.nav
  const config = isActingAs ? managedCtx.activeSupplierConfig : supplierCtx.config
  const supplierType = isActingAs ? (managedCtx.activeSupplierType ?? null) : supplierCtx.supplierType
  const fullName = supplierCtx.fullName
  const isApproved = isActingAs ? true : supplierCtx.isApproved  // ops employees don't need approval
  const loading = supplierCtx.loading || managedCtx.loading

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  function isActive(href: string) {
    if (href === '/supplier') return pathname === '/supplier'
    return pathname.startsWith(href)
  }

  return (
    // Positioning is owned by PortalShell (fixed rail on desktop, drawer on
    // mobile); this element just fills whatever box it is given.
    <aside className="h-full w-full bg-[#111111] border-r border-white/8 flex flex-col overflow-hidden">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/8">
        <Link href="/" className="flex flex-col gap-2">
          <Logo className="h-4 w-auto text-[#C9A96E]" />
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30">
            {loading
              ? 'Portal'
              : isActingAs
                ? `${config?.label ?? 'Supplier'} · Operations`
                : `${config?.label ?? 'Supplier'} Portal`}
          </p>
        </Link>
      </div>

      {/* Approval warning — not shown when operating as an ops employee */}
      {!loading && !isApproved && !isActingAs && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded bg-amber-500/10 border border-amber-500/20">
          <p className="font-sans text-[11px] text-amber-400 leading-snug">
            Your account is pending approval. Some features are limited.
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded font-sans text-sm transition-colors ${
                active
                  ? 'bg-[#C9A96E]/15 text-[#C9A96E]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} className={active ? 'text-[#C9A96E]' : ''} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + footer */}
      <div className="px-3 py-4 border-t border-white/8 space-y-0.5">
        {fullName && (
          <div className="px-3 py-2 mb-1">
            <p className="font-sans text-xs text-white/60 truncate">{fullName}</p>
            {supplierType && (
              <p className="font-sans text-[10px] text-white/30 mt-0.5">
                {supplierType}
                {isActingAs && (
                  <span className="ml-1 text-[#C9A96E]/60"> · VD Operations</span>
                )}
              </p>
            )}
          </div>
        )}
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-white/40 hover:text-white transition-colors rounded">
          <Mountain size={16} /> View Site
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-white/40 hover:text-red-400 transition-colors rounded"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  )
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupplierProvider>
      <ManagedSupplierProvider>
        <PortalShell
          sidebar={<SidebarNav />}
          label="Supplier"
          homeHref="/supplier"
          mobileActions={<NotificationsBell />}
          desktopActions={<NotificationsBell />}
        >
          {/* Contextual banner shown when a VD Operations employee is managing a supplier */}
          <ManagedSupplierBanner />
          {children}
        </PortalShell>
      </ManagedSupplierProvider>
    </SupplierProvider>
  )
}
