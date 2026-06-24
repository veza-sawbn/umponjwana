'use client'
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'

interface Message { id: string; guest: string; listing: string; preview: string; date: string; read: boolean }

const INIT: Message[] = [
  { id: 'm1', guest: 'Sarah van der Merwe', listing: 'Cathedral Peak Mountain Lodge', preview: 'Hi, do you have braai facilities for our group of 6?',             date: '2025-06-18', read: false },
  { id: 'm2', guest: 'Tom Kruger',           listing: 'Berg Valley Guesthouse',        preview: 'Is the guesthouse dog-friendly? We have a small labrador.',        date: '2025-06-17', read: false },
  { id: 'm3', guest: 'Amira Hassan',         listing: 'Cathedral Peak Mountain Lodge', preview: 'Can we arrange early check-in at 10am? Our trail starts at noon.', date: '2025-06-16', read: true  },
]

export default function MessagesPage() {
  const [messages, setMessages] = useState(INIT)
  const [selected, setSelected] = useState<Message | null>(null)

  function open(m: Message) {
    setSelected(m)
    setMessages(ms => ms.map(x => x.id === m.id ? { ...x, read: true } : x))
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Messages</h1>
        {messages.filter(m => !m.read).length > 0 && (
          <span className="font-sans text-xs bg-[#C9A96E] text-white px-2 py-0.5 rounded-full">{messages.filter(m => !m.read).length} new</span>
        )}
      </div>

      <div className="grid grid-cols-5 gap-4 h-[calc(100vh-200px)]">
        {/* List */}
        <div className="col-span-2 bg-white rounded-xl border border-black/8 overflow-y-auto">
          {messages.map((m, i) => (
            <button
              key={m.id}
              onClick={() => open(m)}
              className={`w-full text-left px-4 py-4 transition-colors ${selected?.id === m.id ? 'bg-[#C9A96E]/8' : 'hover:bg-black/3'} ${i < messages.length - 1 ? 'border-b border-black/6' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className={`font-sans text-sm ${m.read ? 'text-black/60' : 'font-semibold text-black/90'}`}>{m.guest}</p>
                <p className="font-sans text-[10px] text-black/30">{m.date}</p>
              </div>
              <p className="font-sans text-xs text-black/40 truncate">{m.preview}</p>
              {!m.read && <div className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] mt-1" />}
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="col-span-3 bg-white rounded-xl border border-black/8 flex flex-col">
          {selected ? (
            <>
              <div className="px-6 py-4 border-b border-black/6">
                <p className="font-sans font-semibold text-black/90">{selected.guest}</p>
                <p className="font-sans text-xs text-black/40">{selected.listing} · {selected.date}</p>
              </div>
              <div className="flex-1 p-6">
                <div className="bg-black/4 rounded-xl px-4 py-3 inline-block max-w-md">
                  <p className="font-sans text-sm text-black/80">{selected.preview}</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-black/6">
                <div className="flex gap-3">
                  <input placeholder="Type a reply…" className="flex-1 font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50" />
                  <button className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d]">Send</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-sans text-sm text-black/30">Select a message to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
