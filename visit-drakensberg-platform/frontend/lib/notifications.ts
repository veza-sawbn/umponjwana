import { supabase } from './auth'

export type Notification = {
  id: string
  userId: string
  // 'payment' rows are written directly (app/api/receipts/send, the iKhokha
  // webhook, and vd_notify_finance_online_payment) rather than through
  // notify() below, since those callers run without a customer session.
  type: 'booking' | 'cancellation' | 'message' | 'approval' | 'info' | 'payment'
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
}

type Row = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

function rowToNotification(r: Row): Notification {
  return {
    id: r.id,
    userId: r.user_id,
    type: (r.type as Notification['type']) || 'info',
    title: r.title,
    body: r.body,
    link: r.link,
    read: r.read,
    createdAt: r.created_at,
  }
}

// Notify another user (e.g. booking events target the supplier). Failures are
// swallowed — a notification must never break the flow that triggered it.
export async function notify(
  userId: string,
  type: Notification['type'],
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  if (!userId) return

  let notificationId: string | null = null
  try {
    const { data } = await supabase.from('vd_notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      link: link ?? null,
    }).select('id').maybeSingle()
    notificationId = (data as { id: string } | null)?.id ?? null
  } catch {}

  // Mirror the in-app notification by email, fire-and-forget, so suppliers
  // and customers hear about it without having to be signed in. Skipped
  // gracefully if SMTP isn't configured or the recipient has no email on
  // file — see app/api/notifications/email.
  //
  // Only the id travels. The route reads the stored row and mails THAT, so
  // nobody can have us send wording that was never recorded — which is what
  // the old {userId, title, body, link} payload allowed (audit finding H5).
  // No id means the insert was refused (rate limit, or no session), and there
  // is nothing legitimate to email.
  if (notificationId && typeof fetch === 'function') {
    fetch('/api/notifications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    }).catch(() => {})
  }
}

export async function getMyNotifications(limit = 30): Promise<Notification[]> {
  try {
    const { data } = await supabase
      .from('vd_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (Array.isArray(data)) return (data as Row[]).map(rowToNotification)
  } catch {}
  return []
}

export async function getUnreadCount(): Promise<number> {
  try {
    const { count } = await supabase
      .from('vd_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
    return count ?? 0
  } catch {
    return 0
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await supabase.from('vd_notifications').update({ read: true }).eq('id', id)
  } catch {}
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await supabase.from('vd_notifications').update({ read: true }).eq('read', false)
  } catch {}
}
