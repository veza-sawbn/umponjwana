import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendOrderReceipt } from '@/lib/receipts-server'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

// Emails a payment receipt to the customer. Called from the browser after a
// payment is recorded in the admin console (lib/order-payments.ts
// sendReceiptEmail).
//
// Delivery: SMTP via the domains.co.za mailbox (lib/mailer.ts) when
// SMTP_HOST/SMTP_USER/SMTP_PASSWORD are configured (EMAIL_FROM overrides the
// sender). Without them the email is skipped gracefully — the in-app
// notification still fires, so the customer always sees the receipt in their
// account.
//
// Data access runs under the CALLER's Supabase session, so RLS applies: a
// customer can only trigger receipts for their own orders, staff for any.
//
// SERVER-TO-SERVER CALLERS NO LONGER COME THROUGH HERE (audit finding M8).
// The iKhokha webhook used to POST to this route carrying
// SUPABASE_SERVICE_ROLE_KEY as a bearer token — the credential that bypasses
// RLS entirely — over the network on every confirmed payment. It now calls
// sendOrderReceipt() directly with its own admin client, so there is no
// request, no token in flight, and no origin to get wrong. The bearer branch
// that used to accept that token is gone with it: this route authenticates
// browser sessions and nothing else.
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

  // RLS scopes every read inside to the caller — own order, or staff.
  const result = await sendOrderReceipt(supabase, {
    orderId: body.orderId,
    paymentId: body.paymentId,
    origin: getSiteOrigin(req),
  })

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ sent: result.sent, error: result.error })
}
