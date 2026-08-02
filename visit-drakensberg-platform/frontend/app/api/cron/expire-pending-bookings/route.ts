import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Sweeps abandoned 'pending' bookings (customer never completed iKhokha
// payment) so they stop holding room/departure-seat inventory forever — see
// vd_expire_pending_bookings() in supabase/migrations/20260803_expire_pending_bookings.sql.
// Triggered by the `crons` entry in vercel.json. Guarded by CRON_SECRET so
// this can't be hit by anyone else to force extra sweeps — low-stakes even
// if it were (the TTL filter means an early call just finds nothing to do),
// but there's no reason to leave it open.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin.rpc('vd_expire_pending_bookings', { p_older_than_minutes: 30 })
  if (error) {
    console.error('[cron] expire-pending-bookings failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expired: data ?? 0 })
}
