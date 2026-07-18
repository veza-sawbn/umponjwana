import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

// Emails a payment receipt to the customer. Called automatically after a
// payment is recorded (checkout, admin console, package booking).
//
// Delivery: Resend HTTP API when RESEND_API_KEY is configured
// (RECEIPTS_FROM_EMAIL overrides the sender). Without a key the email is
// skipped gracefully — the in-app notification below still fires, so the
// customer always sees the receipt in their account.
//
// Data access runs under the CALLER's Supabase session, so RLS applies:
// a customer can only trigger receipts for their own orders, staff for any.

function money(amount: number, currency: string) {
  const symbol = currency === 'ZAR' ? 'R ' : `${currency} `
  return `${symbol}${Math.abs(amount).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function receiptHtml(o: {
  customerName: string
  receiptNumber: string
  invoiceNumber: string
  orderNumber: string
  tripName: string
  amount: number
  isRefund: boolean
  method: string
  currency: string
  date: string
  totalPaid: number
  balance: number
  invoiceUrl: string
}) {
  const rows = [
    ['Receipt', o.receiptNumber],
    ['Invoice', o.invoiceNumber],
    ['Order', o.orderNumber],
    ['Trip', o.tripName || '—'],
    ['Date', fmtDate(o.date)],
    ['Payment method', o.method.replace(/_/g, ' ')],
    ['Total paid to date', money(o.totalPaid, o.currency)],
    ['Balance due', money(o.balance, o.currency)],
  ].map(([k, v]) =>
    `<tr><td style="padding:6px 0;color:#8a8a8a;font-size:13px;">${k}</td>` +
    `<td style="padding:6px 0;text-align:right;font-size:13px;color:#1a1a1a;">${v}</td></tr>`
  ).join('')

  return `<!doctype html><html><body style="margin:0;background:#F7F5F2;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#000;color:#fff;padding:28px 32px;">
      <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9A96E;">Visit Drakensberg</p>
      <h1 style="margin:8px 0 0;font-style:italic;font-weight:normal;font-size:26px;">
        ${o.isRefund ? 'Refund processed' : 'Payment received'}
      </h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e5e5;border-top:none;padding:28px 32px;">
      <p style="font-size:14px;color:#444;margin:0 0 4px;">Dear ${o.customerName || 'traveller'},</p>
      <p style="font-size:14px;color:#444;margin:0 0 20px;">
        ${o.isRefund
          ? `We have processed a refund of <strong>${money(o.amount, o.currency)}</strong> against your booking.`
          : `Thank you — we have received your payment of <strong>${money(o.amount, o.currency)}</strong>.`}
      </p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;">${rows}</table>
      <p style="margin:24px 0 0;">
        <a href="${o.invoiceUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;font-family:Arial,sans-serif;">View your invoice</a>
      </p>
      <p style="font-size:11px;color:#aaa;margin:24px 0 0;line-height:1.6;">
        This receipt covers your single trip invoice with Visit Drakensberg — all accommodation,
        activities, transfers and extras appear on one document. Keep this email for your records.
      </p>
    </div>
  </div></body></html>`
}

export async function POST(req: Request) {
  let body: { orderId?: string; paymentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // RLS scopes these reads to the caller (own order, or staff).
  const { data: order } = await supabase
    .from('vd_orders').select('*').eq('id', body.orderId).maybeSingle()
  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })

  let receiptQuery = supabase.from('vd_receipts').select('*').eq('order_id', body.orderId)
  if (body.paymentId) receiptQuery = receiptQuery.eq('payment_id', body.paymentId)
  const { data: receipts } = await receiptQuery.order('created_at', { ascending: false }).limit(1)
  const receipt = receipts?.[0]
  if (!receipt) return NextResponse.json({ error: 'no receipt for this order' }, { status: 404 })

  const { data: invoice } = await supabase
    .from('vd_invoices').select('*').eq('order_id', body.orderId).order('issued_at').limit(1).maybeSingle()

  const email = order.customer_email as string
  const isRefund = Number(receipt.amount) < 0
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const invoiceUrl = `${origin}/invoices/${invoice?.id ?? order.id}`

  let sent = false
  let sendError: string | null = null
  const apiKey = process.env.RESEND_API_KEY

  if (apiKey && email) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RECEIPTS_FROM_EMAIL || 'Visit Drakensberg <receipts@visitdrakensberg.co.za>',
          to: [email],
          subject: isRefund
            ? `Refund receipt ${receipt.receipt_number} — ${order.order_number}`
            : `Payment receipt ${receipt.receipt_number} — ${order.order_number}`,
          html: receiptHtml({
            customerName: order.customer_name,
            receiptNumber: receipt.receipt_number,
            invoiceNumber: invoice?.invoice_number ?? '—',
            orderNumber: order.order_number,
            tripName: order.trip_name,
            amount: Number(receipt.amount),
            isRefund,
            method: receipt.method,
            currency: receipt.currency,
            date: receipt.created_at,
            totalPaid: Number(order.amount_paid),
            balance: Number(order.outstanding_balance),
            invoiceUrl,
          }),
        }),
      })
      sent = res.ok
      if (!res.ok) sendError = `resend ${res.status}`
    } catch (e) {
      sendError = e instanceof Error ? e.message : 'send failed'
    }
  } else if (!apiKey) {
    sendError = 'RESEND_API_KEY not configured'
  } else {
    sendError = 'order has no customer email'
  }

  // In-app notification for account holders — fires regardless of email
  // delivery, so the receipt is always surfaced somewhere.
  if (order.user_id) {
    await supabase.from('vd_notifications').insert({
      user_id: order.user_id,
      type: 'payment',
      title: isRefund
        ? `Refund receipt ${receipt.receipt_number}`
        : `Payment receipt ${receipt.receipt_number}`,
      body: `${isRefund ? 'Refund' : 'Payment'} of ${money(Number(receipt.amount), receipt.currency)} on order ${order.order_number}.${Number(order.outstanding_balance) > 0 ? ` Balance due: ${money(Number(order.outstanding_balance), receipt.currency)}.` : ' Your invoice is fully paid.'}`,
      link: `/invoices/${invoice?.id ?? order.id}`,
    })
  }

  return NextResponse.json({ sent, error: sendError })
}
