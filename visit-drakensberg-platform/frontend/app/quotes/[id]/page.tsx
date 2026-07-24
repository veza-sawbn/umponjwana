'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, FileSignature } from 'lucide-react'
import { getQuoteById, acceptQuote, declineQuote, type Quote } from '@/lib/quotes'
import { formatMoney } from '@/lib/allocation'
import Logo from '@/components/Logo'

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

export default function QuotePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!params?.id) return
    getQuoteById(decodeURIComponent(params.id)).then(q => { setQuote(q); setLoading(false) })
  }, [params?.id])

  async function handleAccept() {
    if (!quote) return
    setBusy('accept'); setError('')
    try {
      const { invoiceId } = await acceptQuote(quote.id)
      router.push(`/invoices/${invoiceId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept this quote')
      setBusy(null)
    }
  }

  async function handleDecline() {
    if (!quote) return
    setBusy('decline'); setError('')
    try {
      await declineQuote(quote.id)
      setQuote(q => q ? { ...q, status: 'declined' } : q)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decline this quote')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center pt-24 font-sans text-sm text-gray-400">Loading quote…</div>
  }
  if (!quote) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex flex-col items-center justify-center pt-24 gap-3">
        <p className="font-sans text-sm text-gray-500">Quote not found, or you don't have access to it.</p>
        <button onClick={() => router.back()} className="font-sans text-sm text-[#2d6a4f] hover:underline">Go back</button>
      </div>
    )
  }

  const isOpen = quote.status === 'sent'
  const expired = quote.valid_until ? new Date(quote.valid_until) < new Date(new Date().toDateString()) : false

  return (
    <div className="min-h-screen bg-[#F7F5F2] pt-28 pb-16 px-4">
      <div className="max-w-[820px] mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] transition-colors mb-4">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="bg-white border border-gray-200 p-10">
          <div className="flex items-start justify-between pb-8 border-b border-gray-200">
            <div>
              <Logo className="h-6 w-auto text-[#2d6a4f]" />
              <p className="font-sans text-xs text-gray-400 mt-3 leading-relaxed">
                Visit Drakensberg<br />KwaZulu-Natal, South Africa
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-1">Quote</p>
              <h1 className="font-display italic text-3xl text-[#000000]">{quote.quote_number}</h1>
              {quote.valid_until && <p className="font-sans text-xs text-gray-400 mt-2">Valid until {fmt(quote.valid_until)}</p>}
              <p className={`font-sans text-[10px] tracking-[0.1em] uppercase inline-block px-2.5 py-1 mt-2 ${
                quote.status === 'converted' ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
                : quote.status === 'declined' || quote.status === 'expired' ? 'bg-red-50 text-red-400'
                : 'bg-[#C9A96E]/15 text-[#8B6914]'}`}>
                {quote.status}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 py-8 border-b border-gray-200">
            <div>
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Prepared For</p>
              <p className="font-sans text-sm font-medium text-gray-800">{quote.customer_name || '—'}</p>
              <p className="font-sans text-xs text-gray-500 mt-0.5">{quote.customer_email}</p>
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Trip</p>
              <p className="font-sans text-sm text-gray-800">{quote.trip_name || '—'}</p>
            </div>
          </div>

          <table className="w-full my-8">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-2.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Service</th>
                <th className="text-right py-2.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Qty</th>
                <th className="text-right py-2.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Unit Price</th>
                <th className="text-right py-2.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quote.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-3">
                    <p className="font-sans text-sm text-gray-800">{l.title}</p>
                    <p className="font-sans text-[11px] text-gray-400 capitalize">{l.category}</p>
                  </td>
                  <td className="py-3 text-right font-sans text-sm text-gray-600">{Number(l.quantity)} {l.unitLabel}{Number(l.quantity) !== 1 ? 's' : ''}</td>
                  <td className="py-3 text-right font-sans text-sm text-gray-600">{formatMoney(Number(l.unitPrice), quote.currency)}</td>
                  <td className="py-3 text-right font-sans text-sm text-gray-800">{formatMoney(Number(l.total), quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 space-y-2 font-sans text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatMoney(Number(quote.subtotal), quote.currency)}</span></div>
              {Number(quote.discount) > 0 && (
                <div className="flex justify-between text-gray-600"><span>Discount</span><span>−{formatMoney(Number(quote.discount), quote.currency)}</span></div>
              )}
              {Number(quote.service_fee) > 0 && (
                <div className="flex justify-between text-gray-600"><span>Service fee</span><span>{formatMoney(Number(quote.service_fee), quote.currency)}</span></div>
              )}
              {Number(quote.tax_amount) > 0 && (
                <div className="flex justify-between text-gray-600"><span>VAT</span><span>{formatMoney(Number(quote.tax_amount), quote.currency)}</span></div>
              )}
              <div className="flex justify-between font-medium text-base text-[#000000] border-t-2 border-gray-800 pt-2">
                <span>Total</span><span>{formatMoney(Number(quote.total), quote.currency)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <p className="mt-8 pt-6 border-t border-gray-200 font-sans text-sm text-gray-600 leading-relaxed whitespace-pre-line">{quote.notes}</p>
          )}

          {isOpen && !expired ? (
            <div className="mt-10 pt-6 border-t border-gray-200 flex items-center gap-3">
              <FileSignature size={16} className="text-[#C9A96E] shrink-0" />
              <p className="font-sans text-sm text-gray-600 flex-1">Accepting converts this quote into a payable invoice.</p>
              <button onClick={handleDecline} disabled={!!busy} className="inline-flex items-center gap-2 border border-gray-300 text-gray-500 px-5 py-2.5 font-sans text-sm hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50">
                <X size={14} /> {busy === 'decline' ? 'Declining…' : 'Decline'}
              </button>
              <button onClick={handleAccept} disabled={!!busy} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245741] transition-colors disabled:opacity-60">
                <Check size={14} /> {busy === 'accept' ? 'Accepting…' : 'Accept Quote'}
              </button>
            </div>
          ) : (
            <p className="mt-10 pt-6 border-t border-gray-200 font-sans text-sm text-gray-500">
              {quote.status === 'converted' ? 'This quote has been accepted and converted into an invoice.'
                : quote.status === 'declined' ? 'This quote was declined.'
                : 'This quote has expired.'}
            </p>
          )}
          {error && <p className="mt-3 font-sans text-xs text-red-600 text-right">{error}</p>}
        </div>
      </div>
    </div>
  )
}
