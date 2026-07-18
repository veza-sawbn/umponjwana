'use client'

import { useEffect, useState } from 'react'
import { Receipt, FileText, ChevronDown, ChevronUp, Printer } from 'lucide-react'
import { getOrders, type MasterOrder } from '@/lib/orders'
import { getInvoiceByOrder, getReceipts, type Invoice, type Receipt as ReceiptDoc } from '@/lib/invoices'
import { getOrderPayments, type OrderPayment } from '@/lib/order-payments'
import { formatMoney } from '@/lib/allocation'

// Customer view: every trip is a single order with ONE invoice covering all
// services — never one invoice per supplier. Payments, receipts and balances
// reconcile back to the order.

const BADGE: Record<string, string> = {
  paid: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  partial: 'bg-[#C9A96E]/15 text-[#8B6914]',
  deposit: 'bg-[#C9A96E]/15 text-[#8B6914]',
  unpaid: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-400',
  refunded: 'bg-red-50 text-red-400',
  void: 'bg-red-50 text-red-400',
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function OrderCard({ order }: { order: MasterOrder }) {
  const [open, setOpen] = useState(false)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [receipts, setReceipts] = useState<ReceiptDoc[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open || loaded) return
    Promise.all([
      getInvoiceByOrder(order.id),
      getOrderPayments(order.id),
      getReceipts(order.id),
    ]).then(([inv, pay, rcp]) => {
      setInvoice(inv); setPayments(pay); setReceipts(rcp); setLoaded(true)
    })
  }, [open, loaded, order.id])

  return (
    <div className="bg-white border border-gray-200">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#F7F5F2] transition-colors text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-sans text-sm font-medium text-gray-800">{order.trip_name || order.order_number}</p>
            <span className={`font-sans text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 ${BADGE[order.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>{order.payment_status}</span>
            {order.booking_status === 'cancelled' && <span className={`font-sans text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 ${BADGE.cancelled}`}>cancelled</span>}
          </div>
          <p className="font-sans text-xs text-gray-400 mt-1">
            {order.order_number} · {fmt(order.travel_start)}{order.travel_end && order.travel_end !== order.travel_start ? ` — ${fmt(order.travel_end)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(Number(order.total_value), order.currency)}</p>
            {Number(order.outstanding_balance) > 0 && order.booking_status !== 'cancelled' && (
              <p className="font-sans text-[11px] text-[#8B6914]">Outstanding {formatMoney(Number(order.outstanding_balance), order.currency)}</p>
            )}
            {Number(order.refund_balance) > 0 && (
              <p className="font-sans text-[11px] text-red-400">Refund due {formatMoney(Number(order.refund_balance), order.currency)}</p>
            )}
          </div>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-6">
          {/* Invoice */}
          {invoice ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display italic text-lg flex items-center gap-2"><FileText size={15} className="text-[#2d6a4f]" />Invoice {invoice.invoice_number}</h3>
                <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 font-sans text-xs text-gray-500 hover:text-[#2d6a4f]"><Printer size={12} /> Print</button>
              </div>
              <div className="border border-gray-100">
                {invoice.lines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-sans text-sm text-gray-700">{l.title}</p>
                      <p className="font-sans text-[11px] text-gray-400 capitalize">{l.category} · {Number(l.quantity)} {l.unitLabel}{Number(l.quantity) !== 1 ? 's' : ''} × {formatMoney(Number(l.unitPrice), invoice.currency)}</p>
                    </div>
                    <span className="font-sans text-sm">{formatMoney(Number(l.total), invoice.currency)}</span>
                  </div>
                ))}
                <div className="px-4 py-3 bg-[#F7F5F2] space-y-1 font-sans text-sm text-gray-600">
                  <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(Number(invoice.subtotal), invoice.currency)}</span></div>
                  <div className="flex justify-between"><span>Service fee</span><span>{formatMoney(Number(invoice.service_fee), invoice.currency)}</span></div>
                  <div className="flex justify-between"><span>VAT</span><span>{formatMoney(Number(invoice.tax_amount), invoice.currency)}</span></div>
                  <div className="flex justify-between font-medium text-[#000000] pt-1 border-t border-gray-200"><span>Total</span><span>{formatMoney(Number(invoice.total), invoice.currency)}</span></div>
                  <div className="flex justify-between text-[#2d6a4f]"><span>Paid</span><span>{formatMoney(Number(invoice.amount_paid), invoice.currency)}</span></div>
                  <div className="flex justify-between"><span>Balance</span><span>{formatMoney(Number(invoice.balance), invoice.currency)}</span></div>
                </div>
              </div>
            </div>
          ) : loaded ? (
            <p className="font-sans text-sm text-gray-400">No invoice available for this order.</p>
          ) : (
            <p className="font-sans text-sm text-gray-400">Loading…</p>
          )}

          {/* Payments & receipts */}
          {payments.length > 0 && (
            <div>
              <h3 className="font-display italic text-lg mb-3 flex items-center gap-2"><Receipt size={15} className="text-[#2d6a4f]" />Payments & Receipts</h3>
              <div className="border border-gray-100 divide-y divide-gray-100">
                {payments.map(p => {
                  const receipt = receipts.find(r => r.payment_id === p.id)
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="font-sans text-sm text-gray-700 capitalize">{p.type.replace('_', ' ')} · {p.method.replace('_', ' ')}</p>
                        <p className="font-sans text-[11px] text-gray-400">{fmt(p.created_at)}{receipt ? ` · Receipt ${receipt.receipt_number}` : ''}</p>
                      </div>
                      <span className={`font-sans text-sm ${p.direction === 'out' ? 'text-red-400' : 'text-[#2d6a4f]'}`}>
                        {p.direction === 'out' ? '−' : ''}{formatMoney(Number(p.amount), p.currency)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<MasterOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOrders().then(o => { setOrders(o); setLoading(false) })
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">Orders & Invoices</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">Each trip is a single order with one invoice covering every service — accommodation, activities, transfers, permits and extras.</p>
      </div>
      <div className="space-y-3">
        {orders.map(o => <OrderCard key={o.id} order={o} />)}
        {!loading && orders.length === 0 && (
          <div className="bg-white border border-gray-200 px-6 py-14 text-center">
            <p className="font-sans text-sm text-gray-400">No orders yet. Complete a booking and your order, invoice and receipts will appear here.</p>
          </div>
        )}
        {loading && <p className="font-sans text-sm text-gray-400 py-8 text-center">Loading your orders…</p>}
      </div>
    </div>
  )
}
