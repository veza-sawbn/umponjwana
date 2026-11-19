'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Copy, Search } from 'lucide-react'
import { formatMoney } from '@/lib/allocation'
import { fuzzyFilter } from '@/lib/fuzzy'
import { getOrderLines } from '@/lib/orders'
import { draftLineFromOrderLine } from '@/lib/invoice-items'
import type { DraftLine } from '@/lib/invoice-drafts'
import type { InvoiceWithOrder } from '@/lib/invoices'

// "Copy lines from a past invoice": for repeat groups and trips billed the
// same way each time. Copies the order's lines (with their discounts and
// suppliers) into the form; the past invoice itself is untouched.

const SHOWN = 8

export default function CopyFromInvoice({ invoices, excludeInvoiceId, onCopy }: {
  invoices: InvoiceWithOrder[]
  /** The invoice being edited, which isn't offered as its own source. */
  excludeInvoiceId?: string
  onCopy: (lines: DraftLine[], invoice: InvoiceWithOrder) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loadingId, setLoadingId] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const matches = useMemo(() => {
    const pool = invoices
      .filter(i => i.id !== excludeInvoiceId)
      .sort((a, b) => (b.issued_at ?? '').localeCompare(a.issued_at ?? ''))
    return fuzzyFilter(pool, query, i => `${i.invoice_number} ${i.customer_name ?? ''} ${i.trip_name ?? ''}`).slice(0, SHOWN)
  }, [invoices, excludeInvoiceId, query])

  async function copy(inv: InvoiceWithOrder) {
    setLoadingId(inv.id)
    try {
      const lines = await getOrderLines(inv.order_id)
      if (lines.length === 0) { toast.error(`${inv.invoice_number} has no lines to copy.`); return }
      onCopy(lines.map(draftLineFromOrderLine), inv)
      setOpen(false); setQuery('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that invoice')
    } finally { setLoadingId('') }
  }

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 border border-gray-200 bg-white px-3 py-2.5 md:py-2 font-sans text-sm md:text-xs text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] whitespace-nowrap">
        <Copy size={13} /> Copy from invoice
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 w-[min(22rem,calc(100vw-2rem))] bg-white border border-gray-200 shadow-lg">
          <div className="flex items-center border-b border-gray-100">
            <Search size={14} className="ml-3 text-gray-400" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Invoice number, customer or trip"
              className="flex-1 px-2 py-2.5 font-sans text-base sm:text-sm focus:outline-none" />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {matches.map(inv => (
              <button key={inv.id} type="button" onClick={() => copy(inv)} disabled={!!loadingId}
                className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-[#F7F5F2] disabled:opacity-60">
                <span className="flex-1 min-w-0">
                  <span className="block font-sans text-sm text-gray-800 truncate">
                    {inv.invoice_number} · {inv.customer_name || 'Unnamed customer'}
                  </span>
                  <span className="block font-sans text-[11px] text-gray-400 truncate">
                    {inv.trip_name || 'No trip name'}{inv.status === 'void' ? ' · void' : ''}
                  </span>
                </span>
                <span className="shrink-0 font-sans text-xs text-gray-600">
                  {loadingId === inv.id ? 'Copying…' : formatMoney(Number(inv.total), inv.currency)}
                </span>
              </button>
            ))}
            {matches.length === 0 && <p className="px-3 py-3 font-sans text-sm text-gray-400">No invoices match.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
