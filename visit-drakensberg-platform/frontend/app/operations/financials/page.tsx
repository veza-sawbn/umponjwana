'use client'

/**
 * /operations/financials — consolidated earnings position.
 *
 * Aggregates vd_order_lines across every supplier where this employee holds
 * view_financials. RLS restricts the underlying rows; the permission filter
 * here keeps the totals honest when an employee has bookings access to a
 * supplier but not financial access.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Wallet, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { getAllOrderLines, type OrderLine } from '@/lib/orders'

function money(n: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(n ?? 0)
}

type Row = {
  supplierId: string
  supplierName: string
  lines: number
  gross: number
  commission: number
  supplierShare: number
  settled: number
  unsettled: number
}

export default function ConsolidatedFinancialsPage() {
  const { suppliers, loading: ctxLoading } = useOperations()
  const [lines, setLines] = useState<OrderLine[]>([])
  const [loading, setLoading] = useState(true)

  const scoped = useMemo(
    () => suppliers.filter(s => s.permissions?.includes('view_financials')),
    [suppliers],
  )
  const scopedIds = useMemo(() => new Set(scoped.map(s => s.supplier_id)), [scoped])

  async function load() {
    setLoading(true)
    setLines(await getAllOrderLines())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const rows = useMemo<Row[]>(() => {
    const bySupplier = new Map<string, Row>()
    for (const s of scoped) {
      bySupplier.set(s.supplier_id, {
        supplierId: s.supplier_id,
        supplierName: s.supplier_name ?? 'Unnamed Supplier',
        lines: 0, gross: 0, commission: 0, supplierShare: 0, settled: 0, unsettled: 0,
      })
    }
    for (const l of lines) {
      if (!l.supplier_id || !scopedIds.has(l.supplier_id)) continue
      const row = bySupplier.get(l.supplier_id)
      if (!row) continue
      row.lines += 1
      row.gross += l.gross_amount ?? 0
      row.commission += l.commission_amount ?? 0
      row.supplierShare += l.supplier_share ?? 0
      if (l.settlement_status === 'settled') row.settled += l.supplier_share ?? 0
      else row.unsettled += l.supplier_share ?? 0
    }
    return [...bySupplier.values()].sort((a, b) => b.gross - a.gross)
  }, [lines, scoped, scopedIds])

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    gross: acc.gross + r.gross,
    commission: acc.commission + r.commission,
    supplierShare: acc.supplierShare + r.supplierShare,
    unsettled: acc.unsettled + r.unsettled,
  }), { gross: 0, commission: 0, supplierShare: 0, unsettled: 0 }), [rows])

  if (ctxLoading) {
    return <div className="p-4 sm:p-6 lg:p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>
  }

  if (scoped.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">No financial access</p>
            <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
              None of your assignments include the View Financials permission.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
            Across All Suppliers
          </p>
          <h1 className="font-display italic text-3xl text-black flex items-center gap-2">
            <Wallet size={22} className="text-[#C9A96E]" /> Financials
          </h1>
          <p className="font-sans text-sm text-gray-500 mt-1">
            {scoped.length} supplier{scoped.length !== 1 ? 's' : ''} with financial access
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Gross Revenue', value: money(totals.gross) },
          { label: 'Platform Commission', value: money(totals.commission) },
          { label: 'Supplier Share', value: money(totals.supplierShare) },
          { label: 'Awaiting Settlement', value: money(totals.unsettled) },
        ].map(tile => (
          <div key={tile.label} className="bg-white border border-gray-200 p-5">
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">
              {tile.label}
            </p>
            <p className="font-display italic text-2xl text-black">{tile.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400">Loading financials…</p>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Supplier', 'Bookings', 'Gross', 'Commission', 'Supplier Share', 'Unsettled', ''].map(h => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.supplierId} className="hover:bg-[#F7F5F2]">
                  <td className="px-5 py-4 font-sans text-sm font-medium text-gray-900">
                    {r.supplierName}
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-600">{r.lines}</td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-900">{money(r.gross)}</td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-500">{money(r.commission)}</td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-900">{money(r.supplierShare)}</td>
                  <td className="px-5 py-4 font-sans text-sm text-amber-700">{money(r.unsettled)}</td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/operations/suppliers/${r.supplierId}`}
                      className="font-sans text-xs text-[#2d6a4f] hover:underline inline-flex items-center gap-1"
                    >
                      Open <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
