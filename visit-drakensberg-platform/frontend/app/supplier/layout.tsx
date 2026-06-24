'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Mountain } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { SupplierProvider, useSupplier } from '@/lib/supplier-context'
import Logo from '@/components/Logo'

function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { nav, config, supplierType, fullName, isApproved, loading } = useSupplier()

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  function isActive(href: string) {
    if (href === '/supplier') return pathname === '/supplier'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 shrink-0 bg-[#111111] border-r border-white/8 flex flex-col fixed inset-y-0 left-0 z-40">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/8">
        <Link href="/" className="flex flex-col gap-2">
          <Logo className="h-4 w-auto text-[#C9A96E]" />
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30">
            {loading ? 'Supplier' : (config?.label ?? 'Supplier')} Portal
          </p>
        </Link>
      </div>

      {/* Approval warning */}
      {!loading && !isApproved && (
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
              <p className="font-sans text-[10px] text-white/30 mt-0.5">{supplierType}</p>
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
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <SidebarNav />
        <div className="ml-60 flex-1 min-h-screen bg-[#F7F5F2]">
          {children}
        </div>
      </div>
    </SupplierProvider>
  )
}
