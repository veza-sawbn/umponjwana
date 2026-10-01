import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMail } from './mailer'
import { formatMoney as money } from './allocation'
import { emailShell, ctaButton, detailTable, esc, finePrint } from './email-layout'

// SERVER ONLY — the receipt builder, extracted from app/api/receipts/send so
// callers that already have a database client can use it WITHOUT an HTTP hop.
//
// WHY THIS FILE EXISTS (audit finding M8)
//   The iKhokha webhook used to post to /api/receipts/send carrying
//   SUPABASE_SERVICE_ROLE_KEY as a bearer token — the one credential that
//   bypasses RLS entirely — over the network, on every confirmed payment, to
//   an origin it derived as `NEXT_PUBLIC_SITE_URL || new URL(req.url).origin`.
//   That fallback read the host from the INBOUND request on an endpoint anyone
//   can POST to, so with the env var unset a spoofed host sent the key to a
//   server of the caller's choosing.
//
//   The 20260913 pass pinned the destination. This removes the hop: the
//   webhook now calls sendOrderReceipt() directly with its own admin client,
//   so there is no request, no bearer token, and no origin to get wrong.
//
//   Same move lib/notify-server.ts made, for the same reason, and the route
//   keeps working for the browser callers that still need it.

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
  origin: string
}) {
  return emailShell({
    origin: o.origin,
    eyebrow: `Receipt ${o.receiptNumber}`,
    heading: o.isRefund ? 'Refund processed' : 'Payment received',
    preheader: o.isRefund
      ? `Refund of ${money(o.amount, o.currency)} processed against your booking.`
      : `Payment of ${money(o.amount, o.currency)} received — thank you.`,
    bodyHtml: `
      <p style="margin:0 0 4px;">Dear ${esc(o.customerName || 'traveller')},</p>
      <p style="margin:0 0 20px;">
        ${o.isRefund
          ? `We have processed a refund of <strong>${esc(money(o.amount, o.currency))}</strong> against your booking.`
          : `Thank you — we have received your payment of <strong>${esc(money(o.amount, o.currency))}</strong>.`}
      </p>
      ${detailTable([
        ['Receipt', o.receiptNumber],
        ['Invoice', o.invoiceNumber],
        ['Order', o.orderNumber],
        ['Trip', o.tripName || '—'],
        ['Date', fmtDate(o.date)],
        ['Payment method', o.method.replace(/_/g, ' ')],
        ['Total paid to date', money(o.totalPaid, o.currency)],
      ], ['Balance due', money(o.balance, o.currency)])}
      ${ctaButton(o.invoiceUrl, 'View your invoice')}
      ${finePrint(`This receipt covers your single trip invoice with Visit Drakensberg — all accommodation,
        activities, transfers and extras appear on one document. Keep this email for your records.`)}`,
  })
}

export type ReceiptResult = { sent: boolean; error: string | null; status: number }

/**
 * Email the receipt for a payment, and record the in-app notification.
 *
 * `client` decides what is visible: pass an RLS-scoped session client for a
 * browser caller (so a customer can only trigger receipts for their own
 * orders), or the admin client for a server-to-server caller that has already
 * done its own access check — which, for the iKhokha webhook, is iKhokha's own
 * confirmation that the payment cleared.
 *
 * Never throws. A receipt that cannot be delivered must not roll back the
 * payment it is announcing.
 */
export async function sendOrderReceipt(
  client: SupabaseClient,
  input: { orderId: string; paymentId?: string; origin: string },
): Promise<ReceiptResult> {
  const { data: order } = await client
    .from('vd_orders').select('*').eq('id', input.orderId).maybeSingle()
  if (!order) return { sent: false, error: 'order not found', status: 404 }

  let receiptQuery = client.from('vd_receipts').select('*').eq('order_id', input.orderId)
  if (input.paymentId) receiptQuery = receiptQuery.eq('payment_id', input.paymentId)
  const { data: receipts } = await receiptQuery.order('created_at', { ascending: false }).limit(1)
  const receipt = receipts?.[0]
  if (!receipt) return { sent: false, error: 'no receipt for this order', status: 404 }

  const { data: invoice } = await client
    .from('vd_invoices').select('*').eq('order_id', input.orderId).order('issued_at').limit(1).maybeSingle()

  const email = order.customer_email as string
  const isRefund = Number(receipt.amount) < 0
  // The invoice's own address, which opens without a session — the customer
  // we're thanking for a payment is usually the one who never had an account
  // to sign in with.
  const invoiceUrl = `${input.origin}/invoices/${invoice?.id ?? order.id}`

  let sent = false
  let sendError: string | null = null

  if (email) {
    const result = await sendMail({
      to: email,
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
        origin: input.origin,
      }),
    })
    sent = result.sent
    sendError = result.error
  } else {
    sendError = 'order has no customer email'
  }

  // In-app only, on purpose: this function has ALREADY emailed the customer
  // the receipt above. Do NOT convert this to notifyServer() — it would send a
  // second, near-identical email. The row is the fallback for when SMTP is
  // down, not a missing notification.
  if (order.user_id) {
    await client.from('vd_notifications').insert({
      user_id: order.user_id,
      type: 'payment',
      title: isRefund
        ? `Refund receipt ${receipt.receipt_number}`
        : `Payment receipt ${receipt.receipt_number}`,
      body: `${isRefund ? 'Refund' : 'Payment'} of ${money(Number(receipt.amount), receipt.currency)} on order ${order.order_number}.${Number(order.outstanding_balance) > 0 ? ` Balance due: ${money(Number(order.outstanding_balance), receipt.currency)}.` : ' Your invoice is fully paid.'}`,
      link: `/invoices/${invoice?.id ?? order.id}`,
    })
  }

  return { sent, error: sendError, status: 200 }
}
