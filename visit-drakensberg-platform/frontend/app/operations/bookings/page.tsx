'use client'

/**
 * /operations/bookings — consolidated booking queue.
 *
 * One list spanning every supplier where this employee holds view_bookings.
 * RLS ("Managed ops agents read lines") already restricts vd_order_lines to
 * exactly those suppliers, so the query needs no client-side authorisation —
 * the supplier filter here is a convenience, not a security boundary.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Search, RefreshCw, AlertCircle } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { getAllOrderLines, type OrderLine } from '@/lib/orders'
import { formatMoney as money } from '@/lib/allocation'

const FULFILMENT_CHIP: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  in_progress: 'bg-blue-50 text-blue-700',
  fulfilled: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  cancelled: 'bg-red-50 text-red-600',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ConsolidatedBookingsPage() {
  const { suppliers, loading: ctxLoading } = useOperations()
  const [lines, setLines] = useState<OrderLine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')

  // Suppliers this employee may see bookings for
  const scoped = useMemo(
    () => suppliers.filter(s => s.permissions?.includes('view_bookings')),
    [suppliers],
  )
  const scopedIds = useMemo(() => new Set(scoped.map(s => s.supplier_id)), [scoped])

  async function load() {
    setLoading(true)
    const all = await getAllOrderLines()
    setLines(all)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return lines
      // Defensive: keep only suppliers in scope even though RLS already does.
      .filter(l => l.supplier_id && scopedIds.has(l.supplier_id))
      .filter(l => supplierFilter === 'all' || l.supplier_id === supplierFilter)
      .filter(l =>
        !q ||
        l.title?.toLowerCase().includes(q) ||
        l.customer_name?.toLowerCase().includes(q) ||
        l.order_number?.toLowerCase().includes(q) ||
        l.supplier_name?.toLowerCase().includes(q),
      )
  }, [lines, scopedIds, supplierFilter, search])

  const totals = useMemo(() => ({
    count: filtered.length,
    gross: filtered.reduce((sum, l) => sum + (l.gross_amount ?? 0), 0),
  }), [filtered])

  if (ctxLoading) {
    return <div className="p-4 sm:p-6 lg:p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>
  }

  if (scoped.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">No booking access</p>
            <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
              None of your assignments include the View Bookings permission.
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
            <CalendarDays size={22} className="text-[#C9A96E]" /> Bookings
          </h1>
          <p className="font-sans text-sm text-gray-500 mt-1">
            {totals.count} booking{totals.count !== 1 ? 's' : ''} · {money(totals.gross)} gross ·{' '}
            {scoped.length} supplier{scoped.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search guest, reference or item…"
            className="w-full border border-gray-200 pl-9 pr-3 py-2 font-sans text-sm bg-white focus:outline-none focus:border-[#2d6a4f] transition-colors"
          />
        </div>
        <select
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
          className="border border-gray-200 px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:border-[#2d6a4f] transition-colors"
        >
          <option value="all">All suppliers ({scoped.length})</option>
          {scoped.map(s => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {s.supplier_name ?? s.supplier_id}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400">Loading bookings…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-8 text-center">
          <p className="font-sans text-sm text-gray-400">
            {lines.length === 0 ? 'No bookings yet.' : 'No bookings match your filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Supplier', 'Item', 'Guest', 'Service Date', 'Status', 'Value', ''].map(h => (
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
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-[#F7F5F2]">
                  <td className="px-5 py-4 font-sans text-xs text-gray-500">{l.supplier_name}</td>
                  <td className="px-5 py-4">
                    <p className="font-sans text-sm text-gray-900">{l.title}</p>
                    <p className="font-sans text-[11px] text-gray-400 mt-0.5">{l.order_number}</p>
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-600">
                    {l.customer_name || '—'}
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-500">
                    {fmt(l.service_date)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${
                        FULFILMENT_CHIP[l.fulfilment_status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {l.fulfilment_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-900">
                    {money(l.gross_amount, l.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/operations/bookings/${l.order_id}`}
                      className="font-sans text-xs text-[#2d6a4f] hover:underline"
                    >
                      Open
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
