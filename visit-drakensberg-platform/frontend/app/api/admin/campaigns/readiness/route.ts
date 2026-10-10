import { NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin-route'
import { getMarketingConfig } from '@/lib/marketing-config'

export const dynamic = 'force-dynamic'

// Tells the admin UI whether real sends are possible, and if not, which
// settings are missing (names only — never values).
export async function GET() {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response
  const cfg = getMarketingConfig()
  return NextResponse.json({
    ready: cfg.ready, missing: cfg.missing, sender: cfg.senderEmail || null,
    dailyCap: cfg.dailyCap, cronConfigured: Boolean(process.env.CRON_SECRET),
  })
}
