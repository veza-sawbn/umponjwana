import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Recomputes dynamic customer segment membership + lifecycle_stage from live
// vd_orders/profiles data — see vd_recompute_segments() in
// supabase/migrations/20260824_customer_intelligence_foundation.sql.
// Triggered by the `crons` entry in vercel.json, same pattern as
// expire-pending-bookings. The service-role client carries no user JWT, so
// vd_recompute_segments() checks auth.role() = 'service_role' rather than
// is_admin() for this caller.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const admin = supabaseAdmin()
  const { error } = await admin.rpc('vd_recompute_segments', {})
  if (error) {
    console.error('[cron] recompute-segments failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ recomputed: true })
}
