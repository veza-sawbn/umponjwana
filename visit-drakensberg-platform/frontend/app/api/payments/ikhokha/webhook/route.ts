import { NextResponse } from 'next/server'
import { getPaymentLinkStatus } from '@/lib/ikhokha'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// iKhokha calls this URL when a payment link's status changes. The callback
// body is never trusted for the actual payment outcome — it's only used to
// learn which paylink to check — because it isn't a signed request we can
// verify. Instead we make our own signed, authenticated server-to-server
// call to iKhokha's status endpoint and reconcile against that answer.
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const paylinkID =
    (body?.paylinkID as string | undefined) ??
    (body?.paylinkId as string | undefined) ??
    ((body?.data as Record<string, unknown> | undefined)?.paylinkID as string | undefined)

  if (!paylinkID) return NextResponse.json({ ok: true }) // nothing actionable — ack so iKhokha stops retrying

  const admin = supabaseAdmin()
  const { data: link } = await admin.from('vd_payment_links').select('*').eq('paylink_id', paylinkID).maybeSingle()
  if (!link) return NextResponse.json({ ok: true })
  if (link.status === 'paid') return NextResponse.json({ ok: true }) // already reconciled — idempotent

  let status
  try {
    status = await getPaymentLinkStatus(paylinkID)
  } catch (e) {
    console.error('[ikhokha webhook] status check failed:', e)
    return NextResponse.json({ ok: false }, { status: 502 })
  }

  const paid = /success|paid|complete/i.test(String(status?.status ?? status?.responseCode ?? ''))

  if (!paid) {
    await admin.from('vd_payment_links')
      .update({ status: 'failed', raw_status_response: status, updated_at: new Date().toISOString() })
      .eq('id', link.id)
    return NextResponse.json({ ok: true })
  }

  // Compare-and-swap on status='pending' so two near-simultaneous callbacks
  // for the same link can't both proceed to record the payment.
  const { data: claimed } = await admin.from('vd_payment_links')
    .update({ status: 'paid', raw_status_response: status, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', link.id).eq('status', 'pending')
    .select().maybeSingle()

  if (!claimed) return NextResponse.json({ ok: true }) // another callback already handled it

  try {
    // A gratuity the guest chose at checkout is written only now, with the
    // money confirmed — it appends a zero-commission, zero-VAT line per
    // operator and lifts the order and invoice totals, so the payment
    // recorded below (balance + tip) settles the invoice exactly.
    // tip_applied_at keeps a retried callback from crediting it twice.
    const tip = Number(link.tip_amount ?? 0)
    if (tip > 0 && !link.tip_applied_at) {
      const { error: tipError } = await admin.rpc('vd_apply_order_tip', {
        p_order_id: link.order_id,
        p_amount: tip,
      })
      if (tipError) throw tipError
      await admin.from('vd_payment_links')
        .update({ tip_applied_at: new Date().toISOString() })
        .eq('id', link.id)
    }

    const { data: paymentId, error } = await admin.rpc('vd_record_order_payment', {
      p_order_id: link.order_id,
      p_amount: Number(link.amount),
      p_type: 'payment',
      p_method: 'online',
      p_reference: `ikhokha:${paylinkID}`,
      p_notes: tip > 0 ? `Paid online via iKhokha (includes ${tip.toFixed(2)} gratuity)` : 'Paid online via iKhokha',
    })
    if (error) throw error
    await admin.from('vd_payment_links').update({ payment_id: paymentId }).eq('id', link.id)

    // A checkout-created booking starts life as status='pending' (holding
    // inventory but unconfirmed) until this point — flip it, its Master
    // Order, and its per-supplier orders to confirmed now that iKhokha has
    // verified the payment. Invoice-only payments (no linked booking) skip
    // this — vd_record_order_payment above already handled the invoice.
    const { data: order } = await admin.from('vd_orders').select('booking_id').eq('id', link.order_id).maybeSingle()
    if (order?.booking_id) {
      const { data: confirmedBooking } = await admin.from('vd_bookings')
        .update({ status: 'confirmed' }).eq('id', order.booking_id).eq('status', 'pending')
        .select('reference, supplier_ids, value').maybeSingle()
      await admin.from('vd_orders').update({ booking_status: 'confirmed' }).eq('id', link.order_id)
      await admin.from('vd_booking_orders').update({ status: 'confirmed' }).eq('booking_id', order.booking_id)

      // Supplier notifications wait for this point rather than firing at
      // booking creation (see lib/bookings.ts) — inserted directly with the
      // service-role client since there's no customer session here to
      // notify() through.
      if (confirmedBooking) {
        const value = confirmedBooking.value as { customerName?: string; guests?: number } | null
        const guests = value?.guests ?? 1
        const rows = (confirmedBooking.supplier_ids ?? []).map((sid: string) => ({
          user_id: sid,
          type: 'booking',
          title: `New booking ${confirmedBooking.reference}`,
          body: `${value?.customerName ?? 'A guest'} booked with you (${guests} guest${guests !== 1 ? 's' : ''}). Open your bookings for details.`,
          link: '/supplier/bookings',
        }))
        if (rows.length > 0) await admin.from('vd_notifications').insert(rows)
      }
    }

    // Fire-and-forget the same receipt email + in-app notification a manual
    // payment gets, authenticating as a trusted internal caller since there's
    // no customer session here.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
    fetch(`${origin}/api/receipts/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ orderId: link.order_id, paymentId }),
    }).catch(err => console.error('[ikhokha webhook] receipt email failed:', err))
  } catch (e) {
    console.error('[ikhokha webhook] failed to record order payment:', e)
    // Roll back to pending so a retried webhook (or manual reconciliation) can complete it.
    await admin.from('vd_payment_links').update({ status: 'pending' }).eq('id', link.id)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
