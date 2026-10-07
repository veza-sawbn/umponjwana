import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'
import { hashOptInToken } from '@/lib/marketing-tokens'

export const dynamic = 'force-dynamic'

// Step 2 of double opt-in. POST, not GET: corporate mail scanners (Outlook
// SafeLinks and the like) fetch every link in a message, and a GET that
// confirmed would let a scanner "confirm" an address on its owner's behalf —
// worse, one an attacker had typed in. The link opens /subscribed, which asks
// for one click and then POSTs here.
export async function POST(req: Request) {
  const limited = await rateLimit('marketingToken', callerKey(req))
  if (!limited.ok) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429, headers: rateLimitHeaders(limited) })

  let token: unknown
  try { token = (await req.json())?.token } catch { /* fallthrough */ }
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: optin } = await admin
    .from('vd_marketing_optins')
    .select('id, email, source, expires_at, confirmed_at')
    .eq('token_hash', hashOptInToken(token)).maybeSingle()

  if (!optin || new Date(optin.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 })
  }
  // Confirming twice is harmless and reads as success.
  if (optin.confirmed_at) return NextResponse.json({ ok: true })

  const { error } = await admin.rpc('vd_record_marketing_consent', {
    p_email: optin.email, p_granted: true, p_source: `${optin.source}_confirmed`,
  })
  if (error) {
    console.error('[marketing/confirm] consent failed:', error.message)
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
  }
  await admin.from('vd_marketing_optins').update({ confirmed_at: new Date().toISOString() }).eq('id', optin.id)
  // Keeps the long-standing subscriber list populated; a duplicate is fine.
  await admin.from('vd_newsletter_subscribers').insert({ email: optin.email })
  return NextResponse.json({ ok: true })
}
