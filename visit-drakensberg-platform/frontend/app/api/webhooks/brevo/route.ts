import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { brevoEventWithdrawsConsent, mapBrevoEvent } from '@/lib/brevo'

export const dynamic = 'force-dynamic'

// Brevo transactional webhook → vd_email_events, plus consent withdrawal on
// unsubscribe / spam complaint.
//
// Register in Brevo → Transactional → Settings → Webhook as
//   https://<site>/api/webhooks/brevo?token=<BREVO_WEBHOOK_SECRET>
// Brevo has no request signing, so the shared secret in the URL is what keeps
// anyone else from posting fake events (and, more to the point, fake
// unsubscribes). Without BREVO_WEBHOOK_SECRET set the route refuses
// everything.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function tokenOk(given: string | null): boolean {
  const expected = process.env.BREVO_WEBHOOK_SECRET?.trim()
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

type BrevoEvent = Record<string, unknown> & { event?: string; email?: string }

export async function POST(req: Request) {
  if (!tokenOk(new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: true }) // nothing actionable — ack so Brevo stops retrying
  }
  // Brevo posts one event per request, or an array when batching is enabled.
  const events = (Array.isArray(payload) ? payload : [payload]) as BrevoEvent[]

  const admin = supabaseAdmin()
  for (const ev of events) {
    const kind = String(ev?.event ?? '')
    const email = String(ev?.email ?? '').trim().toLowerCase()
    if (!kind || !email) continue

    if (brevoEventWithdrawsConsent(kind)) {
      const { error } = await admin.rpc('vd_set_consent', {
        p_email: email, p_consent_type: 'marketing_email', p_granted: false,
        p_source: kind === 'spam' ? 'brevo_spam_complaint' : 'brevo_unsubscribe',
      })
      if (error) console.error('[brevo-webhook] consent withdrawal failed:', error)
    }

    const eventType = mapBrevoEvent(kind)
    if (!eventType) continue

    // Only campaign mail carries our campaign id in X-Mailin-custom; anything
    // else (a Brevo-composed campaign, a test send) is logged unattributed.
    const custom = String(ev['X-Mailin-custom'] ?? '').trim()
    const campaignId = UUID.test(custom) ? custom : null
    const messageId = typeof ev['message-id'] === 'string' ? ev['message-id'] : null

    const { error } = await admin.from('vd_email_events').insert({
      campaign_id: campaignId,
      email,
      event_type: eventType,
      provider_message_id: messageId,
      occurred_at: typeof ev.date === 'string' && !Number.isNaN(Date.parse(ev.date)) ? new Date(ev.date).toISOString() : new Date().toISOString(),
      metadata: {
        provider: 'brevo',
        event: kind,
        ...(typeof ev.link === 'string' ? { link: ev.link } : {}),
        ...(typeof ev.reason === 'string' ? { reason: ev.reason } : {}),
      },
    })
    // 23505: a repeat of an event already recorded (Brevo retries, repeat
    // opens). 23503: the campaign was deleted since. Neither is a failure.
    if (error && error.code !== '23505' && error.code !== '23503') {
      console.error('[brevo-webhook] event insert failed:', error)
      return NextResponse.json({ ok: false }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
