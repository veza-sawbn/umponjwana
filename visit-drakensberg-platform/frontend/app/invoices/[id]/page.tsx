'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft } from 'lucide-react'
import { getInvoiceById, getReceipts, type Invoice, type Receipt } from '@/lib/invoices'
import { getOrderById, type MasterOrder } from '@/lib/orders'
import { formatMoney } from '@/lib/allocation'
import Logo from '@/components/Logo'

// Printable customer invoice. One invoice per Master Order — every purchased
// service on a single document, no supplier payout information. Access is
// governed by RLS: customers open their own invoices, staff open any.

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

export default function PrintableInvoicePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [order, setOrder] = useState<MasterOrder | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params?.id) return
    getInvoiceById(decodeURIComponent(params.id)).then(async inv => {
      setInvoice(inv)
      if (inv) {
        const [o, r] = await Promise.all([getOrderById(inv.order_id), getReceipts(inv.order_id)])
        setOrder(o); setReceipts(r)
      }
      setLoading(false)
    })
  }, [params?.id])

  if (loading) {
    return <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center pt-24 font-sans text-sm text-gray-400">Loading invoice…</div>
  }
  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex flex-col items-center justify-center pt-24 gap-3">
        <p className="font-sans text-sm text-gray-500">Invoice not found, or you don't have access to it.</p>
        <button onClick={() => router.back()} className="font-sans text-sm text-[#2d6a4f] hover:underline">Go back</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] pt-28 pb-16 px-4">
      {/* Print isolation: only the invoice document is printed. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-doc, #invoice-doc * { visibility: visible !important; }
          #invoice-doc { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border: none !important; }
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

        <div id="invoice-doc" className="bg-white border border-gray-200 p-10">
          {/* Header */}
          <div className="flex items-start justify-between pb-8 border-b border-gray-200">
            <div>
              <Logo className="h-6 w-auto text-[#2d6a4f]" />
              <p className="font-sans text-xs text-gray-400 mt-3 leading-relaxed">
                Visit Drakensberg<br />
                KwaZulu-Natal, South Africa<br />
                bookings@visitdrakensberg.co.za
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-1">
                {invoice.status === 'void' ? 'Void Invoice' : 'Tax Invoice'}
              </p>
              <h1 className="font-display italic text-3xl text-[#000000]">{invoice.invoice_number}</h1>
              <p className="font-sans text-xs text-gray-400 mt-2">Issued {fmt(invoice.issued_at)}</p>
              <p className={`font-sans text-[10px] tracking-[0.1em] uppercase inline-block px-2.5 py-1 mt-2 ${
                invoice.status === 'paid' ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
                : invoice.status === 'void' || invoice.status === 'refunded' ? 'bg-red-50 text-red-400'
                : 'bg-[#C9A96E]/15 text-[#8B6914]'}`}>
                {invoice.status}
              </p>
            </div>
          </div>

          {/* Bill to / trip */}
          <div className="grid grid-cols-2 gap-8 py-8 border-b border-gray-200">
            <div>
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Billed To</p>
              <p className="font-sans text-sm font-medium text-gray-800">{order?.customer_name || '—'}</p>
              <p className="font-sans text-xs text-gray-500 mt-0.5">{order?.customer_email}</p>
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Trip</p>
              <p className="font-sans text-sm text-gray-800">{order?.trip_name || '—'}</p>
              <p className="font-sans text-xs text-gray-500 mt-0.5">
                Order {order?.order_number}{order?.travel_start ? ` · ${fmt(order.travel_start)}${order.travel_end && order.travel_end !== order.travel_start ? ` — ${fmt(order.travel_end)}` : ''}` : ''}
              </p>
            </div>
          </div>

          {/* Lines */}
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
              {invoice.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-3">
                    <p className="font-sans text-sm text-gray-800">{l.title}</p>
                    <p className="font-sans text-[11px] text-gray-400 capitalize">{l.category}</p>
                  </td>
                  <td className="py-3 text-right font-sans text-sm text-gray-600">{Number(l.quantity)} {l.unitLabel}{Number(l.quantity) !== 1 ? 's' : ''}</td>
                  <td className="py-3 text-right font-sans text-sm text-gray-600">{formatMoney(Number(l.unitPrice), invoice.currency)}</td>
                  <td className="py-3 text-right font-sans text-sm text-gray-800">{formatMoney(Number(l.total), invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 font-sans text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatMoney(Number(invoice.subtotal), invoice.currency)}</span></div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-gray-600"><span>Discount</span><span>−{formatMoney(Number(invoice.discount), invoice.currency)}</span></div>
              )}
              <div className="flex justify-between text-gray-600"><span>Service fee</span><span>{formatMoney(Number(invoice.service_fee), invoice.currency)}</span></div>
              <div className="flex justify-between text-gray-600"><span>VAT</span><span>{formatMoney(Number(invoice.tax_amount), invoice.currency)}</span></div>
              <div className="flex justify-between font-medium text-base text-[#000000] border-t-2 border-gray-800 pt-2">
                <span>Total</span><span>{formatMoney(Number(invoice.total), invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-[#2d6a4f]"><span>Amount paid</span><span>{formatMoney(Number(invoice.amount_paid), invoice.currency)}</span></div>
              <div className="flex justify-between font-medium text-gray-800"><span>Balance due</span><span>{formatMoney(Number(invoice.balance), invoice.currency)}</span></div>
            </div>
          </div>

          {/* Receipts */}
          {receipts.length > 0 && (
            <div className="mt-10 pt-6 border-t border-gray-200">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Payments Received</p>
              {receipts.map(r => (
                <div key={r.id} className="flex justify-between font-sans text-xs text-gray-500 py-1">
                  <span>{r.receipt_number} · {fmt(r.created_at)} · {r.method}</span>
                  <span>{Number(r.amount) < 0 ? `−${formatMoney(Math.abs(Number(r.amount)), r.currency)} (refund)` : formatMoney(Number(r.amount), r.currency)}</span>
                </div>
              ))}
            </div>
          )}

          <p className="mt-10 pt-6 border-t border-gray-200 font-sans text-[11px] text-gray-400 leading-relaxed">
            This invoice covers all services in your trip, arranged through Visit Drakensberg.
            Payments reconcile against order {order?.order_number}. Thank you for exploring the Drakensberg with us.
          </p>
        </div>
      </div>
    </div>
  )
}
