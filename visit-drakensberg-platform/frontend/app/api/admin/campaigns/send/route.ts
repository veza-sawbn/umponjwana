import { NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin-route'
import { getMarketingConfig } from '@/lib/marketing-config'
import { dispatchCampaigns } from '@/lib/campaign-dispatch'
import { getSiteOrigin } from '@/lib/origin'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Starts a real send: resolves the consented audience into per-recipient rows
// (vd_campaign_enqueue — admin-checked in SQL, runs as the signed-in admin),
// then delivers a first batch immediately so the admin sees movement. The
// remainder drains via /api/cron/campaign-dispatch.
export async function POST(req: Request) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const limited = await rateLimit('campaignSend', gate.userId)
  if (!limited.ok) return NextResponse.json({ error: 'Too many send requests — wait a moment.' }, { status: 429, headers: rateLimitHeaders(limited) })

  const cfg = getMarketingConfig()
  if (!cfg.ready) {
    return NextResponse.json({ error: 'Sending is not configured.', missing: cfg.missing }, { status: 409 })
  }
  if (!process.env.CRON_SECRET) {
    // Without the heartbeat a send would stall after its first batch.
    return NextResponse.json({ error: 'Sending is not configured.', missing: ['CRON_SECRET'] }, { status: 409 })
  }

  let campaignId: unknown
  try { campaignId = (await req.json())?.campaignId } catch { /* fallthrough */ }
  if (typeof campaignId !== 'string' || !/^[0-9a-f-]{36}$/i.test(campaignId)) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
  }

  const { data: queued, error } = await gate.supabase.rpc('vd_campaign_enqueue', { p_campaign_id: campaignId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let firstBatch = null
  try {
    firstBatch = await dispatchCampaigns({ origin: getSiteOrigin(req), budgetMs: 20_000, cfg })
  } catch (e) {
    // The campaign is queued either way; the cron will pick it up.
    console.error('[campaigns/send] first batch failed:', e)
  }
  return NextResponse.json({ queued, firstBatch })
}
