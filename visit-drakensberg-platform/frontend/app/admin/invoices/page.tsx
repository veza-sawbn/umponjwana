'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Search, RefreshCw, Plus, Printer, Trash2, X, FileText } from 'lucide-react'
import { getInvoices, getFinanceSettings, type Invoice } from '@/lib/invoices'
import { createOrder, type OrderLineInput } from '@/lib/orders'
import { formatMoney } from '@/lib/allocation'
import { supabase } from '@/lib/auth'

// Invoice module: list every customer invoice and raise new ones manually
// (phone/walk-in/custom bookings). A manual invoice creates a full Master
// Order behind the scenes, so supplier allocation, ledger entries and
// payment tracking work exactly like a checkout order.

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  partial: 'bg-[#C9A96E]/15 text-[#8B6914]',
  unpaid: 'bg-gray-100 text-gray-500',
  refunded: 'bg-red-50 text-red-400',
  void: 'bg-red-50 text-red-400',
}

const CATEGORIES = ['accommodation', 'activity', 'tour', 'hike', 'event', 'shuttle', 'equipment', 'permit', 'levy', 'donation', 'meal', 'package', 'extra']

type Person = { id: string; full_name: string | null; email: string | null; role: string }

type DraftLine = {
  title: string
  category: string
  quantity: string
  unitLabel: string
  unitPrice: string
  supplierId: string   // '' = platform-owned
}

const emptyLine = (): DraftLine => ({ title: '', category: 'extra', quantity: '1', unitLabel: 'unit', unitPrice: '', supplierId: '' })

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function NewInvoiceModal({ customers, suppliers, onClose, onCreated }: {
  customers: Person[]
  suppliers: Person[]
  onClose: () => void
  onCreated: (invoiceId: string) => void
}) {
  const [customerId, setCustomerId] = useState('')
  const [tripName, setTripName] = useState('')
  const [travelStart, setTravelStart] = useState('')
  const [travelEnd, setTravelEnd] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [rates, setRates] = useState({ serviceFeeRate: 0.12, vatRate: 0.15, currency: 'ZAR' })
  const [feeOverride, setFeeOverride] = useState('')
  const [taxOverride, setTaxOverride] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { getFinanceSettings().then(setRates) }, [])

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.quantity) || 0), 0)
  const serviceFee = feeOverride !== '' ? (parseFloat(feeOverride) || 0) : Math.round(subtotal * rates.serviceFeeRate)
  const tax = taxOverride !== '' ? (parseFloat(taxOverride) || 0) : Math.round((subtotal + serviceFee) * rates.vatRate)
  const total = subtotal + serviceFee + tax

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  async function submit() {
    const customer = customers.find(c => c.id === customerId)
    if (!customer) { toast.error('Select a customer.'); return }
    const validLines = lines.filter(l => l.title.trim() && parseFloat(l.unitPrice) > 0)
    if (validLines.length === 0) { toast.error('Add at least one line with a title and price.'); return }
    setBusy(true)
    try {
      const orderLines: OrderLineInput[] = validLines.map(l => ({
        supplierId: l.supplierId || null,
        supplierName: l.supplierId
          ? (suppliers.find(s => s.id === l.supplierId)?.full_name || 'Supplier')
          : 'Visit Drakensberg',
        category: l.category,
        title: l.title.trim(),
        serviceDate: travelStart || undefined,
        endDate: travelEnd || undefined,
        quantity: parseFloat(l.quantity) || 1,
        unitLabel: l.unitLabel || 'unit',
        unitPrice: parseFloat(l.unitPrice) || 0,
        grossAmount: (parseFloat(l.unitPrice) || 0) * (parseFloat(l.quantity) || 1),
      }))
      const res = await createOrder(
        {
          customerName: customer.full_name || customer.email || '',
          customerEmail: customer.email || '',
          tripName: tripName.trim() || 'Manual invoice',
          travelStart: travelStart || undefined,
          travelEnd: travelEnd || undefined,
          subtotal,
          serviceFee,
          taxAmount: tax,
          total,
          value: { manual: true },
        },
        orderLines,
        { userId: customer.id },
      )
      toast.success(`Invoice ${res.invoiceNumber} created.`)
      onCreated(res.invoiceId)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invoice creation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-4xl w-full max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Invoice Module</p>
            <h2 className="font-display italic text-2xl">New Invoice</h2>
            <p className="font-sans text-xs text-gray-400 mt-1">Creates a Master Order with supplier allocations, ledger entries and a single customer invoice.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer (registered account)</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-200 bg-white px-3 py-2.5 font-sans text-sm focus:outline-none">
              <option value="">Select a customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email} {c.email ? `(${c.email})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Trip Name</label>
            <input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="e.g. Champagne Valley weekend" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Travel Start</label>
            <input type="date" value={travelStart} onChange={e => setTravelStart(e.target.value)} className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Travel End</label>
            <input type="date" value={travelEnd} onChange={e => setTravelEnd(e.target.value)} className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
          </div>
        </div>

        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Line Items</p>
        <div className="space-y-2 mb-3">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input value={l.title} onChange={e => setLine(i, { title: e.target.value })} placeholder="Service description" className="col-span-4 border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none" />
              <select value={l.category} onChange={e => setLine(i, { category: e.target.value })} className="col-span-2 border border-gray-200 bg-white px-2 py-2 font-sans text-xs capitalize focus:outline-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={l.supplierId} onChange={e => setLine(i, { supplierId: e.target.value })} className="col-span-3 border border-gray-200 bg-white px-2 py-2 font-sans text-xs focus:outline-none">
                <option value="">Visit Drakensberg (platform)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
              </select>
              <input value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} placeholder="Qty" className="col-span-1 border border-gray-200 px-2 py-2 font-sans text-sm text-right focus:outline-none" />
              <input value={l.unitPrice} onChange={e => setLine(i, { unitPrice: e.target.value })} placeholder="Unit R" className="col-span-1 border border-gray-200 px-2 py-2 font-sans text-sm text-right focus:outline-none" />
              <button onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)} className="col-span-1 text-gray-300 hover:text-red-400 flex justify-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setLines(ls => [...ls, emptyLine()])} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline mb-6">
          <Plus size={12} /> Add line
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-gray-200 pt-4">
          <div className="flex gap-3">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Service fee</label>
              <input value={feeOverride} onChange={e => setFeeOverride(e.target.value)} placeholder={String(serviceFee)} className="w-24 border border-gray-200 px-2 py-1.5 font-sans text-sm text-right focus:outline-none" />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">VAT</label>
              <input value={taxOverride} onChange={e => setTaxOverride(e.target.value)} placeholder={String(tax)} className="w-24 border border-gray-200 px-2 py-1.5 font-sans text-sm text-right focus:outline-none" />
            </div>
          </div>
          <div className="text-right">
            <p className="font-sans text-xs text-gray-500">Subtotal {formatMoney(subtotal)} · Fee {formatMoney(serviceFee)} · VAT {formatMoney(tax)}</p>
            <p className="font-display italic text-2xl text-[#2d6a4f]">Total {formatMoney(total)}</p>
          </div>
          <button onClick={submit} disabled={busy}
            className={`px-6 py-3 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
            {busy ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function load() {
    setLoading(true)
    const [inv, prof] = await Promise.all([
      getInvoices(),
      (async () => {
        try {
          const { data } = await supabase.from('profiles').select('id, full_name, email, role').order('full_name')
          return Array.isArray(data) ? data as Person[] : []
        } catch { return [] }
      })(),
    ])
    setInvoices(inv); setPeople(prof)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const customers = useMemo(() => people.filter(p => p.role !== 'supplier'), [people])
  const suppliers = useMemo(() => people.filter(p => p.role === 'supplier'), [people])

  const filtered = useMemo(() => invoices.filter(i => {
    const hay = `${i.invoice_number} ${i.order_id}`.toLowerCase()
    return hay.includes(search.toLowerCase()) && (filter === 'all' || i.status === filter)
  }), [invoices, search, filter])

  const totalBilled = invoices.filter(i => i.status !== 'void').reduce((s, i) => s + Number(i.total), 0)
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  const totalOutstanding = invoices.filter(i => i.status !== 'void').reduce((s, i) => s + Number(i.balance), 0)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Order Management</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Invoices</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">One invoice per Master Order. Checkout invoices are automatic; raise manual invoices here for phone or custom bookings.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#245741] transition-colors">
            <Plus size={14} /> New Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Billed', value: formatMoney(totalBilled) },
          { label: 'Collected', value: formatMoney(totalCollected) },
          { label: 'Outstanding', value: formatMoney(totalOutstanding) },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 p-4">
            <div className="bg-[#2d6a4f]/8 w-8 h-8 flex items-center justify-center mb-3"><FileText size={15} className="text-[#2d6a4f]" /></div>
            <p className="font-display italic text-xl text-[#000000]">{loading ? '…' : s.value}</p>
            <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 flex-1 min-w-[220px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice number…" className="flex-1 font-sans text-sm focus:outline-none" />
        </div>
        <div className="flex gap-0 border border-gray-200 bg-white overflow-hidden">
          {['all', 'unpaid', 'partial', 'paid', 'refunded', 'void'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 font-sans text-xs capitalize transition-colors border-r border-gray-100 last:border-0 ${filter === f ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead><tr className="border-b border-gray-100">
            {['Invoice', 'Issued', 'Subtotal', 'VAT', 'Total', 'Paid', 'Balance', 'Status', ''].map(h =>
              <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(i => (
              <tr key={i.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4 font-mono text-xs text-gray-500">{i.invoice_number}</td>
                <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(i.issued_at)}</td>
                <td className="px-5 py-4 font-sans text-sm">{formatMoney(Number(i.subtotal), i.currency)}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-500">{formatMoney(Number(i.tax_amount), i.currency)}</td>
                <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(Number(i.total), i.currency)}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{formatMoney(Number(i.amount_paid), i.currency)}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{formatMoney(Number(i.balance), i.currency)}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_BADGE[i.status] ?? STATUS_BADGE.unpaid}`}>{i.status}</span>
                </td>
                <td className="px-5 py-4">
                  <Link href={`/invoices/${i.id}`} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                    <Printer size={12} /> View / Print
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No invoices found.</td></tr>}
            {loading && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading invoices…</td></tr>}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewInvoiceModal
          customers={customers}
          suppliers={suppliers}
          onClose={() => setShowNew(false)}
          onCreated={() => load()}
        />
      )}
    </div>
  )
}
