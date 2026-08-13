'use client'

/**
 * /operations — VD Operations working environment.
 *
 * Deliberately separate from /admin. An operations employee is not an
 * administrator: they hold delegated authority over specific suppliers, and
 * this shell reflects that. The sidebar lists their assigned suppliers and
 * the consolidated tools their permissions earn them — nothing platform-wide.
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Mountain, LayoutGrid, Building2, AlertCircle } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { OperationsProvider, useOperations } from '@/lib/operations-context'
import { OPS_ROLE_LABEL } from '@/lib/ops-assignments'
import Logo from '@/components/Logo'
import NotificationsBell from '@/components/ui/NotificationsBell'

function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, isOpsEmployee, opsRole, fullName, suppliers, consolidated } = useOperations()

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  const isActive = (href: string) =>
    href === '/operations' ? pathname === '/operations' : pathname.startsWith(href)

  return (
    <aside className="w-60 shrink-0 bg-[#111111] border-r border-white/8 flex flex-col fixed inset-y-0 left-0 z-40">
      <div className="px-6 py-5 border-b border-white/8">
        <Link href="/operations" className="flex flex-col gap-2">
          <Logo className="h-4 w-auto text-[#C9A96E]" />
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30">
            Operations
          </p>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        <Link
          href="/operations"
          className={`flex items-center gap-3 px-3 py-2.5 rounded font-sans text-sm transition-colors ${
            isActive('/operations') && pathname === '/operations'
              ? 'bg-[#C9A96E]/15 text-[#C9A96E]'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutGrid size={16} /> Dashboard
        </Link>

        {/* Assigned suppliers */}
        {!loading && suppliers.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-1.5 font-sans text-[10px] tracking-[0.14em] uppercase text-white/25">
              My Suppliers ({suppliers.length})
            </p>
            {suppliers.map(s => {
              const href = `/operations/suppliers/${s.supplier_id}`
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={s.supplier_id}
                  href={href}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded font-sans text-sm transition-colors ${
                    active
                      ? 'bg-[#C9A96E]/15 text-[#C9A96E]'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Building2 size={16} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate">{s.supplier_name ?? 'Unnamed'}</span>
                    <span className="block font-sans text-[10px] text-white/25 mt-0.5">
                      {s.tools.length} tool{s.tools.length !== 1 ? 's' : ''}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Consolidated cross-supplier tools */}
        {!loading && consolidated.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-1.5 font-sans text-[10px] tracking-[0.14em] uppercase text-white/25">
              Across All Suppliers
            </p>
            {consolidated.map(tool => {
              const Icon = tool.icon
              const active = isActive(tool.href)
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded font-sans text-sm transition-colors ${
                    active
                      ? 'bg-[#C9A96E]/15 text-[#C9A96E]'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  <span className="flex-1 min-w-0 truncate">{tool.label}</span>
                  <span className="font-sans text-[10px] text-white/25 shrink-0">
                    {tool.supplierIds.length}
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {!loading && isOpsEmployee && suppliers.length === 0 && (
          <div className="mx-1 mt-4 px-3 py-2.5 rounded bg-amber-500/10 border border-amber-500/20">
            <p className="font-sans text-[11px] text-amber-400 leading-snug">
              No suppliers assigned yet.
            </p>
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/8 space-y-0.5">
        {fullName && (
          <div className="px-3 py-2 mb-1">
            <p className="font-sans text-xs text-white/60 truncate">{fullName}</p>
            {opsRole && (
              <p className="font-sans text-[10px] text-white/30 mt-0.5">
                {OPS_ROLE_LABEL[opsRole]}
              </p>
            )}
          </div>
        )}
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-white/40 hover:text-white transition-colors rounded"
        >
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

/** Blocks the environment for anyone who is not a configured ops employee. */
function Guard({ children }: { children: React.ReactNode }) {
  const { loading, isOpsEmployee } = useOperations()

  if (loading) {
    return <div className="p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>
  }

  if (!isOpsEmployee) {
    return (
      <div className="p-8">
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">
              This area is for Visit Drakensberg Operations staff
            </p>
            <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
              Your account doesn&apos;t have an operational role configured. If you believe this
              is a mistake, ask a platform administrator to set your operations role.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperationsProvider>
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <Sidebar />
        <div className="ml-60 flex-1 min-h-screen bg-[#F7F5F2]">
          <div className="flex items-center justify-end px-8 pt-4 -mb-4">
            <NotificationsBell />
          </div>
          <Guard>{children}</Guard>
        </div>
      </div>
    </OperationsProvider>
  )
}
