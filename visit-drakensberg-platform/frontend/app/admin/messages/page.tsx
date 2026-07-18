'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, MessageSquare, Send, Building2, Inbox } from 'lucide-react'
import { getAllThreads, sendMessage, type MessageThread } from '@/lib/messages'

// Admin message console. Two duties:
//  1. Answer threads addressed to Visit Drakensberg itself (no supplier
//     account — shuttle desk, showcase stays, platform services). Nobody
//     else can see these.
//  2. Oversight of guest ↔ supplier conversations.

function fmtTime(iso: string) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default function AdminMessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'platform' | 'all'>('platform')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    const t = await getAllThreads()
    setThreads(t)
    setLoading(false)
  }
  useEffect(() => {
    load()
    const iv = setInterval(load, 8000)
    return () => clearInterval(iv)
  }, [])

  const filtered = useMemo(
    () => filter === 'platform' ? threads.filter(t => !t.supplierId) : threads,
    [threads, filter],
  )
  const selected = threads.find(t => t.id === selectedId) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages.length, selectedId])

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || !selected) return
    setSending(true)
    const updated = await sendMessage(selected.id, 'supplier', 'Visit Drakensberg', trimmed)
    if (updated) setThreads(ts => ts.map(t => t.id === updated.id ? updated : t))
    setBody('')
    setSending(false)
  }

  return (
    <div className="p-8 h-screen flex flex-col">
      <div className="mb-6 flex items-start justify-between shrink-0">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Guest Communication</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Messages</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Platform-addressed threads (shuttle desk, showcase stays) need a reply from here — suppliers answer their own in the supplier portal.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-0 border border-gray-200 bg-white overflow-hidden w-fit mb-4 shrink-0">
        {([['platform', `Visit Drakensberg inbox (${threads.filter(t => !t.supplierId).length})`], ['all', `All threads (${threads.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-4 py-2 font-sans text-xs transition-colors border-r border-gray-100 last:border-0 ${filter === id ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-0 border border-gray-200 bg-white">
        {/* Thread list */}
        <div className="border-r border-gray-200 overflow-y-auto">
          {filtered.map(t => (
            <button key={t.id} onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-colors ${selectedId === t.id ? 'bg-[#2d6a4f]/5 border-l-2 border-l-[#2d6a4f]' : 'hover:bg-[#F7F5F2]'}`}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="font-sans text-sm font-medium text-gray-800 truncate">{t.customerName || 'Guest'}</p>
                <span className="font-sans text-[10px] text-gray-400 shrink-0">{fmtTime(t.updatedAt)}</span>
              </div>
              <p className="font-sans text-xs text-gray-500 truncate">{t.addonTitle || t.bookingRef}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {t.supplierId
                  ? <span className="inline-flex items-center gap-1 font-sans text-[10px] text-gray-400"><Building2 size={9} />{t.supplierName || 'Supplier'}</span>
                  : <span className="inline-flex items-center gap-1 font-sans text-[10px] text-[#8B6914] bg-[#C9A96E]/15 px-1.5 py-0.5"><Inbox size={9} />Needs platform reply</span>}
                {t.messages.length > 0 && (
                  <span className="font-sans text-[10px] text-gray-300">· {t.messages.length} msg{t.messages.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="px-4 py-10 text-center font-sans text-sm text-gray-400">No threads here yet.</p>
          )}
        </div>

        {/* Conversation */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {selected ? (
            <>
              <div className="px-5 py-3.5 border-b border-gray-200 bg-[#F7F5F2] shrink-0">
                <p className="font-sans text-sm font-medium text-gray-800">{selected.addonTitle || selected.bookingRef}</p>
                <p className="font-sans text-xs text-gray-400 mt-0.5">
                  {selected.customerName} ({selected.customerEmail}) · Booking {selected.bookingRef}
                  {selected.supplierId ? ` · Supplier: ${selected.supplierName}` : ' · Addressed to Visit Drakensberg'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 p-5 bg-[#F7F5F2]/50">
                {selected.messages.length === 0 && (
                  <p className="font-sans text-xs text-gray-400 text-center pt-8">No messages in this thread yet.</p>
                )}
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex ${m.from === 'supplier' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 ${m.from === 'supplier' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                      <p className={`font-sans text-[10px] mb-1 ${m.from === 'supplier' ? 'text-white/60' : 'text-gray-400'}`}>{m.senderName}</p>
                      <p className="font-sans text-sm leading-relaxed">{m.body}</p>
                      <p className={`font-sans text-[10px] mt-1 ${m.from === 'supplier' ? 'text-white/40' : 'text-gray-300'}`}>{fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={selected.supplierId
                    ? 'Reply as Visit Drakensberg (the supplier handles this thread — reply only if support is needed)…'
                    : 'Reply as Visit Drakensberg… (Enter to send)'}
                  rows={2}
                  className="flex-1 font-sans text-sm border border-gray-200 px-3 py-2 outline-none focus:border-[#2d6a4f] resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !body.trim()}
                  className="shrink-0 flex items-center gap-1.5 bg-[#2d6a4f] text-white px-4 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={14} />{sending ? '…' : 'Send'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300">
              <MessageSquare size={28} />
              <p className="font-sans text-sm text-gray-400">Select a thread to read and reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
