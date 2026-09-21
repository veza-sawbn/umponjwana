import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { bearerMatches } from '@/lib/secret-compare'

export const dynamic = 'force-dynamic'

// Recomputes every supplier's contact list from live vd_order_lines/
// vd_orders history — see vd_recompute_supplier_contacts() in
// supabase/migrations/20260826_supplier_contacts.sql. Triggered by the
// `crons` entry in vercel.json, same pattern as recompute-segments. The
// service-role client carries no user JWT, so the RPC checks
// auth.role() = 'service_role' rather than is_admin() for this caller.
export async function GET(req: Request) {
  // Constant-time: `auth !== \`Bearer ${secret}\`` short-circuits at the first
  // differing byte, which over enough unthrottled samples recovers CRON_SECRET
  // a byte at a time (audit finding L2).
  const secret = process.env.CRON_SECRET
  if (secret && !bearerMatches(req, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { error } = await admin.rpc('vd_recompute_supplier_contacts', {})
  if (error) {
    console.error('[cron] recompute-supplier-contacts failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ recomputed: true })
}
