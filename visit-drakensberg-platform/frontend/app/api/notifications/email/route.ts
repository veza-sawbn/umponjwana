import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { emailShell, ctaButton, esc } from '@/lib/email-layout'

export const dynamic = 'force-dynamic'

// Emails a user/supplier whenever an in-app notification (lib/notifications.ts
// notify()) is raised for them — sent via the domains.co.za mailbox
// (lib/mailer.ts), silently skipped if SMTP isn't configured. The trigger
// side can be any signed-in user (per the "Authenticated create
// notifications" RLS policy on vd_notifications, any signed-in user may
// notify any other), so the recipient's email is looked up with the admin
// client rather than trusting the caller's session — the caller never gets
// the address back.

function emailHtml(o: {
  title: string
  body: string
  link: string | null
  name: string | null
  origin: string
}) {
  return emailShell({
    origin: o.origin,
    heading: o.title,
    preheader: o.body.slice(0, 140),
    bodyHtml: `
      <p style="margin:0 0 4px;">Dear ${esc(o.name || 'there')},</p>
      <p style="margin:0 0 20px;white-space:pre-wrap;">${esc(o.body)}</p>
      ${o.link ? ctaButton(o.link, 'View details') : ''}`,
  })
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

  const { data: profile } = await supabaseAdmin()
    .from('profiles').select('email, full_name').eq('id', payload.userId).maybeSingle()
  if (!profile?.email) return NextResponse.json({ sent: false, error: 'recipient has no email on file' })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const link = payload.link ? `${origin}${payload.link}` : null

  const { sent, error } = await sendMail({
    to: profile.email,
    subject: payload.title,
    html: emailHtml({
      title: payload.title, body: payload.body, link, name: profile.full_name, origin,
    }),
  })

  return NextResponse.json({ sent, error })
}
