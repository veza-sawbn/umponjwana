import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { formatMoney as money } from '@/lib/allocation'
import { emailShell, ctaButton, detailTable, esc, getFeaturedExperiences, type FeaturedExperience } from '@/lib/email-layout'

import { siteOrigin } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

// Emails a payment receipt to the customer. Called automatically after a
// payment is recorded (checkout, admin console, package booking).
//
// Delivery: SMTP via the domains.co.za mailbox (lib/mailer.ts) when
// SMTP_HOST/SMTP_USER/SMTP_PASSWORD are configured (EMAIL_FROM overrides the
// sender). Without them the email is skipped gracefully — the in-app
// notification below still fires, so the customer always sees the receipt
// in their account.
//
// Data access runs under the CALLER's Supabase session, so RLS applies:
// a customer can only trigger receipts for their own orders, staff for any.

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
  featured: FeaturedExperience[]
}) {
  return emailShell({
    origin: o.origin,
    eyebrow: `Receipt ${o.receiptNumber}`,
    heading: o.isRefund ? 'Refund processed' : 'Payment received',
    preheader: o.isRefund
      ? `Refund of ${money(o.amount, o.currency)} processed against your booking.`
      : `Payment of ${money(o.amount, o.currency)} received — thank you.`,
    featured: o.featured,
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
        ['Balance due', money(o.balance, o.currency)],
      ])}
      ${ctaButton(o.invoiceUrl, 'View your invoice')}
      <p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">
        This receipt covers your single trip invoice with Visit Drakensberg — all accommodation,
        activities, transfers and extras appear on one document. Keep this email for your records.
      </p>`,
  })
}

export async function POST(req: Request) {
  let body: { orderId?: string; paymentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  // Server-to-server callers (e.g. the iKhokha webhook, which has no browser
  // session to authenticate with) prove themselves with the service role key
  // and read via the admin client instead of an RLS-scoped session.
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const isInternal = !!bearer && !!process.env.SUPABASE_SERVICE_ROLE_KEY && bearer === process.env.SUPABASE_SERVICE_ROLE_KEY

  const supabase = isInternal ? supabaseAdmin() : createRouteHandlerClient({ cookies })
  if (!isInternal) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // RLS scopes these reads to the caller (own order, or staff) — or, for the
  // internal admin client above, everything (already access-checked by the caller).
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
  const origin = siteOrigin(req)
  // The invoice's own address, which opens without a session — the customer
  // we're thanking for a payment is usually the one who never had an account
  // to sign in with.
  const invoiceUrl = `${origin}/invoices/${invoice?.id ?? order.id}`

  let sent = false
  let sendError: string | null = null

  if (email) {
    const featured = await getFeaturedExperiences(origin)
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
        origin,
        featured,
      }),
    })
    sent = result.sent
    sendError = result.error
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
