'use client'

/**
 * /operations — the employee's dashboard.
 *
 * Two halves, matching how the work actually splits:
 *   1. Per-supplier — enter one supplier and use its tools.
 *   2. Across all suppliers — consolidated views that span the portfolio.
 */

import Link from 'next/link'
import { AlertCircle, ChevronRight, Building2 } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { OPS_ROLE_LABEL } from '@/lib/ops-assignments'
import { MANAGEMENT_STATUS_LABEL } from '@/lib/commercial-agreements'

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    Accommodation: 'bg-blue-50 text-blue-700',
    Activity: 'bg-emerald-50 text-emerald-700',
    'Guided Tours': 'bg-amber-50 text-amber-700',
    Shuttle: 'bg-purple-50 text-purple-700',
    Experience: 'bg-rose-50 text-rose-700',
  }
  return (
    <span
      key={type}
      className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${colors[type] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {type}
    </span>
  )
}

export default function OperationsDashboard() {
  const { opsRole, fullName, suppliers, consolidated } = useOperations()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
          Visit Drakensberg Operations
        </p>
        <h1 className="font-display italic text-3xl text-black">
          {fullName ? `Welcome, ${fullName.split(' ')[0]}` : 'Operations'}
        </h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          {opsRole ? OPS_ROLE_LABEL[opsRole] : 'Operations'}
          {suppliers.length > 0 && (
            <> · managing {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</>
          )}
        </p>
      </div>

      {suppliers.length === 0 ? (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">No suppliers assigned yet</p>
            <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
              Your account is active. A platform administrator needs to assign suppliers before
              your tools appear here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Per-supplier ─────────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="font-display italic text-xl mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-[#C9A96E]" /> My Suppliers
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {suppliers.map(s => (
                <Link
                  key={s.supplier_id}
                  href={`/operations/suppliers/${s.supplier_id}`}
                  className="bg-white border border-gray-200 p-5 hover:border-[#2d6a4f] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-display italic text-lg text-gray-900 leading-tight truncate">
                        {s.supplier_name ?? 'Unnamed Supplier'}
                      </p>
                      <p className="font-sans text-[11px] text-gray-400 mt-1">
                        {MANAGEMENT_STATUS_LABEL[s.management_status as keyof typeof MANAGEMENT_STATUS_LABEL]
                          ?? s.management_status}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-[#2d6a4f] shrink-0 mt-1 transition-colors"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {s.types.map(typeBadge)}
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="font-sans text-[11px] text-gray-500">
                      <span className="text-gray-900 font-medium">{s.tools.length}</span> tool
                      {s.tools.length !== 1 ? 's' : ''} available ·{' '}
                      <span className="text-gray-900 font-medium">{s.permissions?.length ?? 0}</span>{' '}
                      permission{(s.permissions?.length ?? 0) !== 1 ? 's' : ''}
                    </p>
                    {s.tools.length > 0 && (
                      <p className="font-sans text-[11px] text-gray-400 mt-1 truncate">
                        {s.tools.slice(0, 4).map(t => t.label).join(' · ')}
                        {s.tools.length > 4 && ` +${s.tools.length - 4}`}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Consolidated ─────────────────────────────────────────────── */}
          {consolidated.length > 0 && (
            <section>
              <h2 className="font-display italic text-xl mb-1">Across All Suppliers</h2>
              <p className="font-sans text-sm text-gray-500 mb-4">
                Combined views spanning every supplier where you hold the matching permission.
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {consolidated.map(tool => {
                  const Icon = tool.icon
                  return (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="bg-white border border-gray-200 p-5 hover:border-[#2d6a4f] transition-colors group flex items-start gap-4"
                    >
                      <span className="w-9 h-9 bg-[#2d6a4f]/8 flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-[#2d6a4f]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-sans text-sm font-medium text-gray-900">
                          {tool.label}
                        </span>
                        <span className="block font-sans text-xs text-gray-400 mt-1 leading-relaxed">
                          {tool.description}
                        </span>
                        <span className="block font-sans text-[11px] text-[#2d6a4f] mt-2">
                          {tool.supplierIds.length} supplier{tool.supplierIds.length !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
