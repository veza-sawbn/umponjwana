import { supabase } from './auth'

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

async function getThreads(): Promise<MessageThread[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'message_threads')
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) {
      return data.value.items as MessageThread[]
    }
  } catch {}
  return []
}

async function saveThreads(threads: MessageThread[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'message_threads', value: { items: threads }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

export async function getThreadsByBooking(bookingId: string): Promise<MessageThread[]> {
  const all = await getThreads()
  return all.filter(t => t.bookingId === bookingId)
}

export async function getThreadsBySupplier(supplierId: string): Promise<MessageThread[]> {
  const all = await getThreads()
  return all.filter(t => t.supplierId === supplierId)
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
  const all = await getThreads()
  const existing = all.find(
    t => t.bookingId === bookingId && t.supplierId === supplierId && t.addonTitle === addonTitle
  )
  if (existing) return existing
  const now = new Date().toISOString()
  const thread: MessageThread = {
    id: `thr-${Date.now()}`,
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
  await saveThreads([...all, thread])
  return thread
}

export async function sendMessage(
  threadId: string,
  from: 'visitor' | 'supplier',
  senderName: string,
  body: string,
): Promise<MessageThread | null> {
  const all = await getThreads()
  const thread = all.find(t => t.id === threadId)
  if (!thread) return null
  const msg: ThreadMessage = {
    id: `msg-${Date.now()}`,
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
  await saveThreads(all.map(t => t.id === threadId ? updated : t))
  return updated
}
