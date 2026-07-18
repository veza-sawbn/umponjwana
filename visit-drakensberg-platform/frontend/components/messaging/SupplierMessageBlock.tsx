'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import {
  getOrCreateThread, getThreadsByBooking, sendMessage, type MessageThread,
} from '@/lib/messages'

// Reusable guest ↔ supplier messaging for the itinerary. One thread per
// (booking × service): real suppliers see it in /supplier/messages via RLS;
// platform-arranged services (shuttle, equipment, showcase stays) have no
// supplier account, so their threads go to the Visit Drakensberg team in
// /admin/messages.

export function MessagePanel({
  thread, onSend,
}: {
  thread: MessageThread | null
  onSend: (body: string) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages.length])

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    await onSend(trimmed)
    setBody('')
    setSending(false)
  }

  return (
    <div className="flex flex-col h-80">
      <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#F7F5F2]">
        {(!thread || thread.messages.length === 0) && (
          <p className="font-sans text-xs text-gray-400 text-center pt-6">
            No messages yet. Send the first message.
          </p>
        )}
        {thread?.messages.map(m => (
          <div key={m.id} className={`flex ${m.from === 'visitor' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 ${m.from === 'visitor' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
              <p className={`font-sans text-[10px] mb-1 ${m.from === 'visitor' ? 'text-white/60' : 'text-gray-400'}`}>{m.senderName}</p>
              <p className="font-sans text-sm leading-relaxed">{m.body}</p>
              <p className={`font-sans text-[10px] mt-1 ${m.from === 'visitor' ? 'text-white/40' : 'text-gray-300'}`}>
                {new Date(m.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t border-gray-200 bg-white">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Type your message… (Enter to send)"
          rows={2}
          className="flex-1 font-sans text-sm border border-gray-200 px-3 py-2 outline-none focus:border-[#2d6a4f] resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="shrink-0 flex items-center gap-1.5 bg-[#2d6a4f] text-white px-4 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} />{sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

export default function SupplierMessageBlock({
  booking, currentUser, supplierId, supplierName, serviceTitle, buttonLabel = 'Message Supplier',
}: {
  booking: { id: string; reference: string }
  currentUser: { id: string; name: string; email: string } | null
  /** Real supplier auth uid, or '' for platform-arranged services. */
  supplierId: string
  supplierName: string
  /** Thread key within the booking — the service this conversation is about. */
  serviceTitle: string
  buttonLabel?: string
}) {
  const [showMsg, setShowMsg] = useState(false)
  const [thread, setThread] = useState<MessageThread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)

  // Light polling keeps the open thread live (matches the 5s pattern used
  // by the supplier inbox).
  useEffect(() => {
    if (!showMsg || !thread) return
    const iv = setInterval(async () => {
      const threads = await getThreadsByBooking(booking.id)
      const fresh = threads.find(t => t.addonTitle === serviceTitle)
      if (fresh) setThread(fresh)
    }, 5000)
    return () => clearInterval(iv)
  }, [showMsg, thread, booking.id, serviceTitle])

  async function openMessages() {
    if (!currentUser) return
    setShowMsg(true)
    if (thread) return
    setThreadLoading(true)
    try {
      const t = await getOrCreateThread(
        booking.id,
        booking.reference,
        currentUser.id,
        currentUser.name,
        currentUser.email,
        supplierId,
        supplierName,
        serviceTitle,
      )
      setThread(t)
    } finally {
      setThreadLoading(false)
    }
  }

  async function handleSend(body: string) {
    if (!thread || !currentUser) return
    const updated = await sendMessage(thread.id, 'visitor', currentUser.name, body)
    if (updated) setThread(updated)
  }

  if (!currentUser) return null

  return (
    <div>
      <button
        onClick={showMsg ? () => setShowMsg(false) : openMessages}
        className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#1a1a1a] px-4 py-2 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors"
      >
        <MessageCircle size={14} />{showMsg ? 'Close Messages' : buttonLabel}
      </button>

      {showMsg && (
        <div className="mt-4 border border-gray-200 bg-white text-gray-800">
          <div className="px-5 py-3 border-b border-gray-200 bg-[#F7F5F2] flex items-center justify-between">
            <p className="font-sans text-xs font-medium text-gray-700">Message thread with {supplierName}</p>
            <button onClick={() => setShowMsg(false)} className="font-sans text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          {threadLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <MessagePanel thread={thread} onSend={handleSend} />
          )}
        </div>
      )}
    </div>
  )
}
