'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { MessageCircle, Send, MapPin, ChevronRight, Inbox } from 'lucide-react'
import { getThreadsByCustomer, sendMessage, type MessageThread } from '@/lib/messages'
import { supabase } from '@/lib/auth'

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: MessageThread
  active: boolean
  onClick: () => void
}) {
  const last = thread.messages[thread.messages.length - 1]
  const unread = thread.messages.filter(m => m.from === 'supplier').length > 0 && !active
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 border-b border-gray-100 last:border-0 transition-colors flex gap-3 items-start ${
        active ? 'bg-[#2d6a4f]/5 border-l-2 border-l-[#2d6a4f]' : 'hover:bg-[#F7F5F2]'
      }`}
    >
      <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
        active ? 'bg-[#2d6a4f] text-white' : 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
      }`}>
        {(thread.supplierName || 'VD').slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-sans text-sm font-medium text-gray-800 truncate leading-tight">
            {thread.supplierName || 'Visit Drakensberg'}
          </p>
          {last && (
            <span className="font-sans text-[10px] text-gray-400 shrink-0">{timeAgo(last.createdAt)}</span>
          )}
        </div>
        <p className="font-sans text-xs text-gray-500 truncate mt-0.5">{thread.addonTitle}</p>
        {last && (
          <p className={`font-sans text-xs truncate mt-1 ${unread ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
            {last.from === 'visitor' ? 'You: ' : ''}{last.body}
          </p>
        )}
        <p className="font-sans text-[10px] text-gray-300 mt-1">Booking #{thread.bookingRef}</p>
      </div>
      {unread && (
        <span className="w-2 h-2 rounded-full bg-[#C9A96E] mt-1.5 shrink-0" />
      )}
    </button>
  )
}

function ConversationPanel({
  thread,
  visitorName,
  onNewMessage,
}: {
  thread: MessageThread
  visitorName: string
  onNewMessage: (t: MessageThread) => void
}) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.messages.length])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    try {
      const updated = await sendMessage(thread.id, 'visitor', visitorName, body.trim())
      if (updated) {
        onNewMessage(updated)
        setBody('')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display italic text-xl text-gray-900">{thread.supplierName || 'Visit Drakensberg'}</p>
            <p className="font-sans text-xs text-gray-400 mt-0.5">{thread.addonTitle}</p>
          </div>
          <Link
            href={`/account/itinerary?id=${thread.bookingId}`}
            className="font-sans text-xs text-[#2d6a4f] hover:underline flex items-center gap-1 shrink-0"
          >
            View itinerary <ChevronRight size={12} />
          </Link>
        </div>
        <p className="font-sans text-[10px] text-gray-300 mt-1">Booking #{thread.bookingRef}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {thread.messages.length === 0 && (
          <p className="font-sans text-sm text-gray-400 text-center py-8">No messages yet — start the conversation below.</p>
        )}
        {thread.messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.from === 'visitor' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] ${msg.from === 'visitor' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <p className="font-sans text-[10px] text-gray-400">{msg.senderName}</p>
              <div className={`px-4 py-2.5 font-sans text-sm leading-relaxed ${
                msg.from === 'visitor'
                  ? 'bg-[#2d6a4f] text-white'
                  : 'bg-[#F7F5F2] text-gray-800 border border-gray-200'
              }`}>
                {msg.body}
              </div>
              <p className="font-sans text-[10px] text-gray-300">{timeAgo(msg.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <form onSubmit={submit} className="px-5 py-4 border-t border-gray-200 shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e as any) } }}
            placeholder="Type a message…"
            rows={2}
            className="flex-1 border border-gray-200 px-3 py-2.5 font-sans text-sm resize-none focus:outline-none focus:border-[#2d6a4f] transition-colors"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="shrink-0 w-10 h-10 bg-[#2d6a4f] text-white flex items-center justify-center hover:bg-[#235a3f] transition-colors disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  )
}

export default function AccountMessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [visitorName, setVisitorName] = useState('Guest')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Guest'
      setVisitorName(name)
      // Mark all supplier messages as seen — Navbar badge re-counts against this timestamp
      try {
        localStorage.setItem(`vd_msgs_last_seen_${user.id}`, new Date().toISOString())
      } catch {}
      getThreadsByCustomer(user.id).then(ts => {
        setThreads(ts)
        if (ts.length > 0) setActiveId(ts[0].id)
        setLoading(false)
      })
    })
  }, [])

  // Poll for new messages every 10s while the panel is open
  useEffect(() => {
    if (!activeId) return
    const t = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const latest = await getThreadsByCustomer(user.id)
      setThreads(latest)
    }, 10_000)
    return () => clearInterval(t)
  }, [activeId])

  const activeThread = threads.find(t => t.id === activeId) ?? null

  function handleSelect(id: string) {
    setActiveId(id)
    setMobilePanelOpen(true)
  }

  function handleNewMessage(updated: MessageThread) {
    setThreads(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">Messages</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">
          {threads.length === 0 ? 'No conversations yet' : `${threads.length} conversation${threads.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Inbox size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No messages yet</p>
          <p className="font-sans text-sm text-gray-400 mb-5">
            When you book a stay or experience, you can message the property or operator directly from your itinerary.
          </p>
          <Link
            href="/account"
            className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors"
          >
            View My Bookings
          </Link>
        </div>
      ) : (
        /* ── Two-panel layout ── */
        <div className="bg-white border border-gray-200 overflow-hidden flex h-[600px]">

          {/* Thread list */}
          <div className={`w-full lg:w-80 shrink-0 border-r border-gray-200 overflow-y-auto ${mobilePanelOpen ? 'hidden lg:block' : 'block'}`}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <MessageCircle size={14} className="text-[#2d6a4f]" />
              <span className="font-sans text-xs tracking-[0.12em] uppercase text-gray-400">Conversations</span>
            </div>
            {threads.map(t => (
              <ThreadRow
                key={t.id}
                thread={t}
                active={t.id === activeId}
                onClick={() => handleSelect(t.id)}
              />
            ))}
          </div>

          {/* Active conversation */}
          {activeThread && (
            <div className={`flex-1 min-w-0 flex flex-col ${!mobilePanelOpen ? 'hidden lg:flex' : 'flex'}`}>
              {/* Mobile back button */}
              <div className="lg:hidden px-4 py-2 border-b border-gray-100">
                <button
                  onClick={() => setMobilePanelOpen(false)}
                  className="font-sans text-xs text-[#2d6a4f] hover:underline flex items-center gap-1"
                >
                  ← All messages
                </button>
              </div>
              <ConversationPanel
                thread={activeThread}
                visitorName={visitorName}
                onNewMessage={handleNewMessage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
