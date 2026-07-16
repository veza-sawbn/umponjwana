'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Wallet, Clock, CheckCircle, FileText, Printer } from 'lucide-react'
import { getMyOrderLines, setLineFulfilment, type OrderLine } from '@/lib/orders'
import { getMySettlements, buildStatements, type Settlement, type SupplierStatement } from '@/lib/settlements'
import { formatMoney } from '@/lib/allocation'

// Supplier earnings portal. Row-level security guarantees the signed-in
// supplier only ever receives their own order lines and settlements — no
// other suppliers, no customer totals, no internal notes, no cross-supplier
// commission or payout data.

const SETTLE_BADGE: Record<string, string> = {
  settled: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  allocated: 'bg-blue-50 text-blue-500',
  unsettled: 'bg-[#C9A96E]/15 text-[#8B6914]',
  reversed: 'bg-red-50 text-red-400',
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function monthLabel(period: string) {
  return new Date(`${period}-01`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

function StatementCard({ st }: { st: SupplierStatement }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F7F5F2] transition-colors">
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-[#2d6a4f]" />
          <div className="text-left">
            <p className="font-sans text-sm font-medium text-gray-800">Statement — {monthLabel(st.period)}</p>
            <p className="font-sans text-xs text-gray-400">{st.rows.length} service{st.rows.length !== 1 ? 's' : ''} · Net {formatMoney(st.net)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-sans text-xs text-gray-400">Settled {formatMoney(st.settled)}</p>
          <p className="font-sans text-xs text-[#8B6914]">Outstanding {formatMoney(st.outstanding)}</p>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead><tr className="border-b border-gray-100">
                {['Booking Ref', 'Service', 'Guest', 'Travel Dates', 'Gross', 'Commission', 'Fees', 'Net', 'Payment', 'Settlement'].map(h =>
                  <th key={h} className="text-left px-3 py-2 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {st.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{r.bookingReference}</td>
                    <td className="px-3 py-2.5 font-sans text-sm text-gray-700">{r.service}</td>
                    <td className="px-3 py-2.5 font-sans text-xs text-gray-500">{r.customerName || '—'}</td>
                    <td className="px-3 py-2.5 font-sans text-xs text-gray-500">{r.travelDates}</td>
                    <td className="px-3 py-2.5 font-sans text-sm">{formatMoney(r.gross)}</td>
                    <td className="px-3 py-2.5 font-sans text-sm text-gray-500">−{formatMoney(r.commission)}</td>
                    <td className="px-3 py-2.5 font-sans text-sm text-gray-500">−{formatMoney(r.platformFees)}</td>
                    <td className="px-3 py-2.5 font-sans text-sm text-[#2d6a4f]">{formatMoney(r.net)}</td>
                    <td className="px-3 py-2.5 font-sans text-xs capitalize text-gray-500">{r.paymentStatus}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-sans text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 ${SETTLE_BADGE[r.settlementStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                        {r.settlementStatus}{r.settlementReference ? ` · ${r.settlementReference}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={4} className="px-3 py-2.5 font-sans text-xs uppercase tracking-[0.1em] text-gray-400">Totals</td>
                  <td className="px-3 py-2.5 font-sans text-sm font-medium">{formatMoney(st.gross)}</td>
                  <td className="px-3 py-2.5 font-sans text-sm text-gray-500">−{formatMoney(st.commission)}</td>
                  <td className="px-3 py-2.5 font-sans text-sm text-gray-500">−{formatMoney(st.fees)}</td>
                  <td className="px-3 py-2.5 font-display italic text-[#2d6a4f]">{formatMoney(st.net)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={() => window.print()} className="mt-3 inline-flex items-center gap-2 font-sans text-xs text-gray-500 hover:text-[#2d6a4f] transition-colors">
            <Printer size={12} /> Print statement
          </button>
        </div>
      )}
    </div>
  )
}

export default function SupplierEarningsPage() {
  const [lines, setLines] = useState<OrderLine[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'services' | 'statements' | 'settlements'>('services')

  async function load() {
    setLoading(true)
    const [l, s] = await Promise.all([getMyOrderLines(), getMySettlements()])
    setLines(l); setSettlements(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const activeLines = useMemo(() => lines.filter(l => l.fulfilment_status !== 'cancelled'), [lines])
  const earned = activeLines.reduce((s, l) => s + Number(l.supplier_share), 0)
  const commission = activeLines.reduce((s, l) => s + Number(l.commission_amount), 0)
  const settled = activeLines.filter(l => l.settlement_status === 'settled').reduce((s, l) => s + Number(l.supplier_share), 0)
  const pending = earned - settled

  const statements = useMemo(() => buildStatements(lines, settlements), [lines, settlements])

  async function updateFulfilment(line: OrderLine, status: string) {
    try {
      await setLineFulfilment(line.id, status)
      toast.success('Status updated.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Supplier Portal</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Earnings & Statements</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Your assigned services, commission, settlement status and payout statements.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Amount Earned (Net)', value: formatMoney(earned), icon: Wallet, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Commission Deducted', value: formatMoney(commission), icon: FileText, color: 'text-gray-500', bg: 'bg-gray-100' },
          { label: 'Awaiting Settlement', value: formatMoney(pending), icon: Clock, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
          { label: 'Paid Out', value: formatMoney(settled), icon: CheckCircle, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className={`${s.bg} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}><Icon size={15} className={s.color} /></div>
              <p className="font-display italic text-xl text-[#000000]">{loading ? '…' : s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="flex gap-0 border border-gray-200 bg-white rounded-xl overflow-hidden w-fit mb-6">
        {([['services', `My Services (${lines.length})`], ['statements', `Statements (${statements.length})`], ['settlements', `Settlements (${settlements.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 font-sans text-sm transition-colors border-r border-gray-100 last:border-0 ${tab === id ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'services' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead><tr className="border-b border-gray-100">
                {['Booking Ref', 'Service', 'Guest', 'Travel Dates', 'Gross', 'Commission', 'Your Net', 'Payment', 'Settlement', 'Fulfilment'].map(h =>
                  <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map(l => (
                  <tr key={l.id} className={l.fulfilment_status === 'cancelled' ? 'opacity-50' : ''}>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-400">{l.order_number}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-sans text-sm text-gray-700">{l.title}</p>
                      <p className="font-sans text-[11px] text-gray-400 capitalize">{l.category}{l.guests ? ` · ${l.guests} guest${l.guests !== 1 ? 's' : ''}` : ''}</p>
                    </td>
                    <td className="px-4 py-3.5 font-sans text-xs text-gray-500">{l.share_customer_name ? l.customer_name || '—' : '—'}</td>
                    <td className="px-4 py-3.5 font-sans text-xs text-gray-500">{fmt(l.service_date)}{l.end_date ? ` → ${fmt(l.end_date)}` : ''}</td>
                    <td className="px-4 py-3.5 font-sans text-sm">{formatMoney(Number(l.gross_amount) - Number(l.discount_amount), l.currency)}</td>
                    <td className="px-4 py-3.5 font-sans text-sm text-gray-500">−{formatMoney(Number(l.commission_amount) + Number(l.platform_fee), l.currency)}</td>
                    <td className="px-4 py-3.5 font-display italic text-[#2d6a4f]">{formatMoney(Number(l.supplier_share), l.currency)}</td>
                    <td className="px-4 py-3.5 font-sans text-xs capitalize text-gray-500">{l.payment_status}</td>
                    <td className="px-4 py-3.5">
                      <span className={`font-sans text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 ${SETTLE_BADGE[l.settlement_status] ?? 'bg-gray-100 text-gray-500'}`}>{l.settlement_status}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {l.fulfilment_status === 'cancelled' ? (
                        <span className="font-sans text-xs text-red-400">cancelled</span>
                      ) : (
                        <select value={l.fulfilment_status} onChange={e => updateFulfilment(l, e.target.value)}
                          className="border border-gray-200 bg-white rounded px-2 py-1 font-sans text-xs focus:outline-none">
                          {['pending', 'confirmed', 'in_progress', 'fulfilled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && lines.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center font-sans text-sm text-gray-400">No services assigned to you yet. New bookings appear here automatically.</td></tr>}
                {loading && <tr><td colSpan={10} className="px-4 py-12 text-center font-sans text-sm text-gray-400">Loading your services…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'statements' && (
        <div className="space-y-3">
          {statements.map(st => <StatementCard key={st.period} st={st} />)}
          {!loading && statements.length === 0 && <p className="font-sans text-sm text-gray-400 py-8 text-center">No statements yet — statements are generated from your assigned services.</p>}
        </div>
      )}

      {tab === 'settlements' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr className="border-b border-gray-100">
                {['Reference', 'Method', 'Period', 'Services', 'Net Amount', 'Status', 'Payout Ref', 'Paid'].map(h =>
                  <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{s.reference}</td>
                    <td className="px-4 py-3.5 font-sans text-xs capitalize text-gray-500">{s.method}</td>
                    <td className="px-4 py-3.5 font-sans text-xs text-gray-500">{fmt(s.period_start)}{s.period_end && s.period_end !== s.period_start ? ` — ${fmt(s.period_end)}` : ''}</td>
                    <td className="px-4 py-3.5 font-sans text-sm text-gray-500">{s.line_count}</td>
                    <td className="px-4 py-3.5 font-display italic text-[#2d6a4f]">{formatMoney(Number(s.net_amount), s.currency)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`font-sans text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 ${
                        s.status === 'paid' ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
                        : s.status === 'reversed' ? 'bg-red-50 text-red-400'
                        : 'bg-[#C9A96E]/15 text-[#8B6914]'}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-400">{s.payout_reference || '—'}</td>
                    <td className="px-4 py-3.5 font-sans text-xs text-gray-500">{fmt(s.paid_at)}</td>
                  </tr>
                ))}
                {!loading && settlements.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center font-sans text-sm text-gray-400">No settlements yet. Payouts appear here once Visit Drakensberg processes them.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
