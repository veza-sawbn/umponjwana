import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendMail } from '@/lib/mailer'
import { formatMoney as money } from '@/lib/allocation'
import { emailShell, ctaButton, detailTable, esc, getFeaturedExperiences } from '@/lib/email-layout'

import { siteOrigin } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

// Emails the customer their quote link. Same SMTP pattern as
// app/api/receipts/send — silently skipped if SMTP isn't configured.

export async function POST(req: Request) {
  let body: { quoteId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: quote } = await supabase.from('vd_quotes').select('*').eq('id', body.quoteId).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 })

  if (!quote.customer_email) {
    return NextResponse.json({ sent: false, error: 'quote has no customer email' })
  }

  const origin = siteOrigin(req)
  const quoteUrl = `${origin}/quotes/${quote.id}`
  const featured = await getFeaturedExperiences(origin)

  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const { sent, error } = await sendMail({
    to: quote.customer_email,
    subject: `Your quote ${quote.quote_number} — Visit Drakensberg`,
    html: emailShell({
      origin,
      eyebrow: `Quote ${quote.quote_number}`,
      heading: 'Your quote is ready',
      preheader: `${money(Number(quote.total), quote.currency)} total${validUntil ? ` — valid until ${validUntil}` : ''}.`,
      featured,
      bodyHtml: `
        <p style="margin:0 0 4px;">Dear ${esc(quote.customer_name || 'traveller')},</p>
        <p style="margin:0 0 20px;">
          We've put together a quote${quote.trip_name ? ` for ${esc(quote.trip_name)}` : ''} —
          <strong>${esc(money(Number(quote.total), quote.currency))}</strong> total.
          ${validUntil ? `This quote is valid until ${esc(validUntil)}.` : ''}
        </p>
        ${detailTable([
          ['Quote', quote.quote_number],
          ...(quote.trip_name ? [['Trip', quote.trip_name] as [string, string]] : []),
          ...(validUntil ? [['Valid until', validUntil] as [string, string]] : []),
          ['Total', money(Number(quote.total), quote.currency)],
        ])}
        ${ctaButton(quoteUrl, 'View & Accept Quote')}`,
    }),
  })

  return NextResponse.json({ sent, error })
}
