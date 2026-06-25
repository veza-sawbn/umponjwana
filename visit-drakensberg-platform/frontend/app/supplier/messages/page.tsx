'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { useSupplier } from '@/lib/supplier-context'
import { supabase } from '@/lib/auth'
import { getThreadsBySupplier, sendMessage, type MessageThread } from '@/lib/messages'

export default function MessagesPage() {
  const { fullName } = useSupplier()
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selected, setSelected] = useState<MessageThread | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      setSupplierId(user.id)
      setSupplierName(fullName || user.user_metadata?.full_name || user.email || '')
      getThreadsBySupplier(user.id).then(t => {
        setThreads(t.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
        setLoading(false)
      })
    })
  }, [fullName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages.length])

  async function handleReply() {
    if (!selected || !reply.trim() || !supplierId) return
    setSending(true)
    const updated = await sendMessage(selected.id, 'supplier', supplierName, reply.trim())
    if (updated) {
      setSelected(updated)
      setThreads(prev => prev.map(t => t.id === updated.id ? updated : t))
    }
    setReply('')
    setSending(false)
  }

  function unread(thread: MessageThread) {
    // threads with last message from visitor = unread for supplier
    const last = thread.messages[thread.messages.length - 1]
    return last?.from === 'visitor'
  }

  return (
    <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 h-full">
      <div className="flex items-center gap-3">
        <MessageSquare size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Messages</h1>
        {threads.filter(unread).length > 0 && (
          <span className="font-sans text-xs bg-[#C9A96E] text-white px-2 py-0.5">
            {threads.filter(unread).length} new
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-white border border-black/8 p-12 text-center">
          <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-xl text-black/20 mb-2">No messages yet</p>
          <p className="font-sans text-sm text-black/30">Customer messages will appear here once visitors contact you from their itinerary.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-[calc(100vh-200px)]">
          {/* Thread list */}
          <div className="lg:col-span-2 bg-white border border-black/8 overflow-y-auto">
            {threads.map((t, i) => {
              const lastMsg = t.messages[t.messages.length - 1]
              const isUnread = unread(t)
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`w-full text-left px-4 py-4 transition-colors ${selected?.id === t.id ? 'bg-[#C9A96E]/8 border-l-2 border-[#C9A96E]' : 'hover:bg-black/3'} ${i < threads.length - 1 ? 'border-b border-black/6' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {isUnread && <div className="w-2 h-2 rounded-full bg-[#C9A96E] shrink-0" />}
                      <p className={`font-sans text-sm truncate ${isUnread ? 'font-semibold text-black/90' : 'text-black/60'}`}>
                        {t.customerName}
                      </p>
                    </div>
                    <p className="font-sans text-[10px] text-black/30 shrink-0">
                      {new Date(t.updatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className="font-sans text-xs text-[#C9A96E] truncate mb-1">{t.addonTitle}</p>
                  {lastMsg && (
                    <p className="font-sans text-xs text-black/40 truncate">
                      {lastMsg.from === 'supplier' ? 'You: ' : ''}{lastMsg.body}
                    </p>
                  )}
                  <p className="font-sans text-[10px] text-black/30 mt-1">Ref: {t.bookingRef}</p>
                </button>
              )
            })}
          </div>

          {/* Thread detail */}
          <div className="lg:col-span-3 bg-white border border-black/8 flex flex-col min-h-[400px] lg:min-h-0">
            {selected ? (
              <>
                {/* Thread header */}
                <div className="px-5 py-4 border-b border-black/6 shrink-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-sans font-semibold text-black/90">{selected.customerName}</p>
                      <p className="font-sans text-xs text-black/40">{selected.addonTitle} · Ref: {selected.bookingRef}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-sans text-xs text-black/40">{selected.customerEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#FAFAF9]">
                  {selected.messages.length === 0 && (
                    <p className="font-sans text-xs text-black/30 text-center pt-8">
                      No messages yet — wait for the customer to start the conversation.
                    </p>
                  )}
                  {selected.messages.map(m => (
                    <div key={m.id} className={`flex ${m.from === 'supplier' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 ${m.from === 'supplier' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-black/8 text-black/80'}`}>
                        <p className={`font-sans text-[10px] mb-1 ${m.from === 'supplier' ? 'text-white/60' : 'text-black/40'}`}>{m.senderName}</p>
                        <p className="font-sans text-sm leading-relaxed">{m.body}</p>
                        <p className={`font-sans text-[10px] mt-1 ${m.from === 'supplier' ? 'text-white/40' : 'text-black/30'}`}>
                          {new Date(m.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Reply */}
                <div className="px-5 py-4 border-t border-black/6 shrink-0">
                  <div className="flex gap-3">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                      placeholder="Reply to customer… (Enter to send)"
                      rows={2}
                      className="flex-1 font-sans text-sm border border-black/10 px-3 py-2 outline-none focus:border-[#C9A96E]/50 resize-none"
                    />
                    <button
                      onClick={handleReply}
                      disabled={sending || !reply.trim()}
                      className="shrink-0 flex items-center gap-1.5 bg-[#C9A96E] text-white px-4 font-sans text-sm hover:bg-[#b8935e] transition-colors disabled:opacity-40"
                    >
                      <Send size={14} />{sending ? '…' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare size={24} className="text-black/15 mx-auto mb-2" />
                  <p className="font-sans text-sm text-black/30">Select a conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
