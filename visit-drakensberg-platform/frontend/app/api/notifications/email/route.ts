import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Emails a user/supplier whenever an in-app notification (lib/notifications.ts
// notify()) is raised for them — same Resend pattern as app/api/receipts/send,
// silently skipped if RESEND_API_KEY isn't set. The trigger side can be any
// signed-in user (per the "Authenticated create notifications" RLS policy on
// vd_notifications, any signed-in user may notify any other), so the
// recipient's email is looked up with the admin client rather than trusting
// the caller's session — the caller never gets the address back.

function emailHtml(o: { title: string; body: string; link: string | null; name: string | null }) {
  return `<!doctype html><html><body style="margin:0;background:#F7F5F2;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#000;color:#fff;padding:28px 32px;">
      <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9A96E;">Visit Drakensberg</p>
      <h1 style="margin:8px 0 0;font-style:italic;font-weight:normal;font-size:26px;">${o.title}</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e5e5;border-top:none;padding:28px 32px;">
      <p style="font-size:14px;color:#444;margin:0 0 4px;">Dear ${o.name || 'there'},</p>
      <p style="font-size:14px;color:#444;margin:0 0 20px;white-space:pre-wrap;">${o.body}</p>
      ${o.link ? `<p style="margin:24px 0 0;">
        <a href="${o.link}" style="display:inline-block;background:#2d6a4f;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;font-family:Arial,sans-serif;">View details</a>
      </p>` : ''}
    </div>
  </div></body></html>`
}

export async function POST(req: Request) {
  let payload: { userId?: string; title?: string; body?: string; link?: string | null }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!payload.userId || !payload.title || !payload.body) {
    return NextResponse.json({ error: 'userId, title and body required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ sent: false, error: 'RESEND_API_KEY not configured' })

  const { data: profile } = await supabaseAdmin()
    .from('profiles').select('email, full_name').eq('id', payload.userId).maybeSingle()
  if (!profile?.email) return NextResponse.json({ sent: false, error: 'recipient has no email on file' })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const link = payload.link ? `${origin}${payload.link}` : null

  let sent = false
  let sendError: string | null = null
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RECEIPTS_FROM_EMAIL || 'Visit Drakensberg <notifications@visitdrakensberg.co.za>',
        to: [profile.email],
        subject: payload.title,
        html: emailHtml({ title: payload.title, body: payload.body, link, name: profile.full_name }),
      }),
    })
    sent = res.ok
    if (!res.ok) sendError = `resend ${res.status}`
  } catch (e) {
    sendError = e instanceof Error ? e.message : 'send failed'
  }

  return NextResponse.json({ sent, error: sendError })
}
