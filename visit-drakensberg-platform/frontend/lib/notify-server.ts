import { supabaseAdmin } from './supabase-admin'
import { sendMail } from './mailer'
import { emailShell, ctaButton, esc, getFeaturedExperiences } from './email-layout'

// SERVER ONLY — only ever import from app/api/*/route.ts handlers.
//
// The server-side twin of notify() in lib/notifications.ts.
//
// notify() cannot be used from a route handler, for two reasons that are easy
// to miss because it fails silently:
//
//   1. It mirrors the notification by email through `fetch('/api/notifications
//      /email')` — a RELATIVE url. That resolves against the page origin in a
//      browser and against nothing at all in a Node serverless function.
//   2. That route authenticates with createRouteHandlerClient({ cookies }) and
//      refuses without a session, which a server-to-server call does not have.
//
// So every route handler that wanted to notify somebody wrote its own
// `from('vd_notifications').insert(...)` instead. Those inserts work — the
// bell shows the notification — but no email is ever sent, which is why
// approvals, invoices, receipts and payment webhooks were recorded and never
// delivered.
//
// This does both, in-process: the row, then the mail, with no HTTP hop and no
// session to satisfy. Failures never throw — a notification that cannot be
// delivered must not roll back the thing it is announcing.

export type ServerNotificationType = 'approval' | 'booking' | 'cancellation' | 'info' | 'payment'

export type ServerNotification = {
  userId: string
  type: ServerNotificationType
  title: string
  body: string
  /** Site-relative path, e.g. '/supplier'. Made absolute for the email. */
  link?: string | null
  /** Skip the email and only record the row (rare — say why at the call site). */
  inAppOnly?: boolean
}

export type NotifyResult = { recorded: boolean; emailed: boolean; error: string | null }

function notificationHtml(o: {
  title: string
  body: string
  link: string | null
  name: string | null
  origin: string
  featured: Awaited<ReturnType<typeof getFeaturedExperiences>>
}) {
  return emailShell({
    origin: o.origin,
    heading: o.title,
    preheader: o.body.slice(0, 140),
    featured: o.featured,
    bodyHtml: `
      <p style="margin:0 0 4px;">Dear ${esc(o.name || 'there')},</p>
      <p style="margin:0 0 20px;white-space:pre-wrap;">${esc(o.body)}</p>
      ${o.link ? ctaButton(o.link, 'View details') : ''}`,
  })
}

/**
 * Record an in-app notification and email it.
 *
 * `origin` should come from the request (getSiteOrigin(req)) so links in the
 * email point at the deployment that sent them rather than a build-time env
 * var that may be wrong on a preview deploy.
 */
export async function notifyServer(n: ServerNotification, origin: string): Promise<NotifyResult> {
  if (!n.userId) return { recorded: false, emailed: false, error: 'no recipient' }

  const admin = supabaseAdmin()
  const result: NotifyResult = { recorded: false, emailed: false, error: null }

  const { error: insertError } = await admin.from('vd_notifications').insert({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
  })
  if (insertError) {
    result.error = insertError.message
    console.error('[notify-server] row not recorded:', insertError.message)
  } else {
    result.recorded = true
  }

  if (n.inAppOnly) return result

  try {
    const { data: profile } = await admin
      .from('profiles').select('email, full_name').eq('id', n.userId).maybeSingle()

    if (!profile?.email) {
      result.error = result.error ?? 'recipient has no email on file'
      return result
    }

    const featured = await getFeaturedExperiences(origin)
    const { sent, error } = await sendMail({
      to: profile.email,
      subject: n.title,
      html: notificationHtml({
        title: n.title,
        body: n.body,
        link: n.link ? `${origin}${n.link}` : null,
        name: profile.full_name,
        origin,
        featured,
      }),
    })
    result.emailed = sent
    // 'SMTP not configured' is an expected state in local and preview
    // environments, not a fault worth logging on every notification.
    if (!sent && error && error !== 'SMTP not configured') {
      result.error = error
      console.error('[notify-server] email not sent:', error)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'email failed'
    result.error = message
    console.error('[notify-server] email threw:', message)
  }

  return result
}

/** Notify several people about the same thing. Never throws. */
export async function notifyServerMany(
  recipients: string[],
  n: Omit<ServerNotification, 'userId'>,
  origin: string,
): Promise<NotifyResult[]> {
  return Promise.all(recipients.map(userId => notifyServer({ ...n, userId }, origin)))
}
