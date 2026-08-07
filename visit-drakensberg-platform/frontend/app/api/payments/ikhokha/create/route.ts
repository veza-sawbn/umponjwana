import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createPaymentLink, isIkhokhaConfigured } from '@/lib/ikhokha'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { maxTip, tippableTotal } from '@/lib/tips'
import type { InvoiceLine } from '@/lib/invoices'

export const dynamic = 'force-dynamic'

/**
 * Has this database run the tipping migration?
 *
 * PostgREST words an unknown column differently across versions — PGRST204
 * "Could not find the 'tip_amount' column ... in the schema cache", or a
 * 42703 'column "tip_amount" ... does not exist' — so match on the wording
 * rather than the code alone. Narrow enough not to swallow anything else:
 * the only other error this column can raise is its >= 0 check, and the tip
 * is validated non-negative long before the insert.
 */
function isMissingTipColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = String(error.message ?? '')
  if (!message.includes('tip_amount')) return false
  return /does not exist|schema cache|could not find/i.test(message)
    || error.code === 'PGRST204' || error.code === '42703'
}

// Starts an online payment for one invoice — either an existing invoice
// (Pay Now on /invoices/[id]) or a just-created checkout booking, resolved
// to its invoice via vd_orders.booking_id. The customer is redirected to the
// returned paylinkUrl; the actual "mark as paid" happens later, in the
// webhook route, once iKhokha confirms the payment really went through.
export async function POST(req: Request) {
  let body: { invoiceId?: string; bookingId?: string; tip?: unknown; shareToken?: unknown }
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

  // A customer paying from an emailed or pasted invoice link has no session.
  // Their credential is the link itself — the invoice id, which is 'inv-'
  // plus a v4 UUID (or, on older links, the ?t= share token). The database
  // decides what qualifies, via vd_invoice_payable: it demands a UUID-bearing
  // reference, so a sequential invoice number buys nothing, and it refuses a
  // revoked link.
  const linkRef = typeof body.shareToken === 'string' && body.shareToken.length >= 32
    ? body.shareToken
    : (typeof body.invoiceId === 'string' ? body.invoiceId : '')

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && !linkRef) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // RLS scopes every read below to the caller's own rows, or staff.
  let invoice: {
    id: string; order_id: string; invoice_number: string; balance: unknown
    currency: string; status: string; lines: InvoiceLine[] | null
    user_id: string | null; share_revoked_at?: string | null
  } | null = null
  if (!user && linkRef) {
    const { data } = await supabaseAdmin().rpc('vd_invoice_payable', { p_ref: linkRef })
    invoice = data as typeof invoice
    if (!invoice) {
      return NextResponse.json(
        { error: "We couldn't find that invoice. Ask us to send you a fresh link." },
        { status: 404 },
      )
    }
  } else if (body.invoiceId) {
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

  // Gratuity. The guest picks it here, but nothing is written to the order or
  // the invoice until iKhokha confirms the payment — the amount rides on the
  // payment link until the webhook applies it. Every rule the invoice page
  // shows is re-checked here, since the page can't be trusted.
  let tip = 0
  if (body.tip !== undefined && body.tip !== null && body.tip !== '') {
    tip = Math.round((Number(body.tip) || 0) * 100) / 100
    if (!Number.isFinite(tip) || tip < 0) {
      return NextResponse.json({ error: 'Invalid tip amount.' }, { status: 400 })
    }
    if (tip > 0) {
      const tippable = tippableTotal(invoice.lines ?? [])
      if (tippable <= 0) {
        return NextResponse.json({ error: 'This invoice has no activity to tip.' }, { status: 400 })
      }
      if (tip > maxTip(tippable)) {
        return NextResponse.json(
          { error: 'A tip cannot be more than the activity it is for. Please enter a smaller amount.' },
          { status: 400 },
        )
      }
      // Read with the service client: this is the server enforcing the
      // setting, and the caller may have no session to read it under.
      const { data: setting } = await supabaseAdmin()
        .from('vd_finance_settings').select('value').eq('key', 'tipping_enabled').maybeSingle()
      if (setting?.value === false) {
        return NextResponse.json({ error: 'Tipping is currently switched off.' }, { status: 400 })
      }
    }
  }

  const chargeAmount = Math.round((balance + tip) * 100) / 100

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const externalTransactionID = `${invoice.id}-${Date.now()}`

  const returnUrls = body.bookingId
    ? {
        successPageUrl: `${origin}/checkout/success?id=${body.bookingId}&payment=success`,
        failurePageUrl: `${origin}/checkout/success?id=${body.bookingId}&payment=failed`,
        cancelUrl: `${origin}/checkout/success?id=${body.bookingId}&payment=cancelled`,
      }
    : {
        // The invoice's own address, which opens without a session — so the
        // customer lands back on their paid invoice rather than on an error.
        successPageUrl: `${origin}/invoices/${invoice.id}?payment=success`,
        failurePageUrl: `${origin}/invoices/${invoice.id}?payment=failed`,
        cancelUrl: `${origin}/invoices/${invoice.id}?payment=cancelled`,
      }

  let link
  try {
    link = await createPaymentLink({
      amount: chargeAmount,
      currency: invoice.currency,
      description: tip > 0
        ? `Invoice ${invoice.invoice_number} + gratuity — Visit Drakensberg`
        : `Invoice ${invoice.invoice_number} — Visit Drakensberg`,
      paymentReference: invoice.invoice_number,
      externalTransactionID,
      requesterUrl: origin,
      callbackUrl: `${origin}/api/payments/ikhokha/webhook`,
      ...returnUrls,
    })
  } catch (e) {
    console.error('[ikhokha] create payment link failed:', e)
    return NextResponse.json(
      { error: 'The payment provider did not respond — please try again shortly.', code: 'gateway_unreachable' },
      { status: 502 },
    )
  }

  // iKhokha can respond 200 with an app-level failure (bad entityID, invalid
  // params, etc.) instead of a non-2xx HTTP status — createPaymentLink()
  // only throws on the latter. Treat a response with no paylinkUrl as a
  // failure too, and log the raw body: this is currently the only way to
  // see *why* iKhokha rejected it, since this integration has never been
  // verified against a real merchant account (see lib/ikhokha.ts header).
  if (!link.paylinkUrl || !link.paylinkID) {
    console.error('[ikhokha] createPaymentLink returned no paylinkUrl — raw response:', JSON.stringify(link))
    return NextResponse.json(
      { error: 'iKhokha did not return a payment link — please try again shortly.', code: 'gateway_rejected' },
      { status: 502 },
    )
  }

  const admin = supabaseAdmin()
  const linkRow: Record<string, unknown> = {
    id: `plink-${randomUUID()}`,
    order_id: invoice.order_id,
    invoice_id: invoice.id,
    // Null for a guest order — vd_payment_links.user_id is nullable for
    // exactly that case, and the webhook reconciles off the order either way.
    user_id: user?.id ?? invoice.user_id ?? null,
    gateway: 'ikhokha',
    mode: process.env.IKHOKHA_MODE === 'live' ? 'live' : 'test',
    paylink_id: link.paylinkID,
    external_transaction_id: externalTransactionID,
    amount: chargeAmount,
    tip_amount: tip,
    currency: invoice.currency,
    status: 'pending',
    paylink_url: link.paylinkUrl,
    raw_create_response: link,
  }

  let { error: insertError } = await admin.from('vd_payment_links').insert(linkRow)

  // A database that hasn't run 20260806_activity_tips.sql yet has no
  // tip_amount column, and PostgREST rejects the whole insert over it.
  // Paying an invoice must not depend on the tipping migration when there is
  // no tip to record — drop the column and carry on. With a tip, there is
  // nowhere to record it, so the guest is told rather than charged for
  // something that would never reach the operator.
  if (insertError && isMissingTipColumn(insertError)) {
    if (tip > 0) {
      console.error('[ikhokha] tip requested but vd_payment_links.tip_amount is missing — run migration 20260806_activity_tips.sql')
      return NextResponse.json(
        {
          error: 'Tips are not switched on for this site yet — please pay without a tip, or contact us to add one.',
          code: 'tipping_not_migrated',
        },
        { status: 503 },
      )
    }
    console.warn('[ikhokha] vd_payment_links.tip_amount is missing — run migration 20260806_activity_tips.sql. Continuing without it.')
    delete linkRow.tip_amount
    ;({ error: insertError } = await admin.from('vd_payment_links').insert(linkRow))
  }

  if (insertError) {
    // The webhook reconciles a payment by looking up this row via paylink_id
    // — without it, a real payment could complete with no way to mark the
    // invoice (or booking) paid. Fail loudly rather than send the customer
    // to pay anyway.
    console.error('[ikhokha] failed to persist payment link:', insertError)
    return NextResponse.json(
      { error: 'Could not start the payment — please try again shortly.', code: 'link_not_saved' },
      { status: 500 },
    )
  }

  return NextResponse.json({ paylinkUrl: link.paylinkUrl })
}
