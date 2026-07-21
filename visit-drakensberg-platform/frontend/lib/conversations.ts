import { supabase } from './auth'
import { notify } from './notifications'
import { getAllThreads, type MessageThread, type ThreadMessage } from './messages'
import { getChannel, sendViaChannel, type ChannelId } from './channels'

/* ────────────────────────────────────────────────────────────────────────────
 * Communications Hub — conversation layer.
 *
 * A "conversation" is a message thread (vd_message_threads) enriched with Hub
 * metadata — channel, lead stage, assignment, tags, internal notes, tasks and
 * a permanent timeline. All Hub metadata is stored additively inside the
 * thread's JSON `value` (RLS already restricts these rows to participants +
 * admins), so no schema migration is required. Standalone enquiries that
 * aren't tied to a booking yet are stored as threads with a synthetic
 * `enq-*` booking id.
 * ──────────────────────────────────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type LeadStage =
  | 'new' | 'qualified' | 'quote_sent' | 'negotiating' | 'awaiting_deposit'
  | 'deposit_paid' | 'confirmed' | 'in_progress' | 'completed' | 'lost' | 'cancelled'

export const LEAD_STAGES: { id: LeadStage; label: string; color: string; won?: boolean; lost?: boolean }[] = [
  { id: 'new', label: 'New Enquiry', color: '#6b7280' },
  { id: 'qualified', label: 'Qualified', color: '#0ea5e9' },
  { id: 'quote_sent', label: 'Quotation Sent', color: '#6366f1' },
  { id: 'negotiating', label: 'Negotiating', color: '#a855f7' },
  { id: 'awaiting_deposit', label: 'Awaiting Deposit', color: '#f59e0b' },
  { id: 'deposit_paid', label: 'Deposit Paid', color: '#C9A96E' },
  { id: 'confirmed', label: 'Confirmed', color: '#2d6a4f' },
  { id: 'in_progress', label: 'In Progress', color: '#0d9488' },
  { id: 'completed', label: 'Completed', color: '#16a34a', won: true },
  { id: 'lost', label: 'Lost', color: '#dc2626', lost: true },
  { id: 'cancelled', label: 'Cancelled', color: '#991b1b', lost: true },
]

export function stageMeta(id: string) {
  return LEAD_STAGES.find(s => s.id === id) ?? LEAD_STAGES[0]
}

export type InternalNote = { id: string; author: string; body: string; createdAt: string; priority?: boolean }
export type HubTask = { id: string; title: string; done: boolean; dueDate?: string; assignee?: string; createdAt: string; createdBy: string }
export type TimelineEvent = { id: string; type: string; label: string; detail?: string; createdAt: string; actor?: string; href?: string }

export type ConversationHub = {
  channel: ChannelId
  leadStage: LeadStage
  leadStageAt?: string
  assignedTo?: string
  assignedName?: string
  tags: string[]
  archived: boolean
  unreadForStaff: boolean
  customerPhone?: string
  lostReason?: string
}

export type Conversation = MessageThread & {
  hub: ConversationHub
  notes: InternalNote[]
  tasks: HubTask[]
  events: TimelineEvent[]
}

function defaultHub(v: any): ConversationHub {
  const h = v?.hub ?? {}
  return {
    channel: h.channel ?? (v?.bookingId?.startsWith?.('enq-') ? 'website-chat' : 'website-chat'),
    leadStage: h.leadStage ?? 'new',
    leadStageAt: h.leadStageAt,
    assignedTo: h.assignedTo,
    assignedName: h.assignedName,
    tags: Array.isArray(h.tags) ? h.tags : [],
    archived: Boolean(h.archived),
    unreadForStaff: h.unreadForStaff ?? false,
    customerPhone: h.customerPhone ?? v?.customerPhone,
    lostReason: h.lostReason,
  }
}

function toConversation(t: MessageThread): Conversation {
  const v = t as any
  return {
    ...t,
    hub: defaultHub(v),
    notes: Array.isArray(v.notes) ? v.notes : [],
    tasks: Array.isArray(v.tasks) ? v.tasks : [],
    events: Array.isArray(v.events) ? v.events : [],
  }
}

const uid = (p: string) => `${p}-${crypto.randomUUID()}`
const now = () => new Date().toISOString()

export async function getConversations(): Promise<Conversation[]> {
  const threads = await getAllThreads()
  return threads.map(toConversation)
}

/** Load a single conversation row and mutate its JSON value atomically-ish
 *  (read → mutate → write). Returns the updated Conversation. */
async function patchValue(id: string, mutate: (c: Conversation) => Conversation): Promise<Conversation | null> {
  const { data } = await supabase.from('vd_message_threads').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const current = toConversation({
    ...(data.value as any),
    id: data.id,
    bookingId: data.booking_id,
    supplierId: data.supplier_id ?? (data.value as any).supplierId ?? '',
    customerUserId: data.customer_user_id ?? (data.value as any).customerUserId ?? '',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as MessageThread)
  const next = mutate(current)
  const value = { ...next, updatedAt: now() }
  const { error } = await supabase
    .from('vd_message_threads')
    .update({ value, updated_at: value.updatedAt })
    .eq('id', id)
  if (error) throw error
  return value
}

/* ── Enquiries / leads not yet tied to a booking ─────────────────────────── */

export async function createEnquiry(input: {
  channel: ChannelId
  customerName: string
  customerEmail: string
  customerPhone?: string
  subject?: string
  firstMessage?: string
  assignedTo?: string
  assignedName?: string
}): Promise<Conversation> {
  const id = uid('thr')
  const bookingId = uid('enq')
  const ts = now()
  const messages: ThreadMessage[] = input.firstMessage
    ? [{ id: uid('msg'), from: 'visitor', senderName: input.customerName || 'Customer', body: input.firstMessage, createdAt: ts }]
    : []
  const events: TimelineEvent[] = [{ id: uid('evt'), type: 'enquiry', label: 'Enquiry received', detail: getChannel(input.channel).label, createdAt: ts }]
  const value: Conversation = {
    id, bookingId, bookingRef: '', customerUserId: '', customerName: input.customerName,
    customerEmail: input.customerEmail, supplierId: '', supplierName: '',
    addonTitle: input.subject || 'New enquiry', messages, createdAt: ts, updatedAt: ts,
    hub: {
      channel: input.channel, leadStage: 'new', leadStageAt: ts,
      assignedTo: input.assignedTo, assignedName: input.assignedName,
      tags: [], archived: false, unreadForStaff: Boolean(input.firstMessage), customerPhone: input.customerPhone,
    },
    notes: [], tasks: [], events,
  }
  const { error } = await supabase.from('vd_message_threads').insert({
    id, booking_id: bookingId, customer_user_id: null, supplier_id: null, value,
  })
  if (error) throw error
  return value
}

/* ── Messaging ───────────────────────────────────────────────────────────── */

/** Staff reply, routed through the conversation's (or overridden) channel. */
export async function sendReply(conv: Conversation, staffName: string, body: string, channelId?: ChannelId): Promise<Conversation | null> {
  const channel = channelId ?? conv.hub.channel
  // External adapters throw until connected; internal ones resolve.
  await sendViaChannel(channel, {
    conversationId: conv.id,
    to: conv.hub.customerPhone || conv.customerEmail || '',
    body,
    senderName: staffName,
  })
  const updated = await patchValue(conv.id, c => ({
    ...c,
    messages: [...c.messages, { id: uid('msg'), from: 'supplier', senderName: staffName, body, createdAt: now() }],
    hub: { ...c.hub, unreadForStaff: false, channel },
  }))
  if (updated && conv.customerUserId && UUID_RE.test(conv.customerUserId)) {
    await notify(conv.customerUserId, 'message', `Message from Visit Drakensberg`, `${staffName}: ${body.slice(0, 120)}`, '/account/itinerary')
  }
  return updated
}

/** Log an inbound customer message (webhook / manual capture). */
export async function recordInbound(id: string, senderName: string, body: string): Promise<Conversation | null> {
  return patchValue(id, c => ({
    ...c,
    messages: [...c.messages, { id: uid('msg'), from: 'visitor', senderName, body, createdAt: now() }],
    hub: { ...c.hub, unreadForStaff: true },
  }))
}

export async function markRead(id: string): Promise<Conversation | null> {
  return patchValue(id, c => ({ ...c, hub: { ...c.hub, unreadForStaff: false } }))
}

/* ── Pipeline / assignment / tags / archive ──────────────────────────────── */

export async function setLeadStage(id: string, stage: LeadStage, actor: string, lostReason?: string): Promise<Conversation | null> {
  return patchValue(id, c => ({
    ...c,
    hub: { ...c.hub, leadStage: stage, leadStageAt: now(), lostReason: lostReason ?? c.hub.lostReason },
    events: [...c.events, { id: uid('evt'), type: 'stage', label: `Stage → ${stageMeta(stage).label}`, detail: lostReason, createdAt: now(), actor }],
  }))
}

export async function assignConversation(id: string, userId: string | undefined, name: string | undefined, actor: string): Promise<Conversation | null> {
  const updated = await patchValue(id, c => ({
    ...c,
    hub: { ...c.hub, assignedTo: userId, assignedName: name },
    events: [...c.events, { id: uid('evt'), type: 'assign', label: name ? `Assigned to ${name}` : 'Unassigned', createdAt: now(), actor }],
  }))
  if (updated && userId && UUID_RE.test(userId)) {
    await notify(userId, 'info', 'Conversation assigned to you', `${updated.customerName || 'A customer'} — ${updated.addonTitle}`, '/admin/messages')
  }
  return updated
}

export async function setTags(id: string, tags: string[]): Promise<Conversation | null> {
  return patchValue(id, c => ({ ...c, hub: { ...c.hub, tags } }))
}

export async function toggleArchive(id: string): Promise<Conversation | null> {
  return patchValue(id, c => ({ ...c, hub: { ...c.hub, archived: !c.hub.archived } }))
}

/* ── Internal notes ──────────────────────────────────────────────────────── */

export async function addInternalNote(id: string, author: string, body: string, priority?: boolean): Promise<Conversation | null> {
  return patchValue(id, c => ({
    ...c,
    notes: [...c.notes, { id: uid('note'), author, body, createdAt: now(), priority }],
  }))
}

/* ── Tasks ───────────────────────────────────────────────────────────────── */

export async function addTask(id: string, title: string, createdBy: string, dueDate?: string, assignee?: string): Promise<Conversation | null> {
  return patchValue(id, c => ({
    ...c,
    tasks: [...c.tasks, { id: uid('task'), title, done: false, dueDate, assignee, createdAt: now(), createdBy }],
    events: [...c.events, { id: uid('evt'), type: 'task', label: `Task: ${title}`, createdAt: now(), actor: createdBy }],
  }))
}

export async function toggleTask(id: string, taskId: string): Promise<Conversation | null> {
  return patchValue(id, c => ({
    ...c,
    tasks: c.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t),
  }))
}

export async function deleteTask(id: string, taskId: string): Promise<Conversation | null> {
  return patchValue(id, c => ({ ...c, tasks: c.tasks.filter(t => t.id !== taskId) }))
}

/* ── Timeline events (quote/invoice/booking actions logged from the UI) ──── */

export async function logEvent(id: string, type: string, label: string, actor: string, detail?: string, href?: string): Promise<Conversation | null> {
  return patchValue(id, c => ({
    ...c,
    events: [...c.events, { id: uid('evt'), type, label, detail, href, createdAt: now(), actor }],
  }))
}

export function setChannel(id: string, channel: ChannelId): Promise<Conversation | null> {
  return patchValue(id, c => ({ ...c, hub: { ...c.hub, channel } }))
}
