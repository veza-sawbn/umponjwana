import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { bearerMatches, secretsMatch } from '@/lib/secret-compare'
import { parseBrevoPayload } from '@/lib/brevo-webhook'

export const dynamic = 'force-dynamic'

// Brevo → us: delivery, bounce, complaint, open, click and unsubscribe events.
//
// Authenticated with BREVO_WEBHOOK_SECRET, accepted either as a bearer token
// (Brevo's webhook "Authorization" header option) or as ?secret= in the URL,
// whichever the Brevo console in use offers. Fails closed when unset.
//
// Idempotent: Brevo retries on any non-2xx, and each event carries a stable
// key (vd_email_events.provider_event_key), so a redelivery changes nothing.
// Hard bounces, spam complaints and provider-side unsubscribes are turned into
// suppressions / consent withdrawals inside vd_email_record_event().
export async function POST(req: Request) {
  const secret = process.env.BREVO_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'webhook secret not configured' }, { status: 503 })
  const url = new URL(req.url)
  if (!bearerMatches(req, secret) && !secretsMatch(url.searchParams.get('secret'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }

  const events = parseBrevoPayload(body)
  const admin = supabaseAdmin()
  let applied = 0
  let failed = 0
  for (const e of events) {
    const { data, error } = await admin.rpc('vd_email_record_event', {
      p_event_key: e.key, p_event_type: e.type, p_email: e.email, p_message_id: e.messageId,
      p_metadata: e.metadata, p_occurred_at: e.occurredAt ?? new Date().toISOString(),
    })
    if (error) { failed += 1; console.error('[webhooks/brevo] record failed:', error.message) }
    else if (data) applied += 1
  }
  // 500 makes Brevo retry — right for a database failure, so nothing is lost.
  if (failed > 0) return NextResponse.json({ applied, failed }, { status: 500 })
  return NextResponse.json({ received: events.length, applied })
}
