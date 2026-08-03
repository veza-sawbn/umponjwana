'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Search, RefreshCw, Plus, Printer, Trash2, X, FileText, Send, Pencil, Wallet, Save } from 'lucide-react'
import { getInvoices, getFinanceSettings, sendInvoice, type Invoice } from '@/lib/invoices'
import { createOrder, updateOrder, getOrderLines, type OrderLineInput, type OrderLine } from '@/lib/orders'
import {
  getInvoiceDrafts, saveInvoiceDraft, deleteInvoiceDraft,
  type InvoiceDraft, type DraftLine,
} from '@/lib/invoice-drafts'
import {
  recordOrderPayment, getOrderPayments, type OrderPayment,
  PAYMENT_TYPES, PAYMENT_METHODS,
} from '@/lib/order-payments'
import { formatMoney } from '@/lib/allocation'
import { supabase } from '@/lib/auth'

// Invoice module: list every customer invoice and raise new ones manually
// (phone/walk-in/custom bookings). A manual invoice creates a full Master
// Order behind the scenes, so supplier allocation, ledger entries and
// payment tracking work exactly like a checkout order.
//
// Drafts are held separately in vd_invoice_drafts and touch none of that
// until issued — see lib/invoice-drafts.ts. Editing an issued invoice runs
// vd_update_order, which the database refuses once any payment exists.

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  partial: 'bg-[#C9A96E]/15 text-[#8B6914]',
  unpaid: 'bg-gray-100 text-gray-500',
  refunded: 'bg-red-50 text-red-400',
  void: 'bg-red-50 text-red-400',
}

const CATEGORIES = ['accommodation', 'activity', 'tour', 'hike', 'event', 'shuttle', 'equipment', 'permit', 'levy', 'donation', 'meal', 'package', 'extra']

type Person = { id: string; full_name: string | null; email: string | null; role: string }

const emptyLine = (): DraftLine => ({ title: '', description: '', category: 'extra', quantity: '1', unitLabel: 'unit', unitPrice: '', supplierId: '' })

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

/** Create / edit / draft form. `editing` switches it to updating an issued invoice. */
function InvoiceModal({ customers, suppliers, draft, editing, onClose, onDone }: {
  customers: Person[]
  suppliers: Person[]
  draft?: InvoiceDraft
  editing?: { invoice: Invoice; lines: OrderLine[] }
  onClose: () => void
  onDone: () => void
}) {
  const [customerMode, setCustomerMode] = useState<'registered' | 'guest'>(
    draft ? (draft.guest ? 'guest' : 'registered') : editing ? 'guest' : 'registered')
  const [customerId, setCustomerId] = useState(draft?.user_id ?? '')
  const [guestName, setGuestName] = useState(draft?.customer_name ?? editing?.lines[0]?.customer_name ?? '')
  const [guestEmail, setGuestEmail] = useState(draft?.customer_email ?? '')
  const [guestPhone, setGuestPhone] = useState(draft?.customer_phone ?? '')
  const [tripName, setTripName] = useState(draft?.trip_name ?? '')
  const [travelStart, setTravelStart] = useState(draft?.travel_start ?? '')
  const [travelEnd, setTravelEnd] = useState(draft?.travel_end ?? '')
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (draft?.lines?.length) return draft.lines
    if (editing?.lines.length) {
      return editing.lines.map(l => ({
        title: l.title,
        description: l.description ?? '',
        category: l.category,
        quantity: String(l.quantity),
        unitLabel: l.unit_label,
        unitPrice: String(l.unit_price),
        supplierId: l.supplier_id ?? '',
      }))
    }
    return [emptyLine()]
  })
  const [rates, setRates] = useState({ serviceFeeRate: 0.12, vatRate: 0.15, currency: 'ZAR' })
  const [feeOverride, setFeeOverride] = useState(draft?.fee_override ?? '')
  const [taxOverride, setTaxOverride] = useState(draft?.tax_override ?? '')
  const [busy, setBusy] = useState('')

  useEffect(() => { getFinanceSettings().then(setRates) }, [])

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.quantity) || 0), 0)
  const serviceFee = feeOverride !== '' ? (parseFloat(feeOverride) || 0) : Math.round(subtotal * rates.serviceFeeRate)
  const tax = taxOverride !== '' ? (parseFloat(taxOverride) || 0) : Math.round((subtotal + serviceFee) * rates.vatRate)
  const total = subtotal + serviceFee + tax

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  const validLines = lines.filter(l => l.title.trim() && parseFloat(l.unitPrice) > 0)

  function buildLines(): OrderLineInput[] {
    return validLines.map(l => ({
      supplierId: l.supplierId || null,
      supplierName: l.supplierId
        ? (suppliers.find(s => s.id === l.supplierId)?.full_name || 'Supplier')
        : 'Visit Drakensberg',
      category: l.category,
      title: l.title.trim(),
      description: l.description.trim() || undefined,
      serviceDate: travelStart || undefined,
      endDate: travelEnd || undefined,
      quantity: parseFloat(l.quantity) || 1,
      unitLabel: l.unitLabel || 'unit',
      unitPrice: parseFloat(l.unitPrice) || 0,
      grossAmount: (parseFloat(l.unitPrice) || 0) * (parseFloat(l.quantity) || 1),
    }))
  }

  async function handleSaveDraft() {
    if (validLines.length === 0 && !guestName.trim() && !customerId) {
      toast.error('Add a customer or a line before saving a draft.'); return
    }
    setBusy('draft')
    try {
      const customer = customers.find(c => c.id === customerId)
      const isGuest = customerMode === 'guest'
      await saveInvoiceDraft({
        user_id: isGuest ? null : (customerId || null),
        guest: isGuest,
        customer_name: isGuest ? guestName.trim() : (customer?.full_name || customer?.email || ''),
        customer_email: isGuest ? guestEmail.trim() : (customer?.email || ''),
        customer_phone: isGuest ? guestPhone.trim() : '',
        trip_name: tripName.trim(),
        travel_start: travelStart || null,
        travel_end: travelEnd || null,
        currency: rates.currency,
        lines,
        fee_override: feeOverride,
        tax_override: taxOverride,
        notes: '',
      }, draft?.id)
      toast.success('Draft saved.')
      onDone(); onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save draft')
    } finally { setBusy('') }
  }

  async function submit() {
    const customer = customers.find(c => c.id === customerId)
    const isGuest = customerMode === 'guest'
    if (!editing) {
      if (isGuest) {
        if (!guestName.trim()) { toast.error('Enter the customer name.'); return }
        if (!guestEmail.trim() || !guestEmail.includes('@')) { toast.error('Enter a valid customer email.'); return }
      } else if (!customer) {
        toast.error('Select a customer.'); return
      }
    }
    if (validLines.length === 0) { toast.error('Add at least one line with a title and price.'); return }

    setBusy('submit')
    try {
      const orderLines = buildLines()
      // The invoice document keeps the descriptions the customer should see.
      const invoiceLines = orderLines.map(l => ({
        title: l.title,
        description: l.description ?? '',
        category: l.category,
        quantity: l.quantity,
        unitLabel: l.unitLabel ?? 'unit',
        unitPrice: l.unitPrice,
        total: l.grossAmount ?? l.unitPrice * l.quantity,
      }))

      if (editing) {
        const res = await updateOrder(
          editing.invoice.order_id,
          {
            tripName: tripName.trim() || undefined,
            travelStart: travelStart || undefined,
            travelEnd: travelEnd || undefined,
            serviceFeeOverride: feeOverride,
            taxOverride: taxOverride,
          },
          orderLines,
          { invoiceLines },
        )
        toast.success(`Invoice ${res.invoiceNumber} updated.`)
      } else {
        const res = await createOrder(
          {
            guest: isGuest || undefined,
            customerName: isGuest ? guestName.trim() : (customer!.full_name || customer!.email || ''),
            customerEmail: isGuest ? guestEmail.trim() : (customer!.email || ''),
            tripName: tripName.trim() || 'Manual invoice',
            travelStart: travelStart || undefined,
            travelEnd: travelEnd || undefined,
            subtotal, serviceFee, taxAmount: tax, total,
            serviceFeeOverride: feeOverride,
            taxOverride: taxOverride,
            value: isGuest ? { manual: true, customerPhone: guestPhone.trim() } : { manual: true },
          },
          orderLines,
          { invoiceLines, userId: isGuest ? undefined : customer!.id },
        )
        toast.success(`Invoice ${res.invoiceNumber} created.`)
        if (draft) await deleteInvoiceDraft(draft.id).catch(() => {})
      }
      onDone(); onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invoice save failed')
    } finally { setBusy('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-5xl w-full max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Invoice Module</p>
            <h2 className="font-display italic text-2xl">
              {editing ? `Edit ${editing.invoice.invoice_number}` : draft ? 'Edit Draft' : 'New Invoice'}
            </h2>
            <p className="font-sans text-xs text-gray-400 mt-1">
              {editing
                ? 'Re-prices the order, supplier allocations and ledger. Locked once a payment is recorded.'
                : 'Creates a Master Order with supplier allocations, ledger entries and a single customer invoice.'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {!editing && (
          <div className="flex gap-0 border border-gray-200 bg-white overflow-hidden w-fit mb-4">
            {([['registered', 'Registered customer'], ['guest', 'Guest / manual details']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setCustomerMode(id)}
                className={`px-4 py-2 font-sans text-xs transition-colors border-r border-gray-100 last:border-0 ${customerMode === id ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {editing ? (
            <div className="md:col-span-2 bg-[#F7F5F2] border border-gray-200 px-4 py-3">
              <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Customer</p>
              <p className="font-sans text-sm text-gray-700">{editing.lines[0]?.customer_name || '—'}</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5">Customer details are changed on the order, not here.</p>
            </div>
          ) : customerMode === 'registered' ? (
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer (registered account)</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-200 bg-white px-3 py-2.5 font-sans text-sm focus:outline-none">
                <option value="">Select a customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email} {c.email ? `(${c.email})` : ''}</option>)}
              </select>
            </div>
          ) : (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer Name</label>
                <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer Email</label>
                <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="name@example.com" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer Phone (optional)</label>
                <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+27 82 000 0000" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
              </div>
            </div>
          )}
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
        <div className="space-y-3 mb-3">
          {lines.map((l, i) => (
            <div key={i} className="border border-gray-100 bg-[#FCFBFA] p-2.5">
              <div className="grid grid-cols-12 gap-2 items-center">
                <input value={l.title} onChange={e => setLine(i, { title: e.target.value })} placeholder="Service title" className="col-span-4 border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none" />
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
              <textarea
                value={l.description}
                onChange={e => setLine(i, { description: e.target.value })}
                rows={2}
                placeholder="Description — appears beneath the title on the customer's invoice (optional)"
                className="mt-2 w-full border border-gray-200 px-3 py-2 font-sans text-xs resize-none focus:outline-none"
              />
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
            <p className="font-sans text-[10px] text-gray-400 mt-0.5">
              Leave fee/VAT blank to use the configured rates. Any value entered — including 0 — is applied exactly.
            </p>
          </div>
          <div className="flex gap-2">
            {!editing && (
              <button onClick={handleSaveDraft} disabled={!!busy}
                className={`inline-flex items-center gap-1.5 px-5 py-3 font-sans text-sm border transition-colors ${busy ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'}`}>
                <Save size={14} /> {busy === 'draft' ? 'Saving…' : 'Save as Draft'}
              </button>
            )}
            <button onClick={submit} disabled={!!busy}
              className={`px-6 py-3 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
              {busy === 'submit' ? 'Saving…' : editing ? 'Save Changes' : draft ? 'Issue Invoice' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Payment history + record-a-payment panel for one invoice. */
function PaymentsModal({ invoice, onClose, onDone }: {
  invoice: Invoice
  onClose: () => void
  onDone: () => void
}) {
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<string>('payment')
  const [method, setMethod] = useState<string>('eft')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setPayments(await getOrderPayments(invoice.order_id))
    setLoading(false)
  }
  useEffect(() => { load() }, [invoice.order_id])

  const paid = payments.filter(p => p.direction === 'in').reduce((s, p) => s + Number(p.amount), 0)
  const refunded = payments.filter(p => p.direction === 'out').reduce((s, p) => s + Number(p.amount), 0)
  const outstanding = Number(invoice.total) - paid + refunded

  async function submit() {
    const value = parseFloat(amount)
    if (!value || value <= 0) { toast.error('Enter an amount greater than zero.'); return }
    setBusy(true)
    try {
      await recordOrderPayment({ orderId: invoice.order_id, amount: value, type, method, reference: reference.trim() })
      toast.success('Payment recorded — receipt emailed to the customer.')
      setAmount(''); setReference('')
      await load()
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record payment')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Invoice {invoice.invoice_number}</p>
            <h2 className="font-display italic text-2xl">Payments</h2>
            <p className="font-sans text-xs text-gray-400 mt-1">Record a deposit, instalment or partial payment. Each one issues its own receipt.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Invoice total', value: formatMoney(Number(invoice.total), invoice.currency) },
            { label: 'Received', value: formatMoney(paid - refunded, invoice.currency) },
            { label: 'Outstanding', value: formatMoney(outstanding, invoice.currency) },
          ].map(s => (
            <div key={s.label} className="border border-gray-200 p-3">
              <p className="font-display italic text-lg text-[#000000]">{s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="border border-gray-200 p-4 mb-6">
          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">Record payment / refund / credit</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" inputMode="decimal"
              className="border border-gray-200 px-3 py-2 font-sans text-sm text-right focus:outline-none" />
            <select value={type} onChange={e => setType(e.target.value)} className="border border-gray-200 bg-white px-2 py-2 font-sans text-xs capitalize focus:outline-none">
              {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <select value={method} onChange={e => setMethod(e.target.value)} className="border border-gray-200 bg-white px-2 py-2 font-sans text-xs capitalize focus:outline-none">
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference"
              className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none" />
          </div>
          <button onClick={submit} disabled={busy}
            className={`mt-3 px-5 py-2.5 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
            {busy ? 'Recording…' : 'Record'}
          </button>
        </div>

        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">History</p>
        {loading ? (
          <p className="font-sans text-sm text-gray-400 py-6 text-center">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="font-sans text-sm text-gray-400 py-6 text-center">No payments recorded yet.</p>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {['Date', 'Type', 'Method', 'Reference', 'Amount'].map(h =>
                <th key={h} className="text-left px-2 py-2 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="px-2 py-2.5 font-sans text-xs text-gray-500">{fmt(p.created_at)}</td>
                  <td className="px-2 py-2.5 font-sans text-xs capitalize">{p.type.replace('_', ' ')}</td>
                  <td className="px-2 py-2.5 font-sans text-xs capitalize text-gray-500">{p.method.replace('_', ' ')}</td>
                  <td className="px-2 py-2.5 font-mono text-[11px] text-gray-400">{p.reference || '—'}</td>
                  <td className={`px-2 py-2.5 font-sans text-sm text-right ${p.direction === 'out' ? 'text-red-400' : 'text-[#2d6a4f]'}`}>
                    {p.direction === 'out' ? '−' : ''}{formatMoney(Number(p.amount), p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [drafts, setDrafts] = useState<InvoiceDraft[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editingDraft, setEditingDraft] = useState<InvoiceDraft | undefined>()
  const [editingInvoice, setEditingInvoice] = useState<{ invoice: Invoice; lines: OrderLine[] } | undefined>()
  const [payingInvoice, setPayingInvoice] = useState<Invoice | undefined>()
  const [sending, setSending] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [inv, drf, prof] = await Promise.all([
      getInvoices(),
      getInvoiceDrafts(),
      (async () => {
        try {
          const { data } = await supabase.from('profiles').select('id, full_name, email, role').order('full_name')
          return Array.isArray(data) ? data as Person[] : []
        } catch { return [] }
      })(),
    ])
    setInvoices(inv); setDrafts(drf); setPeople(prof)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSend(id: string) {
    setSending(id)
    const { sent, error } = await sendInvoice(id)
    if (sent) toast.success('Invoice emailed to the customer.')
    else toast.error(`Could not email the invoice: ${error || 'unknown error'}`, { duration: 8000 })
    setSending(null)
  }

  async function handleEdit(invoice: Invoice) {
    setOpening(invoice.id)
    try {
      const lines = await getOrderLines(invoice.order_id)
      setEditingInvoice({ invoice, lines })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load invoice lines')
    } finally { setOpening(null) }
  }

  async function handleDeleteDraft(id: string) {
    try {
      await deleteInvoiceDraft(id)
      toast.success('Draft deleted.')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete draft')
    }
  }

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

      {/* Drafts — not yet issued, so they carry no invoice number and no ledger impact. */}
      {drafts.length > 0 && (
        <div className="bg-white border border-gray-200 mb-8">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Drafts · not issued</p>
            <p className="font-sans text-[10px] text-gray-400">No invoice number or ledger entry until issued</p>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              {drafts.map(d => {
                const value = d.lines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.quantity) || 0), 0)
                return (
                  <tr key={d.id} className="hover:bg-[#F7F5F2] transition-colors">
                    <td className="px-5 py-3.5 font-sans text-sm text-gray-700">{d.customer_name || 'Unnamed customer'}</td>
                    <td className="px-5 py-3.5 font-sans text-xs text-gray-400">{d.trip_name || '—'}</td>
                    <td className="px-5 py-3.5 font-sans text-xs text-gray-400">{d.lines.length} {d.lines.length === 1 ? 'line' : 'lines'}</td>
                    <td className="px-5 py-3.5 font-display italic text-[#2d6a4f]">{formatMoney(value, d.currency)}</td>
                    <td className="px-5 py-3.5 font-sans text-xs text-gray-400">saved {fmt(d.updated_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => setEditingDraft(d)} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                          <Pencil size={12} /> Open
                        </button>
                        <button onClick={() => handleDeleteDraft(d.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
        <table className="w-full min-w-[980px]">
          <thead><tr className="border-b border-gray-100">
            {['Invoice', 'Issued', 'Subtotal', 'VAT', 'Total', 'Paid', 'Balance', 'Status', ''].map(h =>
              <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(i => {
              // vd_update_order refuses an edit once anything has been paid;
              // hide the action rather than surface a server error.
              const locked = Number(i.amount_paid) !== 0 || i.status === 'void'
              return (
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
                    <div className="flex items-center gap-3 justify-end">
                      <Link href={`/invoices/${i.id}`} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                        <Printer size={12} /> View
                      </Link>
                      <button onClick={() => setPayingInvoice(i)} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                        <Wallet size={12} /> Payments
                      </button>
                      {!locked && (
                        <button onClick={() => handleEdit(i)} disabled={opening === i.id}
                          className={`inline-flex items-center gap-1.5 font-sans text-xs ${opening === i.id ? 'text-gray-300' : 'text-[#2d6a4f] hover:underline'}`}>
                          <Pencil size={12} /> {opening === i.id ? 'Opening…' : 'Edit'}
                        </button>
                      )}
                      <button onClick={() => handleSend(i.id)} disabled={sending === i.id}
                        className={`inline-flex items-center gap-1.5 font-sans text-xs ${sending === i.id ? 'text-gray-300 cursor-not-allowed' : 'text-[#2d6a4f] hover:underline'}`}>
                        <Send size={12} /> {sending === i.id ? 'Sending…' : 'Email'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No invoices found.</td></tr>}
            {loading && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading invoices…</td></tr>}
          </tbody>
        </table>
      </div>

      {(showNew || editingDraft || editingInvoice) && (
        <InvoiceModal
          customers={customers}
          suppliers={suppliers}
          draft={editingDraft}
          editing={editingInvoice}
          onClose={() => { setShowNew(false); setEditingDraft(undefined); setEditingInvoice(undefined) }}
          onDone={load}
        />
      )}

      {payingInvoice && (
        <PaymentsModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(undefined)}
          onDone={load}
        />
      )}
    </div>
  )
}
