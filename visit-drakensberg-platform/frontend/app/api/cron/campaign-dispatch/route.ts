import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/secret-compare'
import { dispatchCampaigns } from '@/lib/campaign-dispatch'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// The send worker's heartbeat: starts scheduled campaigns that are due, then
// delivers queued recipients until the time budget or the daily cap runs out.
// Safe to call as often as you like and from several places at once — the
// claim in SQL (FOR UPDATE SKIP LOCKED) means overlapping runs never send the
// same recipient twice. Triggered by the GitHub Actions workflow
// .github/workflows/campaign-dispatch.yml every 10 minutes, with the daily
// entry in vercel.json as a backstop, and kicked once by the admin "Send" action.
//
// Unlike the other cron routes this one FAILS CLOSED when CRON_SECRET is unset:
// it sends real email to real customers, so "no secret configured" must never
// mean "anyone may trigger it".
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  if (!bearerMatches(req, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const summary = await dispatchCampaigns({ origin: getSiteOrigin(req), budgetMs: 45_000 })
    return NextResponse.json(summary)
  } catch (e) {
    console.error('[cron] campaign-dispatch failed:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'dispatch failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
