'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Banknote, Clock, CheckCircle, Undo2, X } from 'lucide-react'
import {
  getSettlements, getSupplierBalances, createSettlement, approveSettlement,
  paySettlement, reverseSettlement,
  type Settlement, type SupplierBalance,
} from '@/lib/settlements'
import { formatMoney } from '@/lib/allocation'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  approved: 'bg-blue-50 text-blue-500',
  paid: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  reversed: 'bg-red-50 text-red-400',
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function CreateSettlementModal({ balance, onClose, onCreated }: {
  balance: SupplierBalance
  onClose: () => void
  onCreated: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(balance.unsettledLines.map(l => l.id)))
  const [method, setMethod] = useState('manual')
  const [scheduledFor, setScheduledFor] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedLines = balance.unsettledLines.filter(l => selected.has(l.id))
  const net = selectedLines.reduce((s, l) => s + Number(l.supplier_share), 0)
  const isPartial = selected.size > 0 && selected.size < balance.unsettledLines.length

  async function submit() {
    if (selected.size === 0) { toast.error('Select at least one line.'); return }
    setBusy(true)
    try {
      await createSettlement({
        supplierId: balance.supplierId,
        lineIds: [...selected],
        method: isPartial && method === 'manual' ? 'partial' : method,
        scheduledFor: scheduledFor || undefined,
        notes,
      })
      toast.success('Settlement created — pending approval.')
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Settlement failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">New Settlement</p>
            <h2 className="font-display italic text-2xl">{balance.supplierName}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <select value={method} onChange={e => setMethod(e.target.value)} className="border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none">
            {['manual', 'weekly', 'monthly', 'bulk', 'scheduled', 'partial'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="date" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none" title="Scheduled payout date (optional)" />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="flex-1 min-w-[160px] border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none" />
        </div>

        <div className="border border-gray-200 overflow-x-auto mb-4">
          <table className="w-full min-w-[600px]">
            <thead><tr className="border-b border-gray-100">
              <th className="px-3 py-2">
                <input type="checkbox" checked={selected.size === balance.unsettledLines.length}
                  onChange={e => setSelected(e.target.checked ? new Set(balance.unsettledLines.map(l => l.id)) : new Set())} />
              </th>
              {['Order', 'Service', 'Date', 'Gross', 'Commission', 'Net'].map(h =>
                <th key={h} className="text-left px-3 py-2 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {balance.unsettledLines.map(l => (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(l.id)}
                      onChange={e => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(l.id); else next.delete(l.id)
                        setSelected(next)
                      }} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{l.order_number}</td>
                  <td className="px-3 py-2 font-sans text-sm text-gray-700">{l.title}</td>
                  <td className="px-3 py-2 font-sans text-xs text-gray-500">{fmt(l.service_date)}</td>
                  <td className="px-3 py-2 font-sans text-sm">{formatMoney(Number(l.gross_amount) - Number(l.discount_amount))}</td>
                  <td className="px-3 py-2 font-sans text-sm text-gray-500">{formatMoney(Number(l.commission_amount))}</td>
                  <td className="px-3 py-2 font-sans text-sm text-[#2d6a4f]">{formatMoney(Number(l.supplier_share))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <p className="font-sans text-sm text-gray-600">
            {selected.size} line{selected.size !== 1 ? 's' : ''}{isPartial ? ' (partial payout)' : ''} · Net payout: <span className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(net)}</span>
          </p>
          <button onClick={submit} disabled={busy || selected.size === 0}
            className={`px-5 py-2.5 font-sans text-sm transition-colors ${busy || selected.size === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
            {busy ? 'Creating…' : 'Create Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminSettlementsPage() {
  const [balances, setBalances] = useState<SupplierBalance[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<SupplierBalance | null>(null)
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const [b, s] = await Promise.all([getSupplierBalances(), getSettlements()])
    setBalances(b); setSettlements(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const pendingPayouts = settlements.filter(s => s.status !== 'reversed' && s.status !== 'paid')
    .reduce((sum, s) => sum + Number(s.net_amount), 0)
  const paidOut = settlements.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.net_amount), 0)
  const unsettledTotal = balances.reduce((s, b) => s + b.net, 0)

  async function act(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast.success(ok); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed') }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Settlement Engine</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Supplier Settlements</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Weekly, monthly, manual, partial, bulk and scheduled payouts with approval and reversal.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Unsettled Supplier Balances', value: formatMoney(unsettledTotal), icon: Clock, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
          { label: 'Settlements Awaiting Payout', value: formatMoney(pendingPayouts), icon: Banknote, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Paid Out', value: formatMoney(paidOut), icon: CheckCircle, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <div className={`${s.bg} w-8 h-8 flex items-center justify-center mb-3`}><Icon size={15} className={s.color} /></div>
              <p className="font-display italic text-xl text-[#000000]">{loading ? '…' : s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Outstanding balances */}
      <h2 className="font-display italic text-xl mb-3">Outstanding Supplier Balances</h2>
      <div className="bg-white border border-gray-200 overflow-x-auto mb-10">
        <table className="w-full min-w-[800px]">
          <thead><tr className="border-b border-gray-100">
            {['Supplier', 'Unsettled Lines', 'Gross', 'Commission', 'Fees', 'Net Payable', ''].map(h =>
              <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {balances.map(b => (
              <tr key={b.supplierId} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4 font-sans text-sm font-medium">{b.supplierName}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-500">{b.unsettledLines.length}</td>
                <td className="px-5 py-4 font-sans text-sm">{formatMoney(b.gross)}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-500">{formatMoney(b.commission)}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-500">{formatMoney(b.fees)}</td>
                <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(b.net)}</td>
                <td className="px-5 py-4">
                  <button onClick={() => setCreating(b)} className="font-sans text-xs text-white bg-[#2d6a4f] px-3 py-1.5 hover:bg-[#245741] transition-colors">Settle</button>
                </td>
              </tr>
            ))}
            {!loading && balances.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center font-sans text-sm text-gray-400">No unsettled supplier balances.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Settlement history */}
      <h2 className="font-display italic text-xl mb-3">Settlements</h2>
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead><tr className="border-b border-gray-100">
            {['Reference', 'Supplier', 'Method', 'Period', 'Lines', 'Net Amount', 'Status', 'Payout Ref', 'Actions'].map(h =>
              <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {settlements.map(s => (
              <tr key={s.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4 font-mono text-xs text-gray-500">{s.reference}</td>
                <td className="px-5 py-4 font-sans text-sm">{s.supplier_name}</td>
                <td className="px-5 py-4 font-sans text-xs capitalize text-gray-500">{s.method}{s.scheduled_for ? ` · ${fmt(s.scheduled_for)}` : ''}</td>
                <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(s.period_start)}{s.period_end && s.period_end !== s.period_start ? ` — ${fmt(s.period_end)}` : ''}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-500">{s.line_count}</td>
                <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(Number(s.net_amount), s.currency)}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                </td>
                <td className="px-5 py-4">
                  {s.status === 'paid' || s.status === 'reversed'
                    ? <span className="font-mono text-xs text-gray-400">{s.payout_reference || '—'}</span>
                    : <input value={payoutRefs[s.id] ?? ''} onChange={e => setPayoutRefs({ ...payoutRefs, [s.id]: e.target.value })}
                        placeholder="EFT ref…" className="w-28 border border-gray-200 px-2 py-1 font-sans text-xs focus:outline-none" />}
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    {s.status === 'pending' && (
                      <button onClick={() => act(() => approveSettlement(s.id), 'Settlement approved.')} className="font-sans text-xs text-blue-500 hover:underline">Approve</button>
                    )}
                    {(s.status === 'pending' || s.status === 'approved') && (
                      <button onClick={() => act(() => paySettlement(s.id, payoutRefs[s.id] ?? ''), 'Settlement paid — supplier balance updated.')} className="font-sans text-xs text-[#2d6a4f] hover:underline">Mark Paid</button>
                    )}
                    {s.status !== 'reversed' && (
                      <button onClick={() => act(() => reverseSettlement(s.id, 'Reversed from admin console'), 'Settlement reversed.')} className="font-sans text-xs text-red-400 hover:underline inline-flex items-center gap-1"><Undo2 size={11} />Reverse</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && settlements.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center font-sans text-sm text-gray-400">No settlements yet — settle a supplier balance above.</td></tr>}
          </tbody>
        </table>
      </div>

      {creating && <CreateSettlementModal balance={creating} onClose={() => setCreating(null)} onCreated={load} />}
    </div>
  )
}
