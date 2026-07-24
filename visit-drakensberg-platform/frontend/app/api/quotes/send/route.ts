import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

// Emails the customer their quote link. Same Resend pattern as
// app/api/receipts/send — silently skipped if RESEND_API_KEY isn't set.

function money(amount: number, currency: string) {
  const symbol = currency === 'ZAR' ? 'R ' : `${currency} `
  return `${symbol}${Math.abs(amount).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

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

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !quote.customer_email) {
    return NextResponse.json({ sent: false, error: !apiKey ? 'RESEND_API_KEY not configured' : 'quote has no customer email' })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const quoteUrl = `${origin}/quotes/${quote.id}`

  let sent = false
  let sendError: string | null = null
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RECEIPTS_FROM_EMAIL || 'Visit Drakensberg <bookings@visitdrakensberg.co.za>',
        to: [quote.customer_email],
        subject: `Your quote ${quote.quote_number} — Visit Drakensberg`,
        html: `<!doctype html><html><body style="margin:0;background:#F7F5F2;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
            <div style="background:#000;color:#fff;padding:28px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9A96E;">Visit Drakensberg</p>
              <h1 style="margin:8px 0 0;font-style:italic;font-weight:normal;font-size:26px;">Your quote is ready</h1>
            </div>
            <div style="background:#fff;border:1px solid #e5e5e5;border-top:none;padding:28px 32px;">
              <p style="font-size:14px;color:#444;margin:0 0 4px;">Dear ${quote.customer_name || 'traveller'},</p>
              <p style="font-size:14px;color:#444;margin:0 0 20px;">
                We've put together a quote${quote.trip_name ? ` for ${quote.trip_name}` : ''} — <strong>${money(Number(quote.total), quote.currency)}</strong> total.
                ${quote.valid_until ? `This quote is valid until ${new Date(quote.valid_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}
              </p>
              <p style="margin:24px 0 0;">
                <a href="${quoteUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;font-family:Arial,sans-serif;">View & Accept Quote</a>
              </p>
            </div>
          </div></body></html>`,
      }),
    })
    sent = res.ok
    if (!res.ok) sendError = `resend ${res.status}`
  } catch (e) {
    sendError = e instanceof Error ? e.message : 'send failed'
  }

  return NextResponse.json({ sent, error: sendError })
}
