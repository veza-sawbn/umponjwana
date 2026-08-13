'use client'

/**
 * /operations/portfolio — the employee's supplier portfolio at a glance.
 *
 * Profile and commercial detail for each assigned supplier, with the
 * permissions held on each. Commission and agreement columns only render for
 * suppliers where the employee holds view_contract.
 */

import Link from 'next/link'
import { Building2, ChevronRight } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { ALL_PERMISSIONS } from '@/lib/ops-assignments'
import {
  MANAGEMENT_MODEL_LABEL, MANAGEMENT_STATUS_LABEL,
} from '@/lib/commercial-agreements'

const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map(p => [p.key, p.label]),
)

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PortfolioPage() {
  const { suppliers, loading } = useOperations()

  if (loading) {
    return <div className="p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
          Across All Suppliers
        </p>
        <h1 className="font-display italic text-3xl text-black flex items-center gap-2">
          <Building2 size={22} className="text-[#C9A96E]" /> Portfolio
        </h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} under your management
        </p>
      </div>

      <div className="space-y-4">
        {suppliers.map(s => {
          const canSeeContract = s.permissions?.includes('view_contract')
          return (
            <div key={s.supplier_id} className="bg-white border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div className="min-w-0">
                  <p className="font-display italic text-xl text-gray-900 leading-tight">
                    {s.supplier_name ?? 'Unnamed Supplier'}
                  </p>
                  <p className="font-sans text-xs text-gray-400 mt-1">
                    {s.supplier_email} · {s.types.join(' · ')}
                  </p>
                </div>
                <Link
                  href={`/operations/suppliers/${s.supplier_id}`}
                  className="inline-flex items-center gap-1.5 bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs hover:bg-[#245741] transition-colors shrink-0"
                >
                  Open workspace <ChevronRight size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">
                    Model
                  </p>
                  <p className="font-sans text-sm text-gray-900">
                    {MANAGEMENT_MODEL_LABEL[s.management_model as keyof typeof MANAGEMENT_MODEL_LABEL]
                      ?? s.management_model}
                  </p>
                </div>
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">
                    Status
                  </p>
                  <p className="font-sans text-sm text-gray-900">
                    {MANAGEMENT_STATUS_LABEL[s.management_status as keyof typeof MANAGEMENT_STATUS_LABEL]
                      ?? s.management_status}
                  </p>
                </div>
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">
                    Assigned Since
                  </p>
                  <p className="font-sans text-sm text-gray-900">{fmtDate(s.started_at)}</p>
                </div>
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">
                    Commission
                  </p>
                  <p className="font-sans text-sm text-gray-900">
                    {canSeeContract
                      ? (s.commission_rate != null ? `${s.commission_rate}%` : '—')
                      : <span className="text-gray-300">Not visible</span>}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">
                  Your permissions ({s.permissions?.length ?? 0})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(s.permissions ?? []).map(p => (
                    <span
                      key={p}
                      className="font-sans text-[11px] px-2 py-0.5 bg-[#2d6a4f]/8 text-[#2d6a4f]"
                    >
                      {PERMISSION_LABEL[p] ?? p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
