'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Search, RefreshCw, Plus, Send, Trash2, X, FileSignature, Eye } from 'lucide-react'
import { getQuotes, createQuote, sendQuote, deleteQuote, type Quote, type QuoteLine } from '@/lib/quotes'
import { getFinanceSettings } from '@/lib/invoices'
import { formatMoney } from '@/lib/allocation'
import { useQuickParam } from '@/lib/admin-quick-param'
import { supabase } from '@/lib/auth'

// Quote module: build a sales quote for a prospective or existing customer,
// send it, and let them accept it themselves — acceptance converts it into
// a real Master Order + Invoice (vd_accept_quote), payable online immediately.

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  sent: 'bg-[#C9A96E]/15 text-[#8B6914]',
  converted: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  declined: 'bg-red-50 text-red-400',
  expired: 'bg-red-50 text-red-400',
}

const CATEGORIES = ['accommodation', 'activity', 'tour', 'hike', 'event', 'shuttle', 'equipment', 'permit', 'levy', 'donation', 'meal', 'package', 'extra']

type Person = { id: string; full_name: string | null; email: string | null; role: string }

type DraftLine = { title: string; category: string; quantity: string; unitLabel: string; unitPrice: string }
const emptyLine = (): DraftLine => ({ title: '', category: 'extra', quantity: '1', unitLabel: 'unit', unitPrice: '' })

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function NewQuoteModal({ customers, onClose, onCreated }: { customers: Person[]; onClose: () => void; onCreated: () => void }) {
  const [customerMode, setCustomerMode] = useState<'registered' | 'guest'>('guest')
  const [customerId, setCustomerId] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [tripName, setTripName] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [rates, setRates] = useState({ serviceFeeRate: 0.12, vatRate: 0.15, currency: 'ZAR' })
  const [feeOverride, setFeeOverride] = useState('')
  const [taxOverride, setTaxOverride] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { getFinanceSettings().then(setRates) }, [])

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.quantity) || 0), 0)
  const serviceFee = feeOverride !== '' ? (parseFloat(feeOverride) || 0) : 0
  const tax = taxOverride !== '' ? (parseFloat(taxOverride) || 0) : Math.round(subtotal * rates.vatRate)
  const total = subtotal + serviceFee + tax

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  async function submit() {
    const customer = customers.find(c => c.id === customerId)
    const isGuest = customerMode === 'guest'
    if (isGuest) {
      if (!guestName.trim()) { toast.error('Enter the customer name.'); return }
      if (!guestEmail.trim() || !guestEmail.includes('@')) { toast.error('Enter a valid customer email.'); return }
    } else if (!customer) {
      toast.error('Select a customer.'); return
    }
    const validLines: QuoteLine[] = lines
      .filter(l => l.title.trim() && parseFloat(l.unitPrice) > 0)
      .map(l => ({
        title: l.title.trim(), category: l.category,
        quantity: parseFloat(l.quantity) || 1, unitLabel: l.unitLabel || 'unit',
        unitPrice: parseFloat(l.unitPrice) || 0,
        total: (parseFloat(l.unitPrice) || 0) * (parseFloat(l.quantity) || 1),
      }))
    if (validLines.length === 0) { toast.error('Add at least one line with a title and price.'); return }
    setBusy(true)
    try {
      await createQuote({
        customerName: isGuest ? guestName.trim() : (customer!.full_name || customer!.email || ''),
        customerEmail: isGuest ? guestEmail.trim() : (customer!.email || ''),
        customerPhone: isGuest ? guestPhone.trim() : '',
        tripName: tripName.trim(),
        currency: rates.currency,
        discount: 0,
        serviceFee, taxAmount: tax,
        notes: notes.trim(),
        validUntil: validUntil || null,
        lines: validLines,
      }, isGuest ? null : customer!.id)
      toast.success('Quote created as a draft.')
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Quote creation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    // Full-screen sheet on a phone, centred dialog from sm up.
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Quotes</p>
            <h2 className="font-display italic text-xl sm:text-2xl">New Quote</h2>
            <p className="hidden sm:block font-sans text-xs text-gray-400 mt-1">Saved as a draft — send it once you're happy, and the customer can accept it themselves.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5">
        <div className="grid grid-cols-2 sm:flex sm:w-fit border border-gray-200 bg-white overflow-hidden mb-4">
          {([['guest', 'Prospect / guest'], ['registered', 'Registered customer']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setCustomerMode(id)}
              className={`px-4 py-2.5 font-sans text-xs transition-colors border-r border-gray-100 last:border-0 ${customerMode === id ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {customerMode === 'registered' ? (
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer (registered account)</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-200 bg-white px-3 py-2.5 font-sans text-base sm:text-sm focus:outline-none">
                <option value="">Select a customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email} {c.email ? `(${c.email})` : ''}</option>)}
              </select>
            </div>
          ) : (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer Name</label>
                <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-base sm:text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer Email</label>
                <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="name@example.com" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-base sm:text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Customer Phone (optional)</label>
                <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+27 82 000 0000" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-base sm:text-sm focus:outline-none" />
              </div>
            </div>
          )}
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Trip Name</label>
            <input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="e.g. Champagne Valley weekend" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-base sm:text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Valid Until</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full border border-gray-200 px-3 py-2.5 font-sans text-base sm:text-sm focus:outline-none" />
          </div>
        </div>

        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Line Items</p>
        <div className="space-y-2 mb-3">
          {lines.map((l, i) => (
            // Six columns on a phone, the original twelve from md up.
            <div key={i} className="grid grid-cols-6 md:grid-cols-12 gap-2 items-center">
              <input value={l.title} onChange={e => setLine(i, { title: e.target.value })} placeholder="Service description" className="col-span-6 md:col-span-5 border border-gray-200 px-3 py-2.5 md:py-2 font-sans text-base sm:text-sm focus:outline-none" />
              <select value={l.category} onChange={e => setLine(i, { category: e.target.value })} className="col-span-6 md:col-span-3 border border-gray-200 bg-white px-2 py-2.5 md:py-2 font-sans text-sm md:text-xs capitalize focus:outline-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} inputMode="decimal" placeholder="Qty" className="col-span-2 md:col-span-1 border border-gray-200 px-2 py-2.5 md:py-2 font-sans text-base sm:text-sm text-right focus:outline-none" />
              <input value={l.unitPrice} onChange={e => setLine(i, { unitPrice: e.target.value })} inputMode="decimal" placeholder="Unit R" className="col-span-3 md:col-span-2 border border-gray-200 px-2 py-2.5 md:py-2 font-sans text-base sm:text-sm text-right focus:outline-none" />
              <button onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)} aria-label="Remove line" className="col-span-1 py-2 text-gray-300 hover:text-red-400 flex justify-center"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setLines(ls => [...ls, emptyLine()])} className="inline-flex items-center gap-1.5 py-2 font-sans text-sm md:text-xs text-[#2d6a4f] hover:underline mb-6">
          <Plus size={14} /> Add line
        </button>

        <div className="mb-4">
          <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Notes (shown on the quote)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Terms, inclusions, anything the customer should know…" className="w-full border border-gray-200 px-3 py-2 font-sans text-base sm:text-sm focus:outline-none resize-none" />
        </div>

        <div className="border border-gray-200 p-3 mb-2 flex items-end gap-3">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Service fee</label>
            <input value={feeOverride} onChange={e => setFeeOverride(e.target.value)} inputMode="decimal" placeholder="0" className="w-24 border border-gray-200 px-2 py-2 font-sans text-base sm:text-sm text-right focus:outline-none" />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">VAT</label>
            <input value={taxOverride} onChange={e => setTaxOverride(e.target.value)} inputMode="decimal" placeholder={String(tax)} className="w-24 border border-gray-200 px-2 py-2 font-sans text-base sm:text-sm text-right focus:outline-none" />
          </div>
        </div>
        </div>

        <div
          className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="sm:text-right">
            <p className="font-sans text-xs text-gray-500">Subtotal {formatMoney(subtotal)} · Fee {formatMoney(serviceFee)} · VAT {formatMoney(tax)}</p>
            <p className="font-display italic text-xl sm:text-2xl text-[#2d6a4f]">Total {formatMoney(total)}</p>
          </div>
          <button onClick={submit} disabled={busy}
            className={`w-full sm:w-auto px-6 py-3 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
            {busy ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function load() {
    setLoading(true)
    const [qs, prof] = await Promise.all([
      getQuotes(),
      (async () => {
        try {
          const { data } = await supabase.from('profiles').select('id, full_name, email, role').neq('role', 'supplier').order('full_name')
          return Array.isArray(data) ? data as Person[] : []
        } catch { return [] }
      })(),
    ])
    setQuotes(qs); setPeople(prof)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Landed here from the mobile quick-action sheet.
  useQuickParam('new', v => { if (v === 'quote') setShowNew(true) })
  useQuickParam('filter', v => setFilter(v))

  const filtered = useMemo(() => quotes.filter(q => {
    const hay = `${q.quote_number} ${q.customer_name} ${q.customer_email}`.toLowerCase()
    return hay.includes(search.toLowerCase()) && (filter === 'all' || q.status === filter)
  }), [quotes, search, filter])

  async function handleSend(id: string) {
    try {
      const { sent, error } = await sendQuote(id)
      // The quote is open for the customer either way — but don't claim it was
      // emailed when it wasn't, or the email failure goes unnoticed.
      if (sent) toast.success('Quote sent.')
      else toast.error(`Quote opened for the customer, but the email failed: ${error || 'unknown error'}`, { duration: 8000 })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send quote')
    }
  }

  async function handleDelete(id: string) {
    await deleteQuote(id)
    load()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Sales</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Quotes</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Build a quote, send it, and the customer accepts it themselves — turning it straight into a payable invoice.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={load} aria-label="Refresh" className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowNew(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-3 sm:py-2 font-sans text-sm hover:bg-[#245741] transition-colors">
            <Plus size={14} /> New Quote
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 sm:py-2 flex-1 sm:min-w-[220px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quote number or customer…" className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" />
        </div>
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <div className="flex w-max border border-gray-200 bg-white">
            {['all', 'draft', 'sent', 'converted', 'declined', 'expired'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2.5 sm:py-2 font-sans text-xs capitalize whitespace-nowrap transition-colors border-r border-gray-100 last:border-0 ${filter === f ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phones: a card per quote. */}
      <div className="md:hidden bg-white border border-gray-200 divide-y divide-gray-100">
        {filtered.map(q => (
          <div key={q.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-gray-500">{q.quote_number}</p>
                <p className="font-sans text-sm text-gray-700 truncate mt-0.5">{q.customer_name}</p>
                <p className="font-sans text-xs text-gray-400 truncate">{q.trip_name || q.customer_email}</p>
              </div>
              <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 shrink-0 ${STATUS_BADGE[q.status] ?? STATUS_BADGE.draft}`}>{q.status}</span>
            </div>

            <div className="flex items-end justify-between gap-3 mt-3">
              <p className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(Number(q.total), q.currency)}</p>
              <p className="font-sans text-xs text-gray-400">Valid until {fmt(q.valid_until)}</p>
            </div>

            <div className="flex gap-2 mt-3">
              <Link href={`/quotes/${q.id}`} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-gray-200 py-2.5 font-sans text-sm text-[#2d6a4f]">
                <Eye size={13} /> View
              </Link>
              {q.status === 'draft' && (
                <button onClick={() => handleSend(q.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-gray-200 py-2.5 font-sans text-sm text-[#C9A96E]">
                  <Send size={13} /> Send
                </button>
              )}
              {(q.status === 'draft' || q.status === 'declined' || q.status === 'expired') && (
                <button onClick={() => handleDelete(q.id)} aria-label="Delete quote" className="px-4 py-2.5 border border-gray-200 text-gray-300 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">No quotes found.</p>}
        {loading && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">Loading quotes…</p>}
      </div>

      <div className="hidden md:block bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead><tr className="border-b border-gray-100">
            {['Quote', 'Customer', 'Trip', 'Total', 'Status', 'Valid Until', ''].map(h =>
              <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(q => (
              <tr key={q.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4 font-mono text-xs text-gray-500">{q.quote_number}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-700">{q.customer_name}<br /><span className="text-xs text-gray-400">{q.customer_email}</span></td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{q.trip_name || '—'}</td>
                <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(Number(q.total), q.currency)}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_BADGE[q.status] ?? STATUS_BADGE.draft}`}>{q.status}</span>
                </td>
                <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(q.valid_until)}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Link href={`/quotes/${q.id}`} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                      <Eye size={12} /> View
                    </Link>
                    {q.status === 'draft' && (
                      <button onClick={() => handleSend(q.id)} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#C9A96E] hover:underline">
                        <Send size={12} /> Send
                      </button>
                    )}
                    {(q.status === 'draft' || q.status === 'declined' || q.status === 'expired') && (
                      <button onClick={() => handleDelete(q.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No quotes found.</td></tr>}
            {loading && <tr><td colSpan={7} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading quotes…</td></tr>}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewQuoteModal customers={people} onClose={() => setShowNew(false)} onCreated={load} />
      )}
      {!loading && quotes.length === 0 && (
        <p className="mt-4 font-sans text-xs text-gray-400 flex items-center gap-1.5"><FileSignature size={12} /> No quotes yet — create your first one above.</p>
      )}
    </div>
  )
}
