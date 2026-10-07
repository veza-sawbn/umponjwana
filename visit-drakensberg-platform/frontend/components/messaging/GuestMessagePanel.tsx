'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Send, RefreshCw } from 'lucide-react'
import type { SupplierOrder } from '@/lib/booking-orders'
import { getThreadsByBooking, getOrCreateThread, sendMessage, type MessageThread } from '@/lib/messages'

/**
 * The operator's side of the guest conversation for one booking, from
 * /supplier/bookings. Uses the same vd_message_threads row the guest's
 * "Message Operator" button opens on /account/itinerary (matched by the
 * booked service's title), so both sides see one conversation. A thread is
 * only created when the operator actually sends something.
 */
export default function GuestMessagePanel({
  order, serviceTitle, supplierName,
}: {
  order: SupplierOrder
  serviceTitle: string
  supplierName: string
}) {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const all = (await getThreadsByBooking(order.bookingId)).filter(t => t.supplierId === order.supplierId)
    setThreads(all)
    setActiveId(id => id && all.some(t => t.id === id)
      ? id
      : (all.find(t => t.addonTitle === serviceTitle) ?? all[0])?.id ?? null)
    setLoading(false)
  }, [order.bookingId, order.supplierId, serviceTitle])

  useEffect(() => {
    load()
    // Same cadence as the guest's side is checked from the inbox.
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [load])

  const active = threads.find(t => t.id === activeId) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [active?.messages.length])

  async function handleSend() {
    const text = body.trim()
    if (!text) return
    setSending(true)
    try {
      const thread = active ?? await getOrCreateThread(
        order.bookingId, order.reference, order.userId, order.customerName, order.customerEmail,
        order.supplierId, supplierName, serviceTitle,
      )
      const updated = await sendMessage(thread.id, 'supplier', supplierName, text)
      if (!updated) throw new Error('send failed')
      setThreads(prev => prev.some(t => t.id === updated.id) ? prev.map(t => t.id === updated.id ? updated : t) : [...prev, updated])
      setActiveId(updated.id)
      setBody('')
    } catch {
      toast.error('Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border border-black/8 bg-white">
      {threads.length > 1 && (
        <div className="flex gap-1 flex-wrap px-3 pt-3">
          {threads.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`font-sans text-[11px] px-2.5 py-1 ${t.id === activeId ? 'bg-[#2d6a4f] text-white' : 'border border-black/10 text-black/50 hover:border-black/20'}`}
            >
              {t.addonTitle || t.bookingRef}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-72 overflow-y-auto space-y-2.5 p-3 bg-[#FAFAF9]">
        {loading ? (
          <p className="font-sans text-xs text-black/30 text-center py-4">Loading conversation…</p>
        ) : !active || active.messages.length === 0 ? (
          <p className="font-sans text-xs text-black/35 text-center py-4">
            No messages with {order.customerName} yet. They&apos;ll get a notification and can reply from their itinerary.
          </p>
        ) : active.messages.map(m => (
          <div key={m.id} className={`flex ${m.from === 'supplier' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 ${m.from === 'supplier' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-black/8 text-black/80'}`}>
              <p className={`font-sans text-[10px] mb-0.5 ${m.from === 'supplier' ? 'text-white/60' : 'text-black/40'}`}>{m.senderName}</p>
              <p className="font-sans text-sm leading-relaxed whitespace-pre-line">{m.body}</p>
              <p className={`font-sans text-[10px] mt-0.5 ${m.from === 'supplier' ? 'text-white/40' : 'text-black/30'}`}>
                {new Date(m.createdAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t border-black/6">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={`Message ${order.customerName}… (Enter to send)`}
          aria-label={`Message ${order.customerName}`}
          rows={2}
          className="flex-1 font-sans text-sm border border-black/10 px-3 py-2 outline-none focus:border-[#C9A96E]/50 resize-none"
        />
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="flex items-center gap-1.5 bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#235a3f] disabled:opacity-40"
          >
            <Send size={13} />{sending ? 'Sending…' : 'Send'}
          </button>
          <button onClick={load} className="flex items-center justify-center gap-1 font-sans text-[11px] text-black/40 hover:text-black/70" aria-label="Refresh conversation">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
