import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { bearerMatches } from '@/lib/secret-compare'
import { alertEvent, logEvent, EVENTS } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/audit-digest
 *
 * Summarises the last 24 hours of vd_audit_log and, for the entries that
 * matter, raises an alert.
 *
 * WHY (audit finding M7)
 *   vd_audit_log has been written diligently since 20260716 — order creation,
 *   payments, invoice link revocation and reissue, role changes, and now seat
 *   bookings and admin-recovery attempts. Nothing ever read it. A log nobody
 *   looks at is an archive, not a control: it tells you what happened after
 *   somebody already knows to ask.
 *
 *   This turns it into a daily summary, and escalates the handful of actions
 *   that should be rare enough to be worth a message the day they happen.
 *
 * Triggered by the `crons` entry in vercel.json and guarded by CRON_SECRET,
 * the same shape as the other cron routes.
 */

/**
 * Actions worth telling somebody about the day they happen, and why.
 * Everything else is counted in the digest but does not escalate.
 */
const NOTABLE: Record<string, string> = {
  'admin.recovery_used': 'the emergency admin backdoor was used',
  'admin.recovery_denied': 'somebody is guessing ADMIN_RECOVERY_SECRET',
  'invoice.link_revoked': 'an invoice link was revoked — usually means one reached the wrong person',
  'role.changed': 'an account\'s access level changed',
  'staff_role.changed': 'an account\'s staff level changed',
  'ops.assignment_changed': 'a supplier was assigned to or removed from an ops employee',
}

type AuditRow = { action: string; entity: string; created_at: string }

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && !bearerMatches(req, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('vd_audit_log')
    .select('action, entity, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    // A bound, so a pathological day cannot pull the whole table into a
    // serverless function's memory. If the digest ever hits this, the count
    // being wrong is the least of the problems it is reporting.
    .limit(5000)

  if (error) {
    logEvent({ event: 'audit.digest_failed', severity: 'error', fields: { reason: error.message } })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as AuditRow[]
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.action] = (counts[row.action] ?? 0) + 1

  const notable = Object.entries(counts)
    .filter(([action]) => action in NOTABLE)
    .map(([action, count]) => ({ action, count, why: NOTABLE[action] }))

  // Payment links that the gateway may have settled but we never reconciled.
  // The complement to the webhook's own alert: that one fires when a callback
  // fails loudly, this one catches the case where no callback ever arrived.
  const { data: stuck } = await admin
    .from('vd_payment_links')
    .select('id, order_id, amount, currency, created_at')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(50)

  const stuckCount = stuck?.length ?? 0

  const summary = {
    window: '24h',
    totalEntries: rows.length,
    distinctActions: Object.keys(counts).length,
    counts,
    notable,
    stuckPaymentLinks: stuckCount,
  }

  logEvent({ event: EVENTS.AUDIT_DIGEST, severity: 'info', fields: summary })

  // Only escalate when there is something to escalate. A digest that pings
  // every day regardless is one people learn to ignore, and then the day it
  // matters they ignore that too.
  if (notable.length > 0 || stuckCount > 0) {
    await alertEvent({
      event: EVENTS.AUDIT_DIGEST,
      severity: notable.some(n => n.action.startsWith('admin.recovery')) ? 'critical' : 'warn',
      fields: {
        notable,
        stuckPaymentLinks: stuckCount,
        // Ids only — the amounts and customers are in the console, and this
        // message may land in a chat channel with a wider audience.
        stuckIds: (stuck ?? []).map(s => (s as { id: string }).id).slice(0, 20),
      },
    })
  }

  return NextResponse.json(summary)
}
