'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  RefreshCw, MessageSquare, Send, Inbox, Search, Plus, X, Sparkles, StickyNote,
  User, ListChecks, Clock, Zap, CircleDollarSign, Archive, Check, Loader2,
  Phone, Mail, MapPin, ChevronDown, AlertTriangle, FileText, Receipt,
  Package, CreditCard, MessageCircle, Facebook, Instagram, Music2, Smartphone, UserPlus, Plug,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import {
  getConversations, createEnquiry, sendReply, markRead, setLeadStage, assignConversation,
  addInternalNote, addTask, toggleTask, deleteTask, toggleArchive, logEvent, setChannel,
  LEAD_STAGES, stageMeta, type Conversation, type LeadStage,
} from '@/lib/conversations'
import { CHANNEL_LIST, getChannel, type ChannelId } from '@/lib/channels'
import { getConnectionStatuses } from '@/lib/channel-connections'
import { getMessageTemplates, applyTemplate, type MessageTemplate } from '@/lib/message-templates'
import { buildCustomerProfile, type CustomerProfile } from '@/lib/crm'
import { assist, type AssistResult } from '@/lib/hub-assistant'
import { getOrders, type MasterOrder } from '@/lib/orders'
import { formatMoney } from '@/lib/allocation'

/* ── Channel icon resolution ──────────────────────────────────────────────── */
const CHANNEL_ICONS: Record<string, any> = {
  MessageSquare, Inbox, Phone, MessageCircle, Facebook, Instagram, Music2, Mail, Smartphone,
}
function ChannelBadge({ id, small }: { id: ChannelId; small?: boolean }) {
  const ch = getChannel(id)
  const Icon = CHANNEL_ICONS[ch.icon] ?? MessageSquare
  return (
    <span className="inline-flex items-center gap-1 font-sans" style={{ color: ch.color }} title={ch.label}>
      <Icon size={small ? 11 : 13} />
      {!small && <span className="text-[10px]">{ch.label}</span>}
    </span>
  )
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function fmtTime(iso: string) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

const isEnquiry = (c: Conversation) => c.bookingId?.startsWith('enq-')
const lastMsg = (c: Conversation) => c.messages[c.messages.length - 1]
const awaitingReply = (c: Conversation) => { const m = lastMsg(c); return !!m && m.from === 'visitor' }

type FolderId = 'all' | 'unread' | 'mine' | 'leads' | 'active' | 'awaiting' | 'bookings' | 'payments' | 'completed' | 'archived'

const LEAD_STAGE_IDS: LeadStage[] = ['new', 'qualified', 'quote_sent', 'negotiating']
const ACTIVE_STAGE_IDS: LeadStage[] = ['confirmed', 'in_progress']
const BOOKING_STAGE_IDS: LeadStage[] = ['awaiting_deposit', 'deposit_paid', 'confirmed', 'in_progress']

export default function AdminMessagesHub() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [orders, setOrders] = useState<MasterOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [folder, setFolder] = useState<FolderId>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelId | 'all'>('all')
  const [search, setSearch] = useState('')

  const [me, setMe] = useState<{ id: string; name: string; role?: string; staffRole?: string } | null>(null)
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [connStatuses, setConnStatuses] = useState<Record<string, boolean>>({})
  // A channel can be used when it's a built-in adapter or has been connected in settings.
  const channelConnected = useCallback((id: ChannelId) => getChannel(id).connected || Boolean(connStatuses[id]), [connStatuses])

  const [body, setBody] = useState('')
  const [noteMode, setNoteMode] = useState(false)
  const [replyChannel, setReplyChannel] = useState<ChannelId | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [tplOpen, setTplOpen] = useState(false)

  const [rightTab, setRightTab] = useState<'customer' | 'pipeline' | 'tasks' | 'timeline' | 'actions' | 'ai'>('customer')
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [ai, setAi] = useState<AssistResult | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [note, setNote] = useState('')
  const [showNew, setShowNew] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const [convs, tpls, ords] = await Promise.all([
        getConversations(),
        getMessageTemplates().catch(() => []),
        getOrders().catch(() => [] as MasterOrder[]),
      ])
      setConversations(convs)
      setTemplates(tpls)
      setOrders(ords)
    } catch (e: any) { setError(e?.message || 'Could not load conversations.') }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      if (!u) return
      const { data: p } = await supabase.from('profiles').select('full_name, role, staff_role').eq('id', u.id).maybeSingle()
      setMe({ id: u.id, name: (p as any)?.full_name || u.email?.split('@')[0] || 'Consultant', role: (p as any)?.role, staffRole: (p as any)?.staff_role })
      const { data: admins } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'admin')
      setStaff((admins ?? []).map((a: any) => ({ id: a.id, name: a.full_name || a.email || 'Staff' })))
    })
    getConnectionStatuses().then(setConnStatuses).catch(() => {})
    load()
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [load])

  const selected = conversations.find(c => c.id === selectedId) ?? null

  // email → outstanding, for the Payments folder + list badges.
  const outstandingByEmail = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) {
      const k = (o.customer_email || '').toLowerCase()
      if (!k) continue
      map.set(k, (map.get(k) ?? 0) + (o.outstanding_balance || 0))
    }
    return map
  }, [orders])
  const outstandingFor = (c: Conversation) => outstandingByEmail.get((c.customerEmail || '').toLowerCase()) ?? 0

  /* ── Folder filtering ── */
  const folderMatch = useCallback((c: Conversation): boolean => {
    switch (folder) {
      case 'all': return !c.hub.archived
      case 'unread': return c.hub.unreadForStaff && !c.hub.archived
      case 'mine': return c.hub.assignedTo === me?.id && !c.hub.archived
      case 'leads': return LEAD_STAGE_IDS.includes(c.hub.leadStage) && !c.hub.archived
      case 'active': return (ACTIVE_STAGE_IDS.includes(c.hub.leadStage) || !isEnquiry(c)) && !c.hub.archived
      case 'awaiting': return awaitingReply(c) && !c.hub.archived
      case 'bookings': return BOOKING_STAGE_IDS.includes(c.hub.leadStage) && !c.hub.archived
      case 'payments': return outstandingFor(c) > 0 && !c.hub.archived
      case 'completed': return c.hub.leadStage === 'completed' && !c.hub.archived
      case 'archived': return c.hub.archived
    }
  }, [folder, me, outstandingByEmail])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return conversations.filter(c => {
      if (!folderMatch(c)) return false
      if (channelFilter !== 'all' && c.hub.channel !== channelFilter) return false
      if (!q) return true
      return [c.customerName, c.customerEmail, c.hub.customerPhone, c.bookingRef, c.addonTitle, ...c.hub.tags]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    })
  }, [conversations, folderMatch, channelFilter, search])

  const count = useCallback((f: FolderId) => {
    const prev = folder
    // cheap per-folder count without recomputing folderMatch closure state
    return conversations.filter(c => {
      switch (f) {
        case 'all': return !c.hub.archived
        case 'unread': return c.hub.unreadForStaff && !c.hub.archived
        case 'mine': return c.hub.assignedTo === me?.id && !c.hub.archived
        case 'leads': return LEAD_STAGE_IDS.includes(c.hub.leadStage) && !c.hub.archived
        case 'active': return (ACTIVE_STAGE_IDS.includes(c.hub.leadStage) || !isEnquiry(c)) && !c.hub.archived
        case 'awaiting': return awaitingReply(c) && !c.hub.archived
        case 'bookings': return BOOKING_STAGE_IDS.includes(c.hub.leadStage) && !c.hub.archived
        case 'payments': return outstandingFor(c) > 0 && !c.hub.archived
        case 'completed': return c.hub.leadStage === 'completed' && !c.hub.archived
        case 'archived': return c.hub.archived
      }
    }).length
    void prev
  }, [conversations, me, outstandingByEmail])

  /* ── Selection side-effects: mark read, load CRM ── */
  useEffect(() => {
    if (!selected) { setProfile(null); setAi(null); return }
    setReplyChannel(selected.hub.channel)
    setAi(null)
    if (selected.hub.unreadForStaff) {
      markRead(selected.id).then(() => setConversations(cs => cs.map(c => c.id === selected.id ? { ...c, hub: { ...c.hub, unreadForStaff: false } } : c)))
    }
    setProfileLoading(true)
    buildCustomerProfile(selected.customerEmail, selected.customerName, selected.hub.customerPhone)
      .then(setProfile).catch(() => setProfile(null)).finally(() => setProfileLoading(false))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selected?.messages.length, selectedId])

  function patchLocal(updated: Conversation | null) {
    if (updated) setConversations(cs => cs.map(c => c.id === updated.id ? updated : c))
  }

  /* ── Actions ── */
  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || !selected || !me) return
    setSending(true); setError('')
    try {
      if (noteMode) {
        patchLocal(await addInternalNote(selected.id, me.name, trimmed, false))
      } else {
        patchLocal(await sendReply(selected, me.name, trimmed, replyChannel ?? undefined))
      }
      setBody('')
    } catch (e: any) {
      setError(e?.message || 'Could not send.')
    } finally { setSending(false) }
  }

  function insertTemplate(t: MessageTemplate) {
    const vars: Record<string, string> = {
      FirstName: (selected?.customerName || '').split(' ')[0] || 'there',
      CustomerName: selected?.customerName || '',
      ConsultantName: me?.name || '',
      Destination: profile?.regionsVisited[0] || 'the Drakensberg',
      OutstandingBalance: profile ? formatMoney(profile.outstandingBalance) : '',
      BookingReference: selected?.bookingRef || '',
      TotalValue: profile ? formatMoney(profile.lifetimeSpend) : '',
    }
    setBody(b => (b ? b + '\n\n' : '') + applyTemplate(t.body, vars))
    setTplOpen(false)
  }

  function runAssist() {
    if (!selected || !me) return
    setAiBusy(true)
    // On-device assist (deterministic). Seam for a real LLM route.
    setTimeout(() => {
      setAi(assist(selected, profile, me.name, templates))
      setAiBusy(false)
      setRightTab('ai')
    }, 200)
  }

  async function changeStage(stage: LeadStage) {
    if (!selected || !me) return
    patchLocal(await setLeadStage(selected.id, stage, me.name))
  }
  async function assign(userId?: string, name?: string) {
    if (!selected || !me) return
    patchLocal(await assignConversation(selected.id, userId, name, me.name))
  }
  async function doTask() {
    if (!selected || !me || !newTask.trim()) return
    patchLocal(await addTask(selected.id, newTask.trim(), me.name))
    setNewTask('')
  }
  async function doNote() {
    if (!selected || !me || !note.trim()) return
    patchLocal(await addInternalNote(selected.id, me.name, note.trim(), false))
    setNote('')
  }
  async function action(type: string, label: string, href: string) {
    if (!selected || !me) return
    patchLocal(await logEvent(selected.id, type, label, me.name, undefined, href))
    window.open(href, '_blank')
  }

  /* ── Analytics strip ── */
  const stats = useMemo(() => {
    const active = conversations.filter(c => !c.hub.archived)
    const leads = active.filter(c => LEAD_STAGE_IDS.includes(c.hub.leadStage))
    const won = active.filter(c => c.hub.leadStage === 'completed')
    const lost = active.filter(c => c.hub.leadStage === 'lost' || c.hub.leadStage === 'cancelled')
    const decided = won.length + lost.length
    return {
      total: active.length,
      leads: leads.length,
      awaiting: active.filter(awaitingReply).length,
      conversion: decided ? Math.round((won.length / decided) * 100) : 0,
      revenue: orders.reduce((s, o) => s + (o.amount_paid || 0), 0),
    }
  }, [conversations, orders])

  const FOLDERS: { id: FolderId; label: string; icon: any }[] = [
    { id: 'all', label: 'All Conversations', icon: Inbox },
    { id: 'unread', label: 'Unread', icon: MessageSquare },
    { id: 'mine', label: 'Assigned to Me', icon: User },
    { id: 'leads', label: 'Leads', icon: Zap },
    { id: 'active', label: 'Active Customers', icon: Check },
    { id: 'awaiting', label: 'Awaiting Reply', icon: Clock },
    { id: 'bookings', label: 'Bookings in Progress', icon: ListChecks },
    { id: 'payments', label: 'Payments Outstanding', icon: CircleDollarSign },
    { id: 'completed', label: 'Completed Trips', icon: Check },
    { id: 'archived', label: 'Archived', icon: Archive },
  ]

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header + analytics */}
      <div className="px-6 pt-5 pb-3 shrink-0 border-b border-white/8">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30 mb-1">Communications Hub</p>
            <h1 className="font-display italic text-2xl text-white">Inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#0a0a0a] px-4 py-2 font-sans text-sm font-semibold hover:bg-[#C9A96E]/90 transition-colors">
              <Plus size={15} /> New Enquiry
            </button>
            <button onClick={load} className="inline-flex items-center gap-2 border border-white/15 text-white/60 px-3 py-2 font-sans text-sm hover:text-white transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: 'Open', value: stats.total },
            { label: 'Leads', value: stats.leads },
            { label: 'Awaiting Reply', value: stats.awaiting },
            { label: 'Win Rate', value: `${stats.conversion}%` },
            { label: 'Revenue Collected', value: formatMoney(stats.revenue) },
          ].map(s => (
            <div key={s.label} className="bg-white/5 px-3 py-2">
              <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-white/30">{s.label}</p>
              <p className="font-sans text-lg text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-500/15 border-b border-red-500/30 px-6 py-2 font-sans text-xs text-red-300 shrink-0">{error}</div>}

      <div className="flex-1 min-h-0 flex">
        {/* ── Left: folders + list ── */}
        <div className="w-[340px] shrink-0 flex flex-col border-r border-white/8 bg-[#111]">
          {/* Folders */}
          <div className="p-2 border-b border-white/8 overflow-x-auto">
            <div className="flex lg:flex-wrap gap-1">
              {FOLDERS.map(f => {
                const Icon = f.icon
                const n = count(f.id)
                return (
                  <button key={f.id} onClick={() => setFolder(f.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-sans text-[11px] whitespace-nowrap transition-colors ${folder === f.id ? 'bg-[#C9A96E]/15 text-[#C9A96E]' : 'text-white/45 hover:text-white hover:bg-white/5'}`}>
                    <Icon size={12} /> {f.label}
                    {n > 0 && <span className={`ml-0.5 text-[9px] ${folder === f.id ? 'text-[#C9A96E]' : 'text-white/30'}`}>{n}</span>}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Search + channel filter */}
          <div className="p-2 border-b border-white/8 space-y-2">
            <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1.5">
              <Search size={13} className="text-white/30 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, phone, booking #…"
                className="flex-1 bg-transparent font-sans text-xs text-white placeholder:text-white/25 focus:outline-none" />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              <button onClick={() => setChannelFilter('all')} className={`px-2 py-1 font-sans text-[10px] whitespace-nowrap ${channelFilter === 'all' ? 'bg-white/10 text-white' : 'text-white/40'}`}>All channels</button>
              {CHANNEL_LIST.map(ch => {
                const Icon = CHANNEL_ICONS[ch.icon] ?? MessageSquare
                const on = channelConnected(ch.id)
                return (
                  <button key={ch.id} onClick={() => setChannelFilter(ch.id)} title={`${ch.label}${on ? '' : ' — not connected'}`}
                    className={`relative px-1.5 py-1 ${channelFilter === ch.id ? 'bg-white/10' : ''} ${on ? '' : 'opacity-45'}`} style={{ color: channelFilter === ch.id ? ch.color : 'rgba(255,255,255,0.35)' }}>
                    <Icon size={13} />
                  </button>
                )
              })}
              <Link href="/admin/settings/channels" title="Manage channels" className="ml-auto shrink-0 px-1.5 py-1 text-white/40 hover:text-[#C9A96E]"><Plug size={13} /></Link>
            </div>
          </div>
          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 text-white/20 animate-spin" /></div>}
            {!loading && visible.length === 0 && <p className="px-4 py-10 text-center font-sans text-xs text-white/30">No conversations here.</p>}
            {visible.map(c => {
              const st = stageMeta(c.hub.leadStage)
              const out = outstandingFor(c)
              return (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3.5 py-3 border-b border-white/5 transition-colors ${selectedId === c.id ? 'bg-[#C9A96E]/10 border-l-2 border-l-[#C9A96E]' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {c.hub.unreadForStaff && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] shrink-0" />}
                      <span className="font-sans text-sm font-medium text-white truncate">{c.customerName || 'Guest'}</span>
                    </span>
                    <span className="font-sans text-[10px] text-white/30 shrink-0">{fmtTime(c.updatedAt)}</span>
                  </div>
                  <p className="font-sans text-xs text-white/45 truncate mb-1.5">{lastMsg(c)?.body || c.addonTitle || 'New enquiry'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ChannelBadge id={c.hub.channel} small />
                    <span className="inline-flex items-center gap-1 font-sans text-[9px] px-1.5 py-0.5" style={{ color: st.color, background: st.color + '22' }}>{st.label}</span>
                    {awaitingReply(c) && <span className="font-sans text-[9px] text-[#C9A96E]">• reply due</span>}
                    {out > 0 && <span className="font-sans text-[9px] text-amber-400">{formatMoney(out)} due</span>}
                    {c.hub.assignedName && <span className="font-sans text-[9px] text-white/30">{c.hub.assignedName.split(' ')[0]}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Centre: conversation ── */}
        <div className="flex-1 min-w-0 flex flex-col bg-[#F7F5F2]">
          {selected ? (
            <>
              <div className="px-5 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-sans text-sm font-semibold text-gray-900 truncate">{selected.customerName || 'Guest'}</p>
                    <ChannelBadge id={selected.hub.channel} small />
                  </div>
                  <p className="font-sans text-xs text-gray-400 truncate">
                    {selected.customerEmail || 'no email'}{selected.hub.customerPhone ? ` · ${selected.hub.customerPhone}` : ''}
                    {selected.bookingRef ? ` · ${selected.bookingRef}` : isEnquiry(selected) ? ' · Enquiry' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={selected.hub.leadStage} onChange={e => changeStage(e.target.value as LeadStage)}
                    className="font-sans text-xs border border-gray-200 px-2 py-1.5 bg-white focus:outline-none">
                    {LEAD_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={() => toggleArchive(selected.id).then(patchLocal)} title="Archive"
                    className="p-1.5 text-gray-400 hover:text-gray-700"><Archive size={15} /></button>
                </div>
              </div>

              {/* Message timeline */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {selected.messages.length === 0 && selected.notes.length === 0 && (
                  <p className="font-sans text-xs text-gray-400 text-center pt-8">No messages yet. Send the first reply or log an internal note.</p>
                )}
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex ${m.from === 'supplier' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[72%] px-4 py-2.5 ${m.from === 'supplier' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                      <p className={`font-sans text-[10px] mb-1 ${m.from === 'supplier' ? 'text-white/60' : 'text-gray-400'}`}>{m.senderName}</p>
                      <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                      <p className={`font-sans text-[10px] mt-1 ${m.from === 'supplier' ? 'text-white/40' : 'text-gray-300'}`}>{fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {selected.notes.length > 0 && (
                  <div className="pt-2">
                    {selected.notes.map(n => (
                      <div key={n.id} className="mx-auto max-w-[80%] my-2 bg-amber-50 border border-amber-200 px-3 py-2">
                        <p className="font-sans text-[10px] text-amber-700 mb-0.5 flex items-center gap-1"><StickyNote size={10} /> Internal note · {n.author} · {fmtTime(n.createdAt)}</p>
                        <p className="font-sans text-sm text-amber-900 whitespace-pre-wrap">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-2 px-4 pt-2.5 flex-wrap">
                  <button onClick={() => setNoteMode(false)} className={`font-sans text-xs px-2.5 py-1 ${!noteMode ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 border border-gray-200'}`}>Reply</button>
                  <button onClick={() => setNoteMode(true)} className={`inline-flex items-center gap-1 font-sans text-xs px-2.5 py-1 ${noteMode ? 'bg-amber-500 text-white' : 'text-gray-500 border border-gray-200'}`}><StickyNote size={11} /> Internal note</button>
                  {!noteMode && (
                    <select value={replyChannel ?? selected.hub.channel} onChange={e => { setReplyChannel(e.target.value as ChannelId); setChannel(selected.id, e.target.value as ChannelId).then(patchLocal) }}
                      className="font-sans text-xs border border-gray-200 px-2 py-1 bg-white focus:outline-none">
                      {CHANNEL_LIST.map(ch => <option key={ch.id} value={ch.id} disabled={!channelConnected(ch.id)}>{ch.label}{channelConnected(ch.id) ? '' : ' (connect in settings)'}</option>)}
                    </select>
                  )}
                  <div className="relative">
                    <button onClick={() => setTplOpen(v => !v)} className="inline-flex items-center gap-1 font-sans text-xs px-2.5 py-1 text-gray-500 border border-gray-200"><FileText size={11} /> Templates <ChevronDown size={11} /></button>
                    {tplOpen && (
                      <div className="absolute bottom-full mb-1 left-0 w-64 max-h-72 overflow-y-auto bg-white border border-gray-200 shadow-lg z-20">
                        {templates.map(t => (
                          <button key={t.id} onClick={() => insertTemplate(t)} className="block w-full text-left px-3 py-2 hover:bg-[#F7F5F2] border-b border-gray-50">
                            <p className="font-sans text-xs font-medium text-gray-800">{t.name}</p>
                            <p className="font-sans text-[10px] text-gray-400 truncate">{t.body}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={runAssist} disabled={aiBusy} className="inline-flex items-center gap-1 font-sans text-xs px-2.5 py-1 text-[#6366f1] border border-[#6366f1]/30 hover:bg-[#6366f1]/5">
                    {aiBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} AI assist
                  </button>
                </div>
                <div className="flex gap-2 p-3">
                  <textarea value={body} onChange={e => setBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder={noteMode ? 'Internal note — never shown to the customer…' : 'Type a reply… (Enter to send, Shift+Enter for newline)'}
                    rows={2} className={`flex-1 font-sans text-sm border px-3 py-2 outline-none resize-none ${noteMode ? 'border-amber-300 bg-amber-50/40 focus:border-amber-400' : 'border-gray-200 focus:border-[#2d6a4f]'}`} />
                  <button onClick={handleSend} disabled={sending || !body.trim()}
                    className={`shrink-0 flex items-center gap-1.5 px-4 font-sans text-sm text-white transition-colors disabled:opacity-40 ${noteMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2d6a4f] hover:bg-[#235a3f]'}`}>
                    {noteMode ? <StickyNote size={14} /> : <Send size={14} />}{sending ? '…' : noteMode ? 'Save' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300">
              <MessageSquare size={30} />
              <p className="font-sans text-sm text-gray-400">Select a conversation, or start a new enquiry.</p>
            </div>
          )}
        </div>

        {/* ── Right: CRM / pipeline / tasks / timeline / actions / AI ── */}
        {selected && (
          <div className="w-[340px] shrink-0 flex flex-col border-l border-white/8 bg-white">
            <div className="flex border-b border-gray-200 overflow-x-auto shrink-0">
              {([
                ['customer', User], ['pipeline', Zap], ['tasks', ListChecks],
                ['timeline', Clock], ['actions', CreditCard], ['ai', Sparkles],
              ] as const).map(([id, Icon]) => (
                <button key={id} onClick={() => setRightTab(id)} title={id}
                  className={`flex-1 py-2.5 flex justify-center border-b-2 transition-colors ${rightTab === id ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {rightTab === 'customer' && <CustomerTab conv={selected} profile={profile} loading={profileLoading} />}
              {rightTab === 'pipeline' && <PipelineTab conv={selected} onStage={changeStage} me={me} staff={staff} onAssign={assign} />}
              {rightTab === 'tasks' && <TasksTab conv={selected} newTask={newTask} setNewTask={setNewTask} onAdd={doTask} onToggle={t => toggleTask(selected.id, t).then(patchLocal)} onDelete={t => deleteTask(selected.id, t).then(patchLocal)} />}
              {rightTab === 'timeline' && <TimelineTab conv={selected} />}
              {rightTab === 'actions' && <ActionsTab conv={selected} profile={profile} onAction={action} onStage={changeStage} />}
              {rightTab === 'ai' && <AiTab ai={ai} busy={aiBusy} onRun={runAssist} onUse={r => { setBody(b => (b ? b + '\n\n' : '') + r); setNoteMode(false) }} />}
            </div>
            {/* Quick internal note always available */}
            <div className="border-t border-gray-100 p-3 shrink-0">
              <div className="flex gap-2">
                <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doNote() }}
                  placeholder="Quick internal note…" className="flex-1 font-sans text-xs border border-gray-200 px-2.5 py-1.5 outline-none focus:border-amber-400 bg-amber-50/30" />
                <button onClick={doNote} className="px-2.5 bg-amber-500 text-white"><StickyNote size={13} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showNew && <NewEnquiryModal me={me} onClose={() => setShowNew(false)} onCreated={c => { setConversations(cs => [c, ...cs]); setSelectedId(c.id); setShowNew(false) }} />}
    </div>
  )
}

/* ══ Right-panel tabs ═══════════════════════════════════════════════════════ */

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon size={13} className="text-gray-300 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400">{label}</p>
        <p className="font-sans text-sm text-gray-700 break-words">{value}</p>
      </div>
    </div>
  )
}

function CustomerTab({ conv, profile, loading }: { conv: Conversation; profile: CustomerProfile | null; loading: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white font-display italic text-lg shrink-0">
          {(conv.customerName || 'G')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-display italic text-lg text-gray-900 truncate">{conv.customerName || 'Guest'}</p>
          <p className="font-sans text-xs text-gray-400">
            {profile?.isLead ? 'New lead' : `${profile?.tripCount ?? 0} trip${profile?.tripCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <Row icon={Mail} label="Email" value={conv.customerEmail} />
      <Row icon={Phone} label="Phone" value={conv.hub.customerPhone || profile?.phones[0] || ''} />
      <Row icon={MapPin} label="Regions" value={(profile?.regionsVisited || []).join(', ')} />

      {loading ? <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 text-gray-300 animate-spin" /></div> : profile && (
        <>
          <div className="grid grid-cols-3 gap-2 my-4">
            <div className="bg-[#F7F5F2] px-2 py-2"><p className="font-sans text-[9px] uppercase text-gray-400">Lifetime</p><p className="font-sans text-sm font-medium text-gray-800">{formatMoney(profile.lifetimeSpend)}</p></div>
            <div className="bg-[#F7F5F2] px-2 py-2"><p className="font-sans text-[9px] uppercase text-gray-400">Paid</p><p className="font-sans text-sm font-medium text-gray-800">{formatMoney(profile.totalPaid)}</p></div>
            <div className="bg-[#F7F5F2] px-2 py-2"><p className="font-sans text-[9px] uppercase text-gray-400">Owing</p><p className={`font-sans text-sm font-medium ${profile.outstandingBalance > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{formatMoney(profile.outstandingBalance)}</p></div>
          </div>
          <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400 mb-2">Trip History</p>
          {profile.trips.length === 0 && <p className="font-sans text-xs text-gray-400">No bookings yet — this is a fresh lead.</p>}
          <div className="space-y-2">
            {profile.trips.map(t => (
              <div key={t.orderId || t.bookingRef} className="border border-gray-100 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-sans text-xs font-medium text-gray-800 truncate">{t.tripName}</p>
                  <span className="font-sans text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500">{t.status}</span>
                </div>
                <p className="font-sans text-[10px] text-gray-400">{t.bookingRef}{t.travelStart ? ` · ${t.travelStart}` : ''}</p>
                <div className="flex items-center gap-3 mt-1 font-sans text-[10px]">
                  <span className="text-gray-500">{formatMoney(t.total)}</span>
                  {t.outstanding > 0 && <span className="text-amber-600">{formatMoney(t.outstanding)} due</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PipelineTab({ conv, onStage, me, staff, onAssign }: {
  conv: Conversation; onStage: (s: LeadStage) => void; me: { id: string; name: string } | null
  staff: { id: string; name: string }[]; onAssign: (id?: string, name?: string) => void
}) {
  return (
    <div>
      <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400 mb-2">Sales Pipeline</p>
      <div className="space-y-1 mb-5">
        {LEAD_STAGES.map(s => {
          const active = conv.hub.leadStage === s.id
          return (
            <button key={s.id} onClick={() => onStage(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 font-sans text-xs text-left transition-colors ${active ? 'text-white' : 'text-gray-600 hover:bg-[#F7F5F2]'}`}
              style={active ? { background: s.color } : undefined}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? '#fff' : s.color }} />
              {s.label}
              {active && <Check size={13} className="ml-auto" />}
            </button>
          )
        })}
      </div>
      <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400 mb-2">Assignment</p>
      <div className="space-y-1">
        <button onClick={() => onAssign(me?.id, me?.name)} className="w-full flex items-center gap-2 px-3 py-2 font-sans text-xs text-left text-gray-600 hover:bg-[#F7F5F2]">
          <UserPlus size={13} /> Assign to me{conv.hub.assignedTo === me?.id ? ' ✓' : ''}
        </button>
        {staff.filter(s => s.id !== me?.id).map(s => (
          <button key={s.id} onClick={() => onAssign(s.id, s.name)} className="w-full flex items-center gap-2 px-3 py-2 font-sans text-xs text-left text-gray-600 hover:bg-[#F7F5F2]">
            <User size={13} /> {s.name}{conv.hub.assignedTo === s.id ? ' ✓' : ''}
          </button>
        ))}
        {conv.hub.assignedTo && (
          <button onClick={() => onAssign(undefined, undefined)} className="w-full flex items-center gap-2 px-3 py-2 font-sans text-xs text-left text-red-400 hover:bg-red-50">
            <X size={13} /> Unassign
          </button>
        )}
      </div>
    </div>
  )
}

function TasksTab({ conv, newTask, setNewTask, onAdd, onToggle, onDelete }: {
  conv: Conversation; newTask: string; setNewTask: (v: string) => void
  onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void
}) {
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
          placeholder="Add a task…" className="flex-1 font-sans text-xs border border-gray-200 px-2.5 py-1.5 outline-none focus:border-[#2d6a4f]" />
        <button onClick={onAdd} className="px-2.5 bg-[#2d6a4f] text-white"><Plus size={13} /></button>
      </div>
      {conv.tasks.length === 0 && <p className="font-sans text-xs text-gray-400">No tasks yet. Common ones: call customer, send permit, confirm accommodation, collect passport copy.</p>}
      <div className="space-y-1.5">
        {conv.tasks.map(t => (
          <div key={t.id} className="flex items-start gap-2 group">
            <button onClick={() => onToggle(t.id)} className={`mt-0.5 w-4 h-4 border shrink-0 flex items-center justify-center ${t.done ? 'bg-[#2d6a4f] border-[#2d6a4f]' : 'border-gray-300'}`}>
              {t.done && <Check size={11} className="text-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`font-sans text-xs ${t.done ? 'text-gray-300 line-through' : 'text-gray-700'}`}>{t.title}</p>
              <p className="font-sans text-[9px] text-gray-300">{t.createdBy}{t.dueDate ? ` · due ${t.dueDate}` : ''}</p>
            </div>
            <button onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineTab({ conv }: { conv: Conversation }) {
  const items = [
    ...conv.events.map(e => ({ at: e.createdAt, label: e.label, detail: e.detail, actor: e.actor, href: e.href })),
    ...conv.messages.map(m => ({ at: m.createdAt, label: m.from === 'visitor' ? 'Customer message' : 'Reply sent', detail: m.body.slice(0, 60), actor: m.senderName, href: undefined as string | undefined })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  return (
    <div>
      <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400 mb-3">Customer Timeline</p>
      {items.length === 0 && <p className="font-sans text-xs text-gray-400">Nothing logged yet.</p>}
      <div className="space-y-0">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2.5 pb-3 relative">
            <div className="flex flex-col items-center">
              <span className="w-2 h-2 rounded-full bg-[#C9A96E] mt-1 shrink-0" />
              {i < items.length - 1 && <span className="w-px flex-1 bg-gray-200 my-0.5" />}
            </div>
            <div className="min-w-0 pb-1">
              <p className="font-sans text-xs text-gray-700">{it.label}</p>
              {it.detail && <p className="font-sans text-[10px] text-gray-400 truncate">{it.detail}</p>}
              <p className="font-sans text-[9px] text-gray-300">{fmtTime(it.at)}{it.actor ? ` · ${it.actor}` : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionsTab({ conv, profile, onAction, onStage }: {
  conv: Conversation; profile: CustomerProfile | null
  onAction: (type: string, label: string, href: string) => void; onStage: (s: LeadStage) => void
}) {
  const q = `?customer=${encodeURIComponent(conv.customerName || '')}&email=${encodeURIComponent(conv.customerEmail || '')}`
  const items = [
    { icon: Package, label: 'Build package / quote', type: 'quote', href: `/admin/packages${q}`, onDone: () => onStage('quote_sent') },
    { icon: FileText, label: 'Create invoice', type: 'invoice', href: `/admin/invoices${q}` },
    { icon: Receipt, label: 'Orders & payments', type: 'order', href: `/admin/orders${q}` },
    { icon: CreditCard, label: 'Finance & settlements', type: 'finance', href: `/admin/finance` },
  ]
  return (
    <div>
      <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400 mb-2">Sell & bill from the conversation</p>
      <div className="space-y-1.5 mb-5">
        {items.map(it => {
          const Icon = it.icon
          return (
            <button key={it.type} onClick={() => { onAction(it.type, `Opened ${it.label}`, it.href); it.onDone?.() }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 border border-gray-200 font-sans text-xs text-gray-700 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors text-left">
              <Icon size={14} className="shrink-0" /> {it.label}
            </button>
          )
        })}
      </div>
      {profile && profile.outstandingBalance > 0 && (
        <div className="bg-amber-50 border border-amber-200 px-3 py-2 mb-4">
          <p className="font-sans text-[10px] text-amber-700">Outstanding balance</p>
          <p className="font-sans text-lg text-amber-800">{formatMoney(profile.outstandingBalance)}</p>
        </div>
      )}
      <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400 mb-2">One-click stage moves</p>
      <div className="flex flex-wrap gap-1.5">
        {(['quote_sent', 'awaiting_deposit', 'confirmed', 'completed'] as LeadStage[]).map(s => (
          <button key={s} onClick={() => onStage(s)} className="font-sans text-[11px] px-2.5 py-1.5 border border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]">
            {stageMeta(s).label}
          </button>
        ))}
      </div>
    </div>
  )
}

function AiTab({ ai, busy, onRun, onUse }: { ai: AssistResult | null; busy: boolean; onRun: () => void; onUse: (reply: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-sans text-[9px] tracking-[0.1em] uppercase text-gray-400">AI Assistant</p>
        <button onClick={onRun} disabled={busy} className="inline-flex items-center gap-1 font-sans text-[11px] text-[#6366f1]">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Analyse
        </button>
      </div>
      {!ai && <p className="font-sans text-xs text-gray-400">Run the assistant to summarise the conversation, detect intent, extract requirements and draft a reply. Nothing is ever sent without your approval.</p>}
      {ai && (
        <div className="space-y-4">
          {ai.urgent && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-2.5 py-1.5 font-sans text-xs text-red-600">
              <AlertTriangle size={13} /> Flagged urgent
            </div>
          )}
          <div>
            <p className="font-sans text-[9px] uppercase text-gray-400 mb-1">Summary</p>
            <p className="font-sans text-xs text-gray-700 leading-relaxed">{ai.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans text-[9px] uppercase text-gray-400">Intent</span>
            <span className="font-sans text-[11px] px-2 py-0.5 bg-[#6366f1]/10 text-[#6366f1]">{ai.intent}</span>
          </div>
          {ai.requirements.length > 0 && (
            <div>
              <p className="font-sans text-[9px] uppercase text-gray-400 mb-1">Requirements</p>
              <ul className="space-y-1">
                {ai.requirements.map(r => <li key={r} className="font-sans text-xs text-gray-600 flex gap-1.5"><span className="text-[#C9A96E]">•</span>{r}</li>)}
              </ul>
            </div>
          )}
          <div>
            <p className="font-sans text-[9px] uppercase text-gray-400 mb-1">Suggested reply</p>
            <div className="bg-[#F7F5F2] border border-gray-200 px-3 py-2 font-sans text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{ai.suggestedReply}</div>
            <button onClick={() => onUse(ai.suggestedReply)} className="mt-2 w-full bg-[#6366f1] text-white font-sans text-xs py-2 hover:bg-[#5457d8] transition-colors">
              Use draft in composer
            </button>
            <p className="font-sans text-[9px] text-gray-300 mt-1.5 text-center">Review and edit before sending — AI never sends on its own.</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══ New enquiry modal ══════════════════════════════════════════════════════ */

function NewEnquiryModal({ me, onClose, onCreated }: {
  me: { id: string; name: string } | null; onClose: () => void; onCreated: (c: Conversation) => void
}) {
  const [channel, setChannel] = useState<ChannelId>('website-chat')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [assignMe, setAssignMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function create() {
    if (!name.trim()) { setErr('Customer name is required.'); return }
    setBusy(true); setErr('')
    try {
      const conv = await createEnquiry({
        channel, customerName: name.trim(), customerEmail: email.trim(), customerPhone: phone.trim() || undefined,
        subject: subject.trim() || undefined, firstMessage: message.trim() || undefined,
        assignedTo: assignMe ? me?.id : undefined, assignedName: assignMe ? me?.name : undefined,
      })
      onCreated(conv)
    } catch (e: any) { setErr(e?.message || 'Could not create enquiry.'); setBusy(false) }
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2 font-sans text-sm outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  return (
    <div className="fixed inset-0 z-[1100] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-sans text-sm font-semibold text-gray-900">Log a new enquiry</p>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {err && <p className="font-sans text-xs text-red-500">{err}</p>}
          <div>
            <label className="font-sans text-[10px] uppercase text-gray-400">Channel</label>
            <select value={channel} onChange={e => setChannel(e.target.value as ChannelId)} className={inputCls}>
              {CHANNEL_LIST.map(ch => <option key={ch.id} value={ch.id}>{ch.label}{ch.connected ? '' : ' (log only — not connected)'}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-sans text-[10px] uppercase text-gray-400">Name *</label><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></div>
            <div><label className="font-sans text-[10px] uppercase text-gray-400">Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className="font-sans text-[10px] uppercase text-gray-400">Email</label><input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></div>
          <div><label className="font-sans text-[10px] uppercase text-gray-400">Subject</label><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. 4-day Sani Pass trip" className={inputCls} /></div>
          <div><label className="font-sans text-[10px] uppercase text-gray-400">First message</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} /></div>
          <label className="flex items-center gap-2 font-sans text-xs text-gray-600"><input type="checkbox" checked={assignMe} onChange={e => setAssignMe(e.target.checked)} /> Assign to me</label>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="font-sans text-sm px-4 py-2 text-gray-500">Cancel</button>
          <button onClick={create} disabled={busy} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white font-sans text-sm px-4 py-2 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create lead
          </button>
        </div>
      </div>
    </div>
  )
}
