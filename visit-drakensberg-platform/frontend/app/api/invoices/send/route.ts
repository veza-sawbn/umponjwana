import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendMail } from '@/lib/mailer'
import { formatMoney as money } from '@/lib/allocation'
import { emailShell, ctaButton, detailTable, esc, getFeaturedExperiences, type FeaturedExperience } from '@/lib/email-layout'

export const dynamic = 'force-dynamic'

// Emails a customer their invoice link — the counterpart to
// app/api/receipts/send, which only fires once a payment has been recorded.
// Staff trigger this from the Invoices console to chase an unpaid balance or
// re-send a document the customer lost.
//
// Data access runs under the CALLER's Supabase session, so RLS applies: a
// customer can only send their own invoice, staff can send any.

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function invoiceHtml(o: {
  customerName: string
  invoiceNumber: string
  orderNumber: string
  tripName: string
  currency: string
  total: number
  amountPaid: number
  balance: number
  issuedAt: string
  invoiceUrl: string
  origin: string
  featured: FeaturedExperience[]
}) {
  const settled = o.balance <= 0
  const trip = o.tripName ? ` for ${esc(o.tripName)}` : ''

  return emailShell({
    origin: o.origin,
    eyebrow: `Invoice ${o.invoiceNumber}`,
    heading: 'Your invoice',
    preheader: settled
      ? `Invoice ${o.invoiceNumber} — fully paid, no payment due.`
      : `Invoice ${o.invoiceNumber} — ${money(o.balance, o.currency)} outstanding.`,
    featured: o.featured,
    bodyHtml: `
      <p style="margin:0 0 4px;">Dear ${esc(o.customerName || 'traveller')},</p>
      <p style="margin:0 0 20px;">
        ${settled
          ? `Here is invoice <strong>${esc(o.invoiceNumber)}</strong>${trip}. It is fully paid — no further payment is due.`
          : `Here is invoice <strong>${esc(o.invoiceNumber)}</strong>${trip}, with <strong>${esc(money(o.balance, o.currency))}</strong> still outstanding.`}
      </p>
      ${detailTable([
        ['Invoice', o.invoiceNumber],
        ['Order', o.orderNumber],
        ['Trip', o.tripName || '—'],
        ['Issued', fmtDate(o.issuedAt)],
        ['Invoice total', money(o.total, o.currency)],
        ['Paid to date', money(o.amountPaid, o.currency)],
        ['Balance due', money(o.balance, o.currency)],
      ])}
      ${ctaButton(o.invoiceUrl, settled ? 'View your invoice' : 'View & pay your invoice')}
      <p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">
        This invoice covers your single trip with Visit Drakensberg — all accommodation,
        activities, transfers and extras appear on one document.
      </p>`,
  })
}

export async function POST(req: Request) {
  let body: { invoiceId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: invoice } = await supabase
    .from('vd_invoices').select('*').eq('id', body.invoiceId).maybeSingle()
  if (!invoice) return NextResponse.json({ error: 'invoice not found' }, { status: 404 })

  // The customer's contact details live on the order, not the invoice.
  const { data: order } = await supabase
    .from('vd_orders').select('*').eq('id', invoice.order_id).maybeSingle()
  if (!order) return NextResponse.json({ error: 'order not found for invoice' }, { status: 404 })

  const email = order.customer_email as string
  if (!email) return NextResponse.json({ sent: false, error: 'order has no customer email' })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const featured = await getFeaturedExperiences(origin)

  const { sent, error } = await sendMail({
    to: email,
    subject: `Invoice ${invoice.invoice_number} — Visit Drakensberg`,
    html: invoiceHtml({
      customerName: order.customer_name,
      invoiceNumber: invoice.invoice_number,
      orderNumber: order.order_number,
      tripName: order.trip_name,
      currency: invoice.currency,
      total: Number(invoice.total),
      amountPaid: Number(invoice.amount_paid),
      balance: Number(invoice.balance),
      issuedAt: invoice.issued_at,
      invoiceUrl: `${origin}/invoices/${invoice.id}`,
      origin,
      featured,
    }),
  })

  // In-app notification for account holders, so the invoice is surfaced even
  // when SMTP is down — same pattern as the receipts route.
  if (order.user_id) {
    await supabase.from('vd_notifications').insert({
      user_id: order.user_id,
      type: 'invoice',
      title: `Invoice ${invoice.invoice_number}`,
      body: Number(invoice.balance) > 0
        ? `${money(Number(invoice.balance), invoice.currency)} is outstanding on order ${order.order_number}.`
        : `Your invoice for order ${order.order_number} is fully paid.`,
      link: `/invoices/${invoice.id}`,
    })
  }

  return NextResponse.json({ sent, error })
}
