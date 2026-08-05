'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, Receipt, Wallet, AlertCircle, CheckCircle,
  ChevronDown, ChevronUp, StickyNote, BookOpen,
} from 'lucide-react'
import {
  getOrders, getOrderLines, getOrderNotes, addOrderNote, updateOrderStatus,
  updateLineAllocation, setLineFulfilment,
  type MasterOrder, type OrderLine, type OrderNote,
} from '@/lib/orders'
import { getInvoiceByOrder, type Invoice } from '@/lib/invoices'
import { recordOrderPayment, getOrderPayments, type OrderPayment, PAYMENT_TYPES, PAYMENT_METHODS } from '@/lib/order-payments'
import { getLedgerEntries, type LedgerEntry } from '@/lib/ledger'
import { formatMoney } from '@/lib/allocation'
import { supabase } from '@/lib/auth'

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  fulfilled: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  settled: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  partial: 'bg-[#C9A96E]/15 text-[#8B6914]',
  deposit: 'bg-[#C9A96E]/15 text-[#8B6914]',
  partially_confirmed: 'bg-[#C9A96E]/15 text-[#8B6914]',
  allocated: 'bg-[#C9A96E]/15 text-[#8B6914]',
  pending: 'bg-gray-100 text-gray-500',
  unpaid: 'bg-gray-100 text-gray-500',
  unsettled: 'bg-gray-100 text-gray-500',
  open: 'bg-gray-100 text-gray-500',
  planned: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-50 text-blue-500',
  cancelled: 'bg-red-50 text-red-400',
  refunded: 'bg-red-50 text-red-400',
  void: 'bg-red-50 text-red-400',
}

function Badge({ v }: { v: string }) {
  return (
    <span className={`font-sans text-[10px] tracking-[0.08em] uppercase px-2 py-0.5 whitespace-nowrap ${STATUS_BADGE[v] ?? 'bg-gray-100 text-gray-500'}`}>
      {v.replace(/_/g, ' ')}
    </span>
  )
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function OrderDetail({ order, onChanged }: { order: MasterOrder; onChanged: () => void }) {
  const [lines, setLines] = useState<OrderLine[]>([])
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [notes, setNotes] = useState<OrderNote[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [tab, setTab] = useState<'lines' | 'payments' | 'invoice' | 'ledger' | 'notes'>('lines')
  const [newNote, setNewNote] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payType, setPayType] = useState('payment')
  const [payMethod, setPayMethod] = useState('eft')
  const [payRef, setPayRef] = useState('')
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [commEdit, setCommEdit] = useState('')

  async function load() {
    const [l, inv, pay, n, led] = await Promise.all([
      getOrderLines(order.id),
      getInvoiceByOrder(order.id),
      getOrderPayments(order.id),
      getOrderNotes(order.id),
      getLedgerEntries({ orderId: order.id }),
    ])
    setLines(l); setInvoice(inv); setPayments(pay); setNotes(n); setLedger(led)
  }
  useEffect(() => { load() }, [order.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitPayment() {
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount.'); return }
    try {
      await recordOrderPayment({ orderId: order.id, amount, type: payType, method: payMethod, reference: payRef })
      toast.success('Payment recorded — receipt issued and ledger updated.')
      setPayAmount(''); setPayRef('')
      await load(); onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed')
    }
  }

  async function saveCommission(line: OrderLine) {
    const rate = parseFloat(commEdit)
    if (isNaN(rate) || rate < 0 || rate > 1) { toast.error('Commission rate must be between 0 and 1 (e.g. 0.12).'); return }
    try {
      await updateLineAllocation(line.id, { commissionRate: rate })
      toast.success('Allocation recalculated.')
      setEditingLine(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function submitNote() {
    if (!newNote.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await addOrderNote(order.id, newNote.trim(), user?.user_metadata?.full_name || user?.email || 'Staff')
    setNewNote('')
    await load()
  }

  const tabs = [
    { id: 'lines', label: `Line Items (${lines.length})` },
    { id: 'payments', label: `Payments (${payments.length})` },
    { id: 'invoice', label: 'Invoice' },
    { id: 'ledger', label: `Ledger (${ledger.length})` },
    { id: 'notes', label: `Internal Notes (${notes.length})` },
  ] as const

  return (
    <div className="border-t border-gray-100 bg-[#F7F5F2] px-4 sm:px-5 py-4 sm:py-5">
      {/* Status controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        {([
          ['trip_status', ['planned', 'in_progress', 'completed', 'cancelled']],
          ['booking_status', ['pending', 'confirmed', 'cancelled']],
          ['financial_status', ['open', 'settled', 'closed', 'written_off']],
        ] as Array<[keyof MasterOrder & string, string[]]>).map(([field, opts]) => (
          <label key={field} className="flex items-center gap-2 font-sans text-xs text-gray-500">
            <span className="uppercase text-[10px] tracking-[0.1em] text-gray-400">{field.replace('_', ' ')}</span>
            <select
              value={String(order[field])}
              onChange={async e => {
                try {
                  await updateOrderStatus(order.id, { [field]: e.target.value })
                  onChanged()
                } catch { toast.error('Update failed') }
              }}
              className="border border-gray-200 bg-white px-2 py-1 font-sans text-xs focus:outline-none"
            >
              {opts.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
        ))}
        <span className="ml-auto flex items-center gap-2 font-sans text-xs text-gray-400">
          Supplier status: <Badge v={order.supplier_status} /> · Payment: <Badge v={order.payment_status} />
        </span>
      </div>

      <div className="flex gap-0 border border-gray-200 bg-white overflow-x-auto mb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 font-sans text-xs whitespace-nowrap transition-colors border-r border-gray-100 last:border-0 ${tab === t.id ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lines' && (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead><tr className="border-b border-gray-100">
              {['Service', 'Supplier', 'Qty', 'Gross', 'Commission', 'Platform Fee', 'Supplier Net', 'VD Share', 'Payment', 'Fulfilment', 'Settlement', ''].map(h =>
                <th key={h} className="text-left px-4 py-2.5 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map(l => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <p className="font-sans text-sm text-gray-700">{l.title}</p>
                    <p className="font-sans text-[11px] text-gray-400 capitalize">{l.category} · {fmt(l.service_date)}{l.end_date ? ` → ${fmt(l.end_date)}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 font-sans text-xs text-gray-500">{l.supplier_name}{!l.supplier_id && <span className="text-gray-300"> (platform)</span>}</td>
                  <td className="px-4 py-3 font-sans text-xs text-gray-500">{Number(l.quantity)} {l.unit_label}{Number(l.quantity) !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 font-sans text-sm">{formatMoney(Number(l.gross_amount) - Number(l.discount_amount), l.currency)}</td>
                  <td className="px-4 py-3 font-sans text-xs text-gray-500">
                    {editingLine === l.id ? (
                      <span className="flex items-center gap-1">
                        <input value={commEdit} onChange={e => setCommEdit(e.target.value)} className="w-16 border border-gray-200 px-1.5 py-0.5 text-xs" />
                        <button onClick={() => saveCommission(l)} className="text-[#2d6a4f] hover:underline">Save</button>
                        <button onClick={() => setEditingLine(null)} className="text-gray-400 hover:underline">×</button>
                      </span>
                    ) : (
                      <>{formatMoney(Number(l.commission_amount), l.currency)} <span className="text-gray-300">({(Number(l.commission_rate) * 100).toFixed(0)}%)</span></>
                    )}
                  </td>
                  <td className="px-4 py-3 font-sans text-xs text-gray-500">{formatMoney(Number(l.platform_fee), l.currency)}</td>
                  <td className="px-4 py-3 font-sans text-sm text-[#2d6a4f]">{formatMoney(Number(l.supplier_share), l.currency)}</td>
                  <td className="px-4 py-3 font-sans text-xs text-gray-500">{formatMoney(Number(l.platform_share), l.currency)}</td>
                  <td className="px-4 py-3"><Badge v={l.payment_status} /></td>
                  <td className="px-4 py-3">
                    <select value={l.fulfilment_status}
                      onChange={async e => {
                        try { await setLineFulfilment(l.id, e.target.value); await load(); onChanged() }
                        catch (err) { toast.error(err instanceof Error ? err.message : 'Failed') }
                      }}
                      className="border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[11px] focus:outline-none">
                      {['pending', 'confirmed', 'in_progress', 'fulfilled', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><Badge v={l.settlement_status} /></td>
                  <td className="px-4 py-3">
                    {l.supplier_id && l.settlement_status === 'unsettled' && editingLine !== l.id && (
                      <button onClick={() => { setEditingLine(l.id); setCommEdit(String(l.commission_rate)) }}
                        className="font-sans text-[11px] text-[#2d6a4f] hover:underline whitespace-nowrap">Edit allocation</button>
                    )}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center font-sans text-sm text-gray-400">No line items.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 p-4">
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">Record payment / refund / credit</p>
            <div className="flex flex-wrap gap-2">
              <input value={payAmount} onChange={e => setPayAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="w-28 border border-gray-200 px-3 py-2.5 sm:py-2 font-sans text-base sm:text-sm focus:outline-none" />
              <select value={payType} onChange={e => setPayType(e.target.value)} className="border border-gray-200 bg-white px-2 py-2 font-sans text-sm focus:outline-none">
                {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="border border-gray-200 bg-white px-2 py-2 font-sans text-sm focus:outline-none">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
              <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Reference (optional)" className="flex-1 min-w-[140px] border border-gray-200 px-3 py-2.5 sm:py-2 font-sans text-base sm:text-sm focus:outline-none" />
              <button onClick={submitPayment} className="w-full sm:w-auto bg-[#2d6a4f] text-white px-4 py-3 sm:py-2 font-sans text-sm hover:bg-[#245741] transition-colors">Record</button>
            </div>
            <p className="font-sans text-[11px] text-gray-400 mt-2">
              Outstanding: {formatMoney(Number(order.outstanding_balance), order.currency)} · Refund balance: {formatMoney(Number(order.refund_balance), order.currency)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead><tr className="border-b border-gray-100">
                {['Date', 'Type', 'Method', 'Direction', 'Amount', 'Reference', 'Status'].map(h =>
                  <th key={h} className="text-left px-4 py-2.5 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-sans text-xs text-gray-500">{fmt(p.created_at)}</td>
                    <td className="px-4 py-3 font-sans text-xs capitalize">{p.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-sans text-xs capitalize text-gray-500">{p.method.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-sans text-xs">{p.direction === 'in' ? <span className="text-[#2d6a4f]">In</span> : <span className="text-red-400">Out</span>}</td>
                    <td className="px-4 py-3 font-sans text-sm">{p.direction === 'out' ? '−' : ''}{formatMoney(Number(p.amount), p.currency)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.reference || '—'}</td>
                    <td className="px-4 py-3"><Badge v={p.status} /></td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center font-sans text-sm text-gray-400">No payments recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'invoice' && (
        invoice ? (
          <div className="bg-white border border-gray-200 p-6 max-w-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#C9A96E]">Customer Invoice</p>
                <h3 className="font-display italic text-2xl">{invoice.invoice_number}</h3>
                <p className="font-sans text-xs text-gray-400 mt-1">{order.customer_name} · Issued {fmt(invoice.issued_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={`/invoices/${invoice.id}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                  Open printable invoice
                </a>
                <Badge v={invoice.status} />
              </div>
            </div>
            <table className="w-full mb-4">
              <tbody className="divide-y divide-gray-100">
                {invoice.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 font-sans text-sm text-gray-700">{l.title}<span className="text-gray-400 text-xs"> · {Number(l.quantity)} {l.unitLabel}{Number(l.quantity) !== 1 ? 's' : ''}</span></td>
                    <td className="py-2 text-right font-sans text-sm">{formatMoney(Number(l.total), invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-gray-200 pt-3 font-sans text-sm text-gray-600">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(Number(invoice.subtotal), invoice.currency)}</span></div>
              <div className="flex justify-between"><span>Service fee</span><span>{formatMoney(Number(invoice.service_fee), invoice.currency)}</span></div>
              <div className="flex justify-between"><span>VAT</span><span>{formatMoney(Number(invoice.tax_amount), invoice.currency)}</span></div>
              <div className="flex justify-between font-medium text-[#000000] text-base pt-1"><span>Total</span><span>{formatMoney(Number(invoice.total), invoice.currency)}</span></div>
              <div className="flex justify-between text-[#2d6a4f]"><span>Paid</span><span>{formatMoney(Number(invoice.amount_paid), invoice.currency)}</span></div>
              <div className="flex justify-between"><span>Balance</span><span>{formatMoney(Number(invoice.balance), invoice.currency)}</span></div>
            </div>
          </div>
        ) : <p className="font-sans text-sm text-gray-400 py-6 text-center">No invoice found for this order.</p>
      )}

      {tab === 'ledger' && (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead><tr className="border-b border-gray-100">
              {['Date', 'Account', 'Memo', 'Debit', 'Credit'].map(h =>
                <th key={h} className="text-left px-4 py-2.5 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {ledger.map(e => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 font-sans text-xs text-gray-500">{fmt(e.entry_date)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.account_code}</td>
                  <td className="px-4 py-2.5 font-sans text-xs text-gray-500">{e.memo}</td>
                  <td className="px-4 py-2.5 font-sans text-sm">{Number(e.debit) > 0 ? formatMoney(Number(e.debit)) : ''}</td>
                  <td className="px-4 py-2.5 font-sans text-sm">{Number(e.credit) > 0 ? formatMoney(Number(e.credit)) : ''}</td>
                </tr>
              ))}
              {ledger.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center font-sans text-sm text-gray-400">No ledger entries (finance role required to view).</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3 max-w-2xl">
          <div className="flex gap-2">
            <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add an internal note (never visible to customers or suppliers)…"
              className="flex-1 min-w-0 border border-gray-200 px-3 py-2.5 sm:py-2 font-sans text-base sm:text-sm bg-white focus:outline-none" />
            <button onClick={submitNote} className="bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#245741] transition-colors">Add</button>
          </div>
          {notes.map(n => (
            <div key={n.id} className="bg-white border border-gray-200 p-3">
              <p className="font-sans text-sm text-gray-700">{n.note}</p>
              <p className="font-sans text-[11px] text-gray-400 mt-1"><StickyNote size={10} className="inline mr-1" />{n.author} · {fmt(n.created_at)}</p>
            </div>
          ))}
          {notes.length === 0 && <p className="font-sans text-sm text-gray-400 py-4 text-center">No internal notes yet.</p>}
        </div>
      )}
    </div>
  )
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<MasterOrder[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setOrders(await getOrders())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => orders.filter(o => {
    const hay = `${o.order_number} ${o.customer_name} ${o.customer_email} ${o.trip_name}`.toLowerCase()
    const matchSearch = hay.includes(search.toLowerCase())
    const matchFilter = filter === 'all'
      || (filter === 'outstanding' && Number(o.outstanding_balance) > 0 && o.booking_status !== 'cancelled')
      || o.payment_status === filter || o.booking_status === filter
    return matchSearch && matchFilter
  }), [orders, search, filter])

  const totalValue = orders.filter(o => o.booking_status !== 'cancelled').reduce((s, o) => s + Number(o.total_value), 0)
  const received = orders.reduce((s, o) => s + Number(o.amount_paid), 0)
  const outstanding = orders.filter(o => o.booking_status !== 'cancelled').reduce((s, o) => s + Number(o.outstanding_balance), 0)
  const refundExposure = orders.reduce((s, o) => s + Number(o.refund_balance), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Order Management</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Master Orders</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Every trip as a single order — line items, supplier allocations, invoice, payments and ledger.</p>
        </div>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors shrink-0">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
        {[
          { label: 'Order Value', value: formatMoney(totalValue), icon: Receipt, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Cash Received', value: formatMoney(received), icon: Wallet, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Outstanding', value: formatMoney(outstanding), icon: AlertCircle, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
          { label: 'Refund Exposure', value: formatMoney(refundExposure), icon: BookOpen, color: 'text-red-400', bg: 'bg-red-50' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <div className={`${s.bg} w-8 h-8 flex items-center justify-center mb-3`}><Icon size={15} className={s.color} /></div>
              <p className="font-display italic text-xl text-[#000000]">{s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 sm:py-2 flex-1 sm:min-w-[220px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order number, customer, trip…" className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" />
        </div>
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <div className="flex w-max border border-gray-200 bg-white">
            {['all', 'paid', 'partial', 'unpaid', 'outstanding', 'cancelled'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2.5 sm:py-2 font-sans text-xs capitalize whitespace-nowrap transition-colors border-r border-gray-100 last:border-0 ${filter === f ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phones: a card per order, tapping expands the same detail panel. */}
      <div className="md:hidden bg-white border border-gray-200 divide-y divide-gray-100">
        {filtered.map(o => (
          <div key={o.id}>
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="w-full text-left p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-gray-500">{o.order_number}</p>
                  <p className="font-sans text-sm font-medium truncate mt-0.5">{o.customer_name || '—'}</p>
                  <p className="font-sans text-xs text-gray-400 truncate">{o.trip_name}</p>
                </div>
                {expanded === o.id ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </div>
              <div className="flex items-end justify-between gap-3 mt-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge v={o.payment_status} />
                  <Badge v={o.booking_status} />
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(Number(o.total_value), o.currency)}</p>
                  <p className="font-sans text-xs text-gray-400">Outstanding {formatMoney(Number(o.outstanding_balance), o.currency)}</p>
                </div>
              </div>
            </button>
            {expanded === o.id && <OrderDetail order={o} onChanged={load} />}
          </div>
        ))}
        {!loading && filtered.length === 0 && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">No orders found. Orders are created automatically at checkout.</p>}
        {loading && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">Loading orders…</p>}
      </div>

      <div className="hidden md:block bg-white border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead><tr className="border-b border-gray-100">
              {['Order', 'Customer', 'Trip', 'Travel Dates', 'Total', 'Paid', 'Outstanding', 'Payment', 'Booking', ''].map(h =>
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(o => (
                <Fragment key={o.id}>
                  <tr className="hover:bg-[#F7F5F2] transition-colors cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">{o.order_number}</td>
                    <td className="px-5 py-4">
                      <p className="font-sans text-sm font-medium">{o.customer_name || '—'}</p>
                      <p className="font-sans text-xs text-gray-400">{o.customer_email}</p>
                    </td>
                    <td className="px-5 py-4 font-sans text-xs text-gray-500 max-w-[220px] truncate">{o.trip_name}</td>
                    <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(o.travel_start)}{o.travel_end && o.travel_end !== o.travel_start ? ` — ${fmt(o.travel_end)}` : ''}</td>
                    <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(Number(o.total_value), o.currency)}</td>
                    <td className="px-5 py-4 font-sans text-sm text-gray-600">{formatMoney(Number(o.amount_paid), o.currency)}</td>
                    <td className="px-5 py-4 font-sans text-sm text-gray-600">{formatMoney(Number(o.outstanding_balance), o.currency)}</td>
                    <td className="px-5 py-4"><Badge v={o.payment_status} /></td>
                    <td className="px-5 py-4"><Badge v={o.booking_status} /></td>
                    <td className="px-5 py-4 text-gray-400">{expanded === o.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</td>
                  </tr>
                  {expanded === o.id && (
                    <tr>
                      <td colSpan={10} className="p-0"><OrderDetail order={o} onChanged={load} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={10} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No orders found. Orders are created automatically at checkout.</td></tr>}
              {loading && <tr><td colSpan={10} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading orders…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 font-sans text-xs text-gray-400 flex items-center gap-1.5">
        <CheckCircle size={12} className="text-[#2d6a4f]" />
        Every financial action here is written to the audit trail and produces balanced ledger entries.
      </p>
    </div>
  )
}
