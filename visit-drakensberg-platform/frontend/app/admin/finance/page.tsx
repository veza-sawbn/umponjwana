'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, TrendingUp, Wallet, AlertCircle, Landmark, Percent,
  Undo2, BarChart2, Users,
} from 'lucide-react'
import { getOrders, getAllOrderLines, type MasterOrder, type OrderLine } from '@/lib/orders'
import { getAccountBalances, type AccountBalance } from '@/lib/ledger'
import { formatMoney } from '@/lib/allocation'

export default function AdminFinancePage() {
  const [orders, setOrders] = useState<MasterOrder[]>([])
  const [lines, setLines] = useState<OrderLine[]>([])
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [o, l, b] = await Promise.all([getOrders(), getAllOrderLines(), getAccountBalances()])
    setOrders(o); setLines(l); setBalances(b)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const active = useMemo(() => orders.filter(o => o.booking_status !== 'cancelled'), [orders])
  const activeLines = useMemo(() => lines.filter(l => l.fulfilment_status !== 'cancelled'), [lines])

  const revenue = active.reduce((s, o) => s + Number(o.total_value), 0)
  const cashReceived = orders.reduce((s, o) => s + Number(o.amount_paid), 0)
  const receivables = active.reduce((s, o) => s + Number(o.outstanding_balance), 0)
  const supplierLiabilities = activeLines.filter(l => l.supplier_id && l.settlement_status !== 'settled')
    .reduce((s, l) => s + Number(l.supplier_share), 0)
  const commissionRevenue = activeLines.reduce((s, l) => s + Number(l.commission_amount), 0)
  const platformRevenue = activeLines.filter(l => !l.supplier_id).reduce((s, l) => s + Number(l.platform_share), 0)
    + activeLines.reduce((s, l) => s + Number(l.platform_fee), 0)
    + active.reduce((s, o) => s + Number(o.service_fee), 0)
  const refundExposure = orders.reduce((s, o) => s + Number(o.refund_balance), 0)
  const avgBookingValue = active.length ? revenue / active.length : 0

  // Monthly sales (last 12 months)
  const monthly = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of active) {
      const key = o.created_at.slice(0, 7)
      m.set(key, (m.get(key) ?? 0) + Number(o.total_value))
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
  }, [active])
  const maxMonthly = Math.max(...monthly.map(([, v]) => v), 1)

  // Supplier performance
  const supplierPerf = useMemo(() => {
    const m = new Map<string, { name: string; gross: number; commission: number; net: number; count: number }>()
    for (const l of activeLines) {
      if (!l.supplier_id) continue
      const p = m.get(l.supplier_id) ?? { name: l.supplier_name, gross: 0, commission: 0, net: 0, count: 0 }
      p.gross += Number(l.gross_amount) - Number(l.discount_amount)
      p.commission += Number(l.commission_amount)
      p.net += Number(l.supplier_share)
      p.count += 1
      m.set(l.supplier_id, p)
    }
    return [...m.values()].sort((a, b) => b.gross - a.gross).slice(0, 10)
  }, [activeLines])

  // Destination performance (future multi-destination ready)
  const destinations = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of active) m.set(o.destination, (m.get(o.destination) ?? 0) + Number(o.total_value))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [active])

  // Customer lifetime value (top customers)
  const topCustomers = useMemo(() => {
    const m = new Map<string, { name: string; email: string; total: number; trips: number }>()
    for (const o of active) {
      const c = m.get(o.user_id) ?? { name: o.customer_name, email: o.customer_email, total: 0, trips: 0 }
      c.total += Number(o.total_value); c.trips += 1
      m.set(o.user_id, c)
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 8)
  }, [active])

  const stats = [
    { label: 'Revenue', value: formatMoney(revenue), icon: TrendingUp },
    { label: 'Cash Received', value: formatMoney(cashReceived), icon: Wallet },
    { label: 'Outstanding Receivables', value: formatMoney(receivables), icon: AlertCircle },
    { label: 'Supplier Liabilities', value: formatMoney(supplierLiabilities), icon: Landmark },
    { label: 'Platform Revenue', value: formatMoney(platformRevenue), icon: BarChart2 },
    { label: 'Commission Revenue', value: formatMoney(commissionRevenue), icon: Percent },
    { label: 'Refund Exposure', value: formatMoney(refundExposure), icon: Undo2 },
    { label: 'Avg Booking Value', value: formatMoney(avgBookingValue), icon: Users },
  ]

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Financial Reporting</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Financial Dashboard</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Live figures from Master Orders, allocations and the double-entry ledger.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <div className="bg-[#2d6a4f]/8 w-8 h-8 flex items-center justify-center mb-3"><Icon size={15} className="text-[#2d6a4f]" /></div>
              <p className="font-display italic text-xl text-[#000000]">{loading ? '…' : s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly sales */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-4">Monthly Sales</h2>
          {monthly.length === 0 ? <p className="font-sans text-sm text-gray-400">No orders yet.</p> : (
            <div className="flex items-end gap-2 h-40">
              {monthly.map(([month, v]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="font-sans text-[9px] text-gray-400">{formatMoney(v)}</span>
                  <div className="w-full bg-[#2d6a4f]" style={{ height: `${Math.max((v / maxMonthly) * 100, 2)}%` }} />
                  <span className="font-sans text-[9px] text-gray-400">{month.slice(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trial balance */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-4">Ledger Account Balances</h2>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {['Code', 'Account', 'Type', 'Balance'].map(h => <th key={h} className="text-left py-2 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {balances.map(a => (
                <tr key={a.code}>
                  <td className="py-2 font-mono text-xs text-gray-400">{a.code}</td>
                  <td className="py-2 font-sans text-sm text-gray-700">{a.name}</td>
                  <td className="py-2 font-sans text-xs text-gray-400 capitalize">{a.type}</td>
                  <td className="py-2 font-sans text-sm text-right">{formatMoney(a.balance)}</td>
                </tr>
              ))}
              {balances.length === 0 && <tr><td colSpan={4} className="py-6 text-center font-sans text-sm text-gray-400">Ledger requires the finance role.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier performance */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-4">Supplier Performance</h2>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {['Supplier', 'Services', 'Gross', 'Commission', 'Net Payable'].map(h => <th key={h} className="text-left py-2 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {supplierPerf.map(p => (
                <tr key={p.name + p.gross}>
                  <td className="py-2.5 font-sans text-sm text-gray-700">{p.name}</td>
                  <td className="py-2.5 font-sans text-sm text-gray-500">{p.count}</td>
                  <td className="py-2.5 font-sans text-sm">{formatMoney(p.gross)}</td>
                  <td className="py-2.5 font-sans text-sm text-[#2d6a4f]">{formatMoney(p.commission)}</td>
                  <td className="py-2.5 font-sans text-sm">{formatMoney(p.net)}</td>
                </tr>
              ))}
              {supplierPerf.length === 0 && <tr><td colSpan={5} className="py-6 text-center font-sans text-sm text-gray-400">No supplier lines yet.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        <div className="space-y-6">
          {/* Destination performance */}
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-xl mb-4">Destination Performance</h2>
            {destinations.map(([dest, v]) => (
              <div key={dest} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="font-sans text-sm text-gray-700 capitalize">{dest}</span>
                <span className="font-sans text-sm">{formatMoney(v)}</span>
              </div>
            ))}
            {destinations.length === 0 && <p className="font-sans text-sm text-gray-400">No orders yet.</p>}
          </div>

          {/* Customer lifetime value */}
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-xl mb-4">Top Customers (Lifetime Value)</h2>
            {topCustomers.map(c => (
              <div key={c.email + c.total} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-sans text-sm text-gray-700">{c.name || c.email}</p>
                  <p className="font-sans text-[11px] text-gray-400">{c.trips} trip{c.trips !== 1 ? 's' : ''}</p>
                </div>
                <span className="font-sans text-sm">{formatMoney(c.total)}</span>
              </div>
            ))}
            {topCustomers.length === 0 && <p className="font-sans text-sm text-gray-400">No customers yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
