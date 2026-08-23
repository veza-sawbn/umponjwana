'use client'

/**
 * ConsolidatedLauncher
 *
 * Some tools can't be meaningfully merged into one table — an accommodation
 * availability calendar and a shuttle departure board are different shapes of
 * data. For those, the consolidated view is a portfolio-wide launcher: every
 * supplier where the employee holds the permission, with a direct route into
 * that supplier's own tool.
 *
 * Suppliers whose type doesn't offer the tool are omitted, so a Shuttle
 * supplier never appears under a rooms-only tool.
 */

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ChevronRight, type LucideIcon } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { armManagedSupplier } from '@/lib/managed-supplier-context'

export interface ConsolidatedLauncherProps {
  title: string
  description: string
  icon: LucideIcon
  /** Permission an assignment must carry for the supplier to appear. */
  permission: string
  /** Human label for the permission, used in the empty state. */
  permissionLabel: string
  /**
   * Candidate supplier-portal routes this tool maps to, most specific first.
   * The first route present in a supplier's granted tool list is used.
   */
  routes: string[]
}

export default function ConsolidatedLauncher({
  title, description, icon: Icon, permission, permissionLabel, routes,
}: ConsolidatedLauncherProps) {
  const router = useRouter()
  const { suppliers, loading } = useOperations()

  // Keep suppliers that both hold the permission and expose a matching tool.
  const entries = suppliers
    .filter(s => s.permissions?.includes(permission))
    .map(s => ({
      supplier: s,
      tools: s.tools.filter(t => routes.includes(t.href)),
    }))
    .filter(e => e.tools.length > 0)

  function open(supplierId: string, href: string) {
    armManagedSupplier(supplierId)
    router.push(href)
  }

  if (loading) {
    return <div className="p-4 sm:p-6 lg:p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
          Across All Suppliers
        </p>
        <h1 className="font-display italic text-3xl text-black flex items-center gap-2">
          <Icon size={22} className="text-[#C9A96E]" /> {title}
        </h1>
        <p className="font-sans text-sm text-gray-500 mt-1">{description}</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">Nothing to show here</p>
            <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
              None of your assigned suppliers combine the {permissionLabel} permission with a
              supplier type that offers this tool.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {entries.map(({ supplier, tools }) => (
            <div key={supplier.supplier_id} className="bg-white border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-display italic text-lg text-gray-900 leading-tight truncate">
                    {supplier.supplier_name ?? 'Unnamed Supplier'}
                  </p>
                  <p className="font-sans text-[11px] text-gray-400 mt-0.5">
                    {supplier.types.join(' · ')}
                  </p>
                </div>
                <Link
                  href={`/operations/suppliers/${supplier.supplier_id}`}
                  className="font-sans text-[11px] text-gray-400 hover:text-[#2d6a4f] shrink-0 transition-colors"
                  title="Open supplier workspace"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-1.5">
                {tools.map(tool => {
                  const ToolIcon = tool.icon
                  return (
                    <button
                      key={tool.href}
                      onClick={() => open(supplier.supplier_id, tool.href)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 font-sans text-sm text-gray-600 border border-gray-100 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors text-left"
                    >
                      <ToolIcon size={14} className="shrink-0" />
                      <span className="flex-1 truncate">{tool.label}</span>
                      <ChevronRight size={12} className="shrink-0 opacity-40" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
