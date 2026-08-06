'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, FileSignature, Printer } from 'lucide-react'
import { getQuoteById, acceptQuote, declineQuote, getQuoteInvoiceLink, type Quote } from '@/lib/quotes'
import { getSiteContent, SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import { formatMoney } from '@/lib/allocation'
import Logo from '@/components/Logo'

type BusinessDetails = typeof SITE_CONTENT_DEFAULTS.business_details

// Printable customer quote — the same document treatment as an invoice, so a
// quote can be printed or saved as a PDF and sent on. The accept/decline
// controls are screen-only; the printed copy is a plain quotation.

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

export default function QuotePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [business, setBusiness] = useState<BusinessDetails>(SITE_CONTENT_DEFAULTS.business_details)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { getSiteContent('business_details').then(setBusiness) }, [])

  useEffect(() => {
    if (!params?.id) return
    getQuoteById(decodeURIComponent(params.id)).then(q => { setQuote(q); setLoading(false) })
  }, [params?.id])

  async function handleAccept() {
    if (!quote) return
    setBusy('accept'); setError('')
    try {
      const { invoiceId } = await acceptQuote(quote.id)
      // Hand the guest the invoice's own share link — they have no account,
      // so a plain /invoices/:id would greet them with an access error.
      const link = await getQuoteInvoiceLink(quote.id)
      router.push(link ? `/invoices/${link.invoiceId}?t=${link.shareToken}` : `/invoices/${invoiceId}`)
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
      {/* Print isolation: only the quote document is printed. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #quote-doc, #quote-doc * { visibility: visible !important; }
          #quote-doc { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>

      <div className="max-w-[820px] mx-auto">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245741] transition-colors">
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>

        <div id="quote-doc" className="bg-white border border-gray-200 p-10">
          <div className="flex items-start justify-between pb-8 border-b border-gray-200">
            <div>
              <Logo className="h-6 w-auto text-[#2d6a4f]" />
              <p className="font-sans text-xs text-gray-400 mt-3 leading-relaxed">
                {business.business_name}<br />
                {[business.address_line1, business.address_line2, business.city, business.country].filter(Boolean).join(', ') || 'KwaZulu-Natal, South Africa'}<br />
                {business.email}
                {business.phone && <><br />{business.phone}</>}
                {business.registration_number && <><br />Reg. {business.registration_number}</>}
                {business.vat_number && <><br />VAT {business.vat_number}</>}
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-1">Quotation</p>
              <h1 className="font-display italic text-3xl text-[#000000]">{quote.quote_number}</h1>
              <p className="font-sans text-xs text-gray-400 mt-2">Prepared {fmt(quote.sent_at || quote.created_at)}</p>
              {quote.valid_until && <p className="font-sans text-xs text-gray-400">Valid until {fmt(quote.valid_until)}</p>}
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
            <>
              <div className="mt-10 pt-6 border-t border-gray-200 flex items-center gap-3 print:hidden">
                <FileSignature size={16} className="text-[#C9A96E] shrink-0" />
                <p className="font-sans text-sm text-gray-600 flex-1">Accepting converts this quote into a payable invoice.</p>
                <button onClick={handleDecline} disabled={!!busy} className="inline-flex items-center gap-2 border border-gray-300 text-gray-500 px-5 py-2.5 font-sans text-sm hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50">
                  <X size={14} /> {busy === 'decline' ? 'Declining…' : 'Decline'}
                </button>
                <button onClick={handleAccept} disabled={!!busy} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245741] transition-colors disabled:opacity-60">
                  <Check size={14} /> {busy === 'accept' ? 'Accepting…' : 'Accept Quote'}
                </button>
              </div>
              {/* The printed copy can't carry buttons — say how to accept instead. */}
              <p className="hidden print:block mt-10 pt-6 border-t border-gray-200 font-sans text-sm text-gray-600 leading-relaxed">
                To accept this quote, open the link we emailed you{quote.valid_until ? ` on or before ${fmt(quote.valid_until)}` : ''}.
                Accepting converts it into a payable invoice.
              </p>
            </>
          ) : (
            <p className="mt-10 pt-6 border-t border-gray-200 font-sans text-sm text-gray-500">
              {quote.status === 'converted' ? 'This quote has been accepted and converted into an invoice.'
                : quote.status === 'declined' ? 'This quote was declined.'
                : 'This quote has expired.'}
            </p>
          )}
          {error && <p className="mt-3 font-sans text-xs text-red-600 text-right print:hidden">{error}</p>}

          {business.invoice_footer_note && (
            <p className="mt-6 font-sans text-[11px] text-gray-400 leading-relaxed whitespace-pre-line">{business.invoice_footer_note}</p>
          )}

          <p className="mt-10 pt-6 border-t border-gray-200 font-sans text-[11px] text-gray-400 leading-relaxed">
            This is a quotation, not a tax invoice — no payment is due against it. Prices are held
            {quote.valid_until ? ` until ${fmt(quote.valid_until)}` : ' for the validity period above'} and remain subject to
            availability at the time of booking. A tax invoice is issued by {business.business_name} once the quote is accepted.
          </p>
        </div>
      </div>
    </div>
  )
}
