'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, LogIn, LogOut, Bus, Mountain, FileWarning, Wallet, AlertTriangle,
} from 'lucide-react'
import { getOrders, getAllOrderLines, type MasterOrder, type OrderLine } from '@/lib/orders'
import { formatMoney } from '@/lib/allocation'

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '—'
}

function LineList({ title, icon: Icon, lines, empty }: {
  title: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  lines: OrderLine[]
  empty: string
}) {
  return (
    <div className="bg-white border border-gray-200 p-5">
      <h2 className="font-display italic text-lg mb-3 flex items-center gap-2"><Icon size={16} className="text-[#2d6a4f]" />{title} <span className="font-sans text-xs text-gray-400">({lines.length})</span></h2>
      <div className="divide-y divide-gray-100">
        {lines.slice(0, 8).map(l => (
          <div key={l.id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-sans text-sm text-gray-700 truncate">{l.title}</p>
              <p className="font-sans text-[11px] text-gray-400">
                {l.customer_name || 'Guest'}{l.guests ? ` · ${l.guests} guest${l.guests !== 1 ? 's' : ''}` : ''} · {l.supplier_name} · {l.order_number}
              </p>
            </div>
            <span className={`font-sans text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 shrink-0 ${
              l.fulfilment_status === 'confirmed' || l.fulfilment_status === 'fulfilled'
                ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
                : 'bg-[#C9A96E]/15 text-[#8B6914]'
            }`}>{l.fulfilment_status.replace('_', ' ')}</span>
          </div>
        ))}
        {lines.length === 0 && <p className="py-4 font-sans text-sm text-gray-400">{empty}</p>}
      </div>
    </div>
  )
}

export default function AdminOperationsPage() {
  const [orders, setOrders] = useState<MasterOrder[]>([])
  const [lines, setLines] = useState<OrderLine[]>([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))

  async function load() {
    setLoading(true)
    const [o, l] = await Promise.all([getOrders(), getAllOrderLines()])
    setOrders(o); setLines(l)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const activeLines = useMemo(() => lines.filter(l => l.fulfilment_status !== 'cancelled'), [lines])

  const arrivals = activeLines.filter(l => l.category === 'accommodation' && l.service_date === day)
  const departures = activeLines.filter(l => l.category === 'accommodation' && l.end_date === day)
  const transfers = activeLines.filter(l => l.category === 'shuttle' && l.service_date === day)
  const activities = activeLines.filter(l =>
    ['activity', 'hike', 'tour', 'event', 'equipment'].includes(l.category) && l.service_date === day)
  const outstandingPermits = activeLines.filter(l =>
    ['permit', 'levy', 'donation'].includes(l.category) && l.fulfilment_status === 'pending')
  const unconfirmed = activeLines.filter(l => l.supplier_id && l.fulfilment_status === 'pending')

  const outstandingOrders = orders.filter(o => o.booking_status !== 'cancelled' && Number(o.outstanding_balance) > 0)
  const outstandingTotal = outstandingOrders.reduce((s, o) => s + Number(o.outstanding_balance), 0)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Operations</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Operations Dashboard</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Daily movements, supplier confirmations, permits and outstanding payments.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={day} onChange={e => setDay(e.target.value)} className="border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none" />
          <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400">Loading operations data…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
            <LineList title="Arrivals / Check-ins" icon={LogIn} lines={arrivals} empty="No check-ins on this day." />
            <LineList title="Departures / Check-outs" icon={LogOut} lines={departures} empty="No check-outs on this day." />
            <LineList title="Transfers & Shuttles" icon={Bus} lines={transfers} empty="No transfers on this day." />
            <LineList title="Activities, Tours & Events" icon={Mountain} lines={activities} empty="No scheduled activities on this day." />
            <LineList title="Outstanding Permits & Levies" icon={FileWarning} lines={outstandingPermits} empty="All permits reconciled." />
            <LineList title="Awaiting Supplier Confirmation" icon={AlertTriangle} lines={unconfirmed} empty="All supplier services confirmed." />
          </div>

          <div className="bg-white border border-gray-200 p-5">
            <h2 className="font-display italic text-lg mb-3 flex items-center gap-2">
              <Wallet size={16} className="text-[#C9A96E]" />
              Outstanding Payments
              <span className="font-sans text-xs text-gray-400">({outstandingOrders.length} orders · {formatMoney(outstandingTotal)})</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead><tr className="border-b border-gray-100">
                  {['Order', 'Customer', 'Travel', 'Total', 'Paid', 'Outstanding'].map(h =>
                    <th key={h} className="text-left px-4 py-2.5 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {outstandingOrders.slice(0, 12).map(o => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{o.order_number}</td>
                      <td className="px-4 py-3 font-sans text-sm">{o.customer_name}</td>
                      <td className="px-4 py-3 font-sans text-xs text-gray-500">{fmt(o.travel_start)} — {fmt(o.travel_end)}</td>
                      <td className="px-4 py-3 font-sans text-sm">{formatMoney(Number(o.total_value), o.currency)}</td>
                      <td className="px-4 py-3 font-sans text-sm text-gray-500">{formatMoney(Number(o.amount_paid), o.currency)}</td>
                      <td className="px-4 py-3 font-sans text-sm text-[#8B6914]">{formatMoney(Number(o.outstanding_balance), o.currency)}</td>
                    </tr>
                  ))}
                  {outstandingOrders.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center font-sans text-sm text-gray-400">No outstanding customer balances.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
