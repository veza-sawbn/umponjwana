import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { emailShell, paragraph, ctaButton, finePrint } from '@/lib/email-layout'
import { getSiteOrigin } from '@/lib/origin'
import { rateLimit, rateLimitHeaders, callerKey } from '@/lib/rate-limit'
import { isValidEmail, normaliseEmail, newOptInToken } from '@/lib/marketing-tokens'

export const dynamic = 'force-dynamic'

// Step 1 of double opt-in. Anyone can type any address into a signup box, so
// nothing is subscribed here: we store a pending, expiring, single-use token
// and email the address a link. Only /api/marketing/confirm (POST, from the
// page that link opens) records consent — proving the person controls the
// inbox. The confirmation itself is a one-off, transactional-style message
// sent through the normal mailbox (lib/mailer.ts); campaigns go through Brevo.
//
// The response is the same whether or not the address is already subscribed,
// suppressed or rate limited, so this endpoint cannot be used to find out who
// is on the list.
export async function POST(req: Request) {
  let body: { email?: unknown; source?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }

  const raw = typeof body.email === 'string' ? body.email : ''
  if (!isValidEmail(raw)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  const email = normaliseEmail(raw)
  const source = typeof body.source === 'string' && /^[a-z0-9_]{1,40}$/.test(body.source) ? body.source : 'web'

  const limits = await Promise.all([
    rateLimit('marketingSubscribe', callerKey(req)),
    rateLimit('marketingSubscribe', `email:${email}`),
  ])
  const blocked = limits.find(l => !l.ok)
  if (blocked) return NextResponse.json({ ok: true, pending: true }, { headers: rateLimitHeaders(blocked) })

  const admin = supabaseAdmin()

  // Already subscribed (or suppressed): nothing to confirm, and no email to send.
  const { data: can } = await admin.rpc('vd_marketing_can_email', { p_email: email, p_user_id: null })
  if (can === true) return NextResponse.json({ ok: true, pending: true })
  const { data: suppressed } = await admin.from('vd_email_suppressions').select('email').eq('email', email).maybeSingle()
  if (suppressed) return NextResponse.json({ ok: true, pending: true })

  const { token, hash } = newOptInToken()
  const { error } = await admin.from('vd_marketing_optins').insert({ email, token_hash: hash, source })
  if (error) {
    console.error('[marketing/subscribe] could not store opt-in:', error.message)
    return NextResponse.json({ error: 'Subscription failed. Please try again later.' }, { status: 500 })
  }

  const origin = getSiteOrigin(req)
  const link = `${origin}/subscribed?token=${encodeURIComponent(token)}`
  const sent = await sendMail({
    to: email,
    subject: 'Confirm your Visit Drakensberg subscription',
    html: emailShell({
      origin,
      heading: 'One quick step',
      preheader: 'Confirm your email to start hearing from Visit Drakensberg.',
      bodyHtml:
        paragraph('Thanks for asking to hear from Visit Drakensberg — trail notes, seasonal picks and the odd offer.') +
        paragraph('Please confirm this is your address. Nothing will be sent until you do.') +
        ctaButton(link, 'Confirm subscription') +
        finePrint('If you did not ask for this, ignore this email — you will not be subscribed. The link expires in 7 days.'),
    }),
  })
  if (!sent.sent) {
    console.error('[marketing/subscribe] confirmation email failed:', sent.error)
    return NextResponse.json({ error: 'We could not send the confirmation email. Please try again later.' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, pending: true })
}
