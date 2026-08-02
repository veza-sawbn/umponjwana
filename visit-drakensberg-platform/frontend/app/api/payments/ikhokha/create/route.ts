import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createPaymentLink, isIkhokhaConfigured } from '@/lib/ikhokha'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Starts an online payment for one invoice — either an existing invoice
// (Pay Now on /invoices/[id]) or a just-created checkout booking, resolved
// to its invoice via vd_orders.booking_id. The customer is redirected to the
// returned paylinkUrl; the actual "mark as paid" happens later, in the
// webhook route, once iKhokha confirms the payment really went through.
export async function POST(req: Request) {
  let body: { invoiceId?: string; bookingId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.invoiceId && !body.bookingId) {
    return NextResponse.json({ error: 'invoiceId or bookingId required' }, { status: 400 })
  }

  if (!isIkhokhaConfigured()) {
    return NextResponse.json({ error: 'Online payment is not set up yet — please contact us to arrange payment.' }, { status: 503 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // RLS scopes every read below to the caller's own rows, or staff.
  let invoice: { id: string; order_id: string; invoice_number: string; balance: unknown; currency: string; status: string } | null = null
  if (body.invoiceId) {
    const { data } = await supabase.from('vd_invoices').select('*').eq('id', body.invoiceId).maybeSingle()
    invoice = data
  } else {
    const { data: order } = await supabase.from('vd_orders').select('id').eq('booking_id', body.bookingId).maybeSingle()
    if (!order) return NextResponse.json({ error: 'booking not found' }, { status: 404 })
    const { data } = await supabase.from('vd_invoices').select('*').eq('order_id', order.id).maybeSingle()
    invoice = data
  }
  if (!invoice) return NextResponse.json({ error: 'invoice not found' }, { status: 404 })

  const balance = Number(invoice.balance)
  if (!(balance > 0)) return NextResponse.json({ error: 'This invoice has no outstanding balance.' }, { status: 400 })
  if (invoice.status === 'void') return NextResponse.json({ error: 'This invoice is void.' }, { status: 400 })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const externalTransactionID = `${invoice.id}-${Date.now()}`

  const returnUrls = body.bookingId
    ? {
        successPageUrl: `${origin}/checkout/success?id=${body.bookingId}&payment=success`,
        failurePageUrl: `${origin}/checkout/success?id=${body.bookingId}&payment=failed`,
        cancelUrl: `${origin}/checkout/success?id=${body.bookingId}&payment=cancelled`,
      }
    : {
        successPageUrl: `${origin}/invoices/${invoice.id}?payment=success`,
        failurePageUrl: `${origin}/invoices/${invoice.id}?payment=failed`,
        cancelUrl: `${origin}/invoices/${invoice.id}?payment=cancelled`,
      }

  let link
  try {
    link = await createPaymentLink({
      amount: balance,
      currency: invoice.currency,
      description: `Invoice ${invoice.invoice_number} — Visit Drakensberg`,
      paymentReference: invoice.invoice_number,
      externalTransactionID,
      requesterUrl: origin,
      callbackUrl: `${origin}/api/payments/ikhokha/webhook`,
      ...returnUrls,
    })
  } catch (e) {
    console.error('[ikhokha] create payment link failed:', e)
    return NextResponse.json({ error: 'Could not start the payment — please try again shortly.' }, { status: 502 })
  }

  const admin = supabaseAdmin()
  const { error: insertError } = await admin.from('vd_payment_links').insert({
    id: `plink-${randomUUID()}`,
    order_id: invoice.order_id,
    invoice_id: invoice.id,
    user_id: user.id,
    gateway: 'ikhokha',
    mode: process.env.IKHOKHA_MODE === 'live' ? 'live' : 'test',
    paylink_id: link.paylinkID,
    external_transaction_id: externalTransactionID,
    amount: balance,
    currency: invoice.currency,
    status: 'pending',
    paylink_url: link.paylinkUrl,
    raw_create_response: link,
  })
  if (insertError) {
    // The webhook reconciles a payment by looking up this row via paylink_id
    // — without it, a real payment could complete with no way to mark the
    // invoice (or booking) paid. Fail loudly rather than send the customer
    // to pay anyway.
    console.error('[ikhokha] failed to persist payment link:', insertError)
    return NextResponse.json({ error: 'Could not start the payment — please try again shortly.' }, { status: 500 })
  }

  return NextResponse.json({ paylinkUrl: link.paylinkUrl })
}
