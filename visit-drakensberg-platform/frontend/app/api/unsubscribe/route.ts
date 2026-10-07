import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { emailShell, paragraph, ctaButton, finePrint } from '@/lib/email-layout'
import { getMarketingConfig } from '@/lib/marketing-config'
import { getSiteOrigin } from '@/lib/origin'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'
import {
  isValidEmail, normaliseEmail, signUnsubscribeToken, verifyUnsubscribeToken,
} from '@/lib/marketing-tokens'

export const dynamic = 'force-dynamic'

// Opt-out, in three shapes:
//
//  1. POST ?t=<token>            RFC 8058 one-click (Gmail/Yahoo's "Unsubscribe"
//                                button posts here) and the /unsubscribe page's
//                                confirm button. The token is signed and bound
//                                to one address, so it can only ever opt out the
//                                address it was issued to.
//  2. POST {email}               "I lost the email" — we mail that address a
//                                signed link. It never unsubscribes on an
//                                unauthenticated address alone: the old
//                                ?email= link let anyone opt out anyone.
//  3. GET  ?t=<token>            Some clients GET the header URL; send them to
//                                the confirmation page rather than act on a GET
//                                (link scanners GET everything).
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t')
  const origin = getSiteOrigin(req)
  return NextResponse.redirect(`${origin}/unsubscribe${t ? `?t=${encodeURIComponent(t)}` : ''}`, 303)
}

export async function POST(req: Request) {
  const cfg = getMarketingConfig()
  const url = new URL(req.url)
  let body: { t?: unknown; email?: unknown } = {}
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) body = await req.json()
  } catch { /* the one-click form body carries nothing we need */ }

  const token = typeof body.t === 'string' ? body.t : url.searchParams.get('t')

  // ── Shape 1: signed token ─────────────────────────────────────────────────
  if (token) {
    const limited = await rateLimit('marketingToken', callerKey(req))
    if (!limited.ok) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429, headers: rateLimitHeaders(limited) })
    const email = verifyUnsubscribeToken(cfg.tokenSecret, token)
    if (!email) return NextResponse.json({ ok: false, error: 'invalid link' }, { status: 400 })
    const { error } = await supabaseAdmin().rpc('vd_record_marketing_consent', {
      p_email: email, p_granted: false, p_source: ct.includes('json') ? 'unsubscribe_link' : 'one_click_unsubscribe',
    })
    if (error) {
      console.error('[unsubscribe] could not record opt-out:', error.message)
      return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Shape 2: request a link by email ──────────────────────────────────────
  const raw = typeof body.email === 'string' ? body.email : ''
  if (!isValidEmail(raw)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  const email = normaliseEmail(raw)

  const limits = await Promise.all([
    rateLimit('marketingUnsubscribeRequest', callerKey(req)),
    rateLimit('marketingUnsubscribeRequest', `email:${email}`),
  ])
  const blocked = limits.find(l => !l.ok)
  // Identical response in every case: this must not reveal who is on the list.
  if (blocked || cfg.tokenSecret.length < 32) return NextResponse.json({ ok: true }, { headers: blocked ? rateLimitHeaders(blocked) : undefined })

  const origin = getSiteOrigin(req)
  const link = `${origin}/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(cfg.tokenSecret, email))}`
  const sent = await sendMail({
    to: email,
    subject: 'Your Visit Drakensberg unsubscribe link',
    html: emailShell({
      origin,
      heading: 'Unsubscribe',
      preheader: 'Use this link to stop marketing email from Visit Drakensberg.',
      bodyHtml:
        paragraph('You asked to stop receiving marketing email from Visit Drakensberg at this address.') +
        ctaButton(link, 'Unsubscribe') +
        finePrint('If this was not you, ignore this email and nothing will change. Messages about trips you have booked are not affected.'),
    }),
  })
  if (!sent.sent) console.error('[unsubscribe] link email failed:', sent.error)
  return NextResponse.json({ ok: true })
}
