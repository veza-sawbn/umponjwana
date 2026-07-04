import { supabase } from './auth'
import { notify } from './notifications'

export type ThreadMessage = {
  id: string
  from: 'visitor' | 'supplier'
  senderName: string
  body: string
  createdAt: string
}

export type MessageThread = {
  id: string
  bookingId: string
  bookingRef: string
  customerUserId: string
  customerName: string
  customerEmail: string
  supplierId: string
  supplierName: string
  addonTitle: string
  messages: ThreadMessage[]
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  booking_id: string
  customer_user_id: string | null
  supplier_id: string | null
  value: Record<string, unknown>
  created_at: string
  updated_at: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function rowToThread(r: Row): MessageThread {
  return {
    ...(r.value as unknown as MessageThread),
    id: r.id,
    bookingId: r.booking_id,
    customerUserId: r.customer_user_id ?? (r.value as any).customerUserId ?? '',
    supplierId: r.supplier_id ?? (r.value as any).supplierId ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// RLS restricts rows to threads the caller participates in.
export async function getThreadsByBooking(bookingId: string): Promise<MessageThread[]> {
  try {
    const { data } = await supabase
      .from('vd_message_threads')
      .select('*')
      .eq('booking_id', bookingId)
    if (Array.isArray(data)) return (data as Row[]).map(rowToThread)
  } catch {}
  return []
}

export async function getThreadsBySupplier(supplierId: string, _fallbackNames?: string[]): Promise<MessageThread[]> {
  try {
    const { data } = await supabase
      .from('vd_message_threads')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('updated_at', { ascending: false })
    if (Array.isArray(data)) return (data as Row[]).map(rowToThread)
  } catch {}
  return []
}

export async function getOrCreateThread(
  bookingId: string,
  bookingRef: string,
  customerUserId: string,
  customerName: string,
  customerEmail: string,
  supplierId: string,
  supplierName: string,
  addonTitle: string,
): Promise<MessageThread> {
  const existing = (await getThreadsByBooking(bookingId)).find(t => t.addonTitle === addonTitle)
  if (existing) {
    // Backfill supplier linkage on legacy threads so the supplier can see them.
    if (!existing.supplierId && supplierId && UUID_RE.test(supplierId)) {
      const value = { ...existing, supplierId, supplierName }
      await supabase
        .from('vd_message_threads')
        .update({ supplier_id: supplierId, value })
        .eq('id', existing.id)
      return value
    }
    return existing
  }

  const now = new Date().toISOString()
  const thread: MessageThread = {
    id: `thr-${crypto.randomUUID()}`,
    bookingId,
    bookingRef,
    customerUserId,
    customerName,
    customerEmail,
    supplierId,
    supplierName,
    addonTitle,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  const { error } = await supabase.from('vd_message_threads').insert({
    id: thread.id,
    booking_id: bookingId,
    customer_user_id: UUID_RE.test(customerUserId) ? customerUserId : null,
    supplier_id: UUID_RE.test(supplierId) ? supplierId : null,
    value: thread,
  })
  if (error) throw error
  return thread
}

export async function sendMessage(
  threadId: string,
  from: 'visitor' | 'supplier',
  senderName: string,
  body: string,
): Promise<MessageThread | null> {
  const { data } = await supabase.from('vd_message_threads').select('*').eq('id', threadId).maybeSingle()
  if (!data) return null
  const thread = rowToThread(data as Row)
  const msg: ThreadMessage = {
    id: `msg-${crypto.randomUUID()}`,
    from,
    senderName,
    body,
    createdAt: new Date().toISOString(),
  }
  const updated: MessageThread = {
    ...thread,
    messages: [...thread.messages, msg],
    updatedAt: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('vd_message_threads')
    .update({ value: updated, updated_at: updated.updatedAt })
    .eq('id', threadId)
  if (error) return null

  // Ping the other participant.
  const recipient = from === 'visitor' ? thread.supplierId : thread.customerUserId
  if (recipient && UUID_RE.test(recipient)) {
    await notify(recipient, 'message', `New message — ${thread.addonTitle || thread.bookingRef}`,
      `${senderName}: ${body.slice(0, 120)}`,
      from === 'visitor' ? '/supplier/messages' : '/account/itinerary')
  }
  return updated
}
