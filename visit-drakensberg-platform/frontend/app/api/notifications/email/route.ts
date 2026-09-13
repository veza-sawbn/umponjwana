import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { emailShell, ctaButton, esc } from '@/lib/email-layout'
import { getSiteOrigin } from '@/lib/origin'
import { safeRedirectPath } from '@/lib/safe-redirect'

export const dynamic = 'force-dynamic'

/*
 * Emails a user the in-app notification that was raised for them
 * (lib/notifications.ts notify()) — sent via the domains.co.za mailbox
 * (lib/mailer.ts), silently skipped if SMTP isn't configured.
 *
 * WHAT THIS ROUTE USED TO DO, AND WHY IT CHANGED (audit finding H5)
 *   It took userId, title, body and link straight from the request, looked the
 *   recipient's real address up with the service-role client, and sent. The
 *   only check was that the caller was signed in. So any registered user could
 *   send mail from noreply@visitdrakensberg.com — SPF and DKIM passing, sender
 *   trusted — with a subject and body of their choosing, to any user id they
 *   could obtain, with `link` rendered as the call-to-action button:
 *
 *     {"userId":"…","title":"Your payment failed — update your card","body":"…"}
 *
 *   The body was HTML-escaped, so this was never XSS. It was high-credibility
 *   phishing, from us, at whatever volume the attacker liked.
 *
 *   The route now takes a notification ID and nothing else. vd_notification_
 *   for_email (20260913_notification_provenance_and_seat_authorization.sql)
 *   returns the STORED row, and only to the caller who created it — or to
 *   staff and the service role. The wording in the email is therefore always
 *   the wording recorded in vd_notifications, which is auditable and rate
 *   limited at insert time by the same migration.
 *
 *   The recipient's address is still resolved with the admin client and never
 *   returned to the caller.
 */

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

type StoredNotification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link: string | null
}

export async function POST(req: Request) {
  let payload: { notificationId?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!payload.notificationId) {
    return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Runs under the caller's session on purpose: the RPC decides, from
  // vd_notifications.created_by, whether this caller is entitled to have this
  // notification emailed. A row somebody else raised comes back null.
  const { data } = await supabase.rpc('vd_notification_for_email', { p_id: payload.notificationId })
  const notification = data as StoredNotification | null
  if (!notification) {
    return NextResponse.json({ sent: false, error: 'notification not found' }, { status: 404 })
  }

  const { data: profile } = await supabaseAdmin()
    .from('profiles').select('email, full_name').eq('id', notification.user_id).maybeSingle()
  if (!profile?.email) return NextResponse.json({ sent: false, error: 'recipient has no email on file' })

  const origin = getSiteOrigin(req)
  // The stored link is a site-relative path written by our own code, but it is
  // still concatenated onto an origin and put in front of a human — validate
  // it like any other redirect target rather than trusting the column.
  const link = notification.link && safeRedirectPath(notification.link, '') !== ''
    ? `${origin}${notification.link}`
    : null

  const { sent, error } = await sendMail({
    to: profile.email,
    subject: notification.title,
    html: emailHtml({
      title: notification.title,
      body: notification.body,
      link,
      name: profile.full_name,
      origin,
    }),
  })

  return NextResponse.json({ sent, error })
}
