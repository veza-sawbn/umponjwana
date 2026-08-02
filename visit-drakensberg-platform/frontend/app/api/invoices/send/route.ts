import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendMail, emailSignature } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

// Emails a customer their invoice link — the counterpart to
// app/api/receipts/send, which only fires once a payment has been recorded.
// Staff trigger this from the Invoices console to chase an unpaid balance or
// re-send a document the customer lost.
//
// Data access runs under the CALLER's Supabase session, so RLS applies: a
// customer can only send their own invoice, staff can send any.

function money(amount: number, currency: string) {
  const symbol = currency === 'ZAR' ? 'R ' : `${currency} `
  return `${symbol}${Math.abs(amount).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

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
}) {
  const rows = [
    ['Invoice', o.invoiceNumber],
    ['Order', o.orderNumber],
    ['Trip', o.tripName || '—'],
    ['Issued', fmtDate(o.issuedAt)],
    ['Invoice total', money(o.total, o.currency)],
    ['Paid to date', money(o.amountPaid, o.currency)],
    ['Balance due', money(o.balance, o.currency)],
  ].map(([k, v]) =>
    `<tr><td style="padding:6px 0;color:#8a8a8a;font-size:13px;">${k}</td>` +
    `<td style="padding:6px 0;text-align:right;font-size:13px;color:#1a1a1a;">${v}</td></tr>`
  ).join('')

  const settled = o.balance <= 0

  return `<!doctype html><html><body style="margin:0;background:#F7F5F2;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#000;color:#fff;padding:28px 32px;">
      <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9A96E;">Visit Drakensberg</p>
      <h1 style="margin:8px 0 0;font-style:italic;font-weight:normal;font-size:26px;">Your invoice</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e5e5;border-top:none;padding:28px 32px;">
      <p style="font-size:14px;color:#444;margin:0 0 4px;">Dear ${o.customerName || 'traveller'},</p>
      <p style="font-size:14px;color:#444;margin:0 0 20px;">
        ${settled
          ? `Here is invoice <strong>${o.invoiceNumber}</strong>${o.tripName ? ` for ${o.tripName}` : ''}. It is fully paid — no further payment is due.`
          : `Here is invoice <strong>${o.invoiceNumber}</strong>${o.tripName ? ` for ${o.tripName}` : ''}, with <strong>${money(o.balance, o.currency)}</strong> still outstanding.`}
      </p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;">${rows}</table>
      <p style="margin:24px 0 0;">
        <a href="${o.invoiceUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;font-family:Arial,sans-serif;">${settled ? 'View your invoice' : 'View & pay your invoice'}</a>
      </p>
      <p style="font-size:11px;color:#aaa;margin:24px 0 0;line-height:1.6;">
        This invoice covers your single trip with Visit Drakensberg — all accommodation,
        activities, transfers and extras appear on one document.
      </p>
      ${emailSignature()}
    </div>
  </div></body></html>`
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
