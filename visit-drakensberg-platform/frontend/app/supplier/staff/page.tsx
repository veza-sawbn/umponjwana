'use client'
import { useState } from 'react'
import { Users, CalendarDays, Bell, CheckCircle, Clock, Send } from 'lucide-react'

interface BlockedRange { id: string; from: string; to: string; reason: string }
interface Guide { id: string; name: string; initials: string; status: string; blocked: BlockedRange[] }

const DEPARTURES = [
  { id: '1', tour: 'Cathedral Peak Summit Hike',  date: '2025-07-12', guide: 'Bongani Ndlovu',   guideId: '1', notified: true  },
  { id: '2', tour: 'Amphitheatre Circular Trail',  date: '2025-07-19', guide: 'Zanele Mthembu',   guideId: '3', notified: false },
  { id: '3', tour: 'Giants Castle Cultural Tour',  date: '2025-08-02', guide: 'Marné du Plessis', guideId: '2', notified: true  },
]

const INIT_GUIDES: Guide[] = [
  { id: '1', name: 'Bongani Ndlovu',   initials: 'BN', status: 'active', blocked: [{ id: 'b1', from: '2025-08-10', to: '2025-08-15', reason: 'Family commitment' }] },
  { id: '2', name: 'Marné du Plessis', initials: 'MD', status: 'active', blocked: [] },
  { id: '3', name: 'Zanele Mthembu',   initials: 'ZM', status: 'active', blocked: [] },
]

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  'on leave': 'bg-amber-100 text-amber-700',
  inactive:  'bg-slate-100 text-slate-500',
}

export default function StaffPage() {
  const [guides, setGuides]                 = useState(INIT_GUIDES)
  const [departures, setDepartures]         = useState(DEPARTURES)
  const [blockForms, setBlockForms]         = useState<Record<string, { from: string; to: string; reason: string }>>({})
  const [bulkMessage, setBulkMessage]       = useState('')
  const [bulkSent, setBulkSent]             = useState(false)

  function setBlockField(guideId: string, key: string, val: string) {
    setBlockForms(f => ({ ...f, [guideId]: { ...(f[guideId] ?? { from: '', to: '', reason: '' }), [key]: val } }))
  }

  function addBlock(guideId: string) {
    const f = blockForms[guideId]
    if (!f?.from || !f?.to) return
    setGuides(gs => gs.map(g => g.id !== guideId ? g : {
      ...g,
      blocked: [...g.blocked, { id: Date.now().toString(), from: f.from, to: f.to, reason: f.reason }],
    }))
    setBlockForms(f => ({ ...f, [guideId]: { from: '', to: '', reason: '' } }))
  }

  function removeBlock(guideId: string, blockId: string) {
    setGuides(gs => gs.map(g => g.id !== guideId ? g : { ...g, blocked: g.blocked.filter(b => b.id !== blockId) }))
  }

  function notify(depId: string) {
    setDepartures(ds => ds.map(d => d.id === depId ? { ...d, notified: true } : d))
  }

  function sendBulk() {
    if (!bulkMessage.trim()) return
    setDepartures(ds => ds.map(d => ({ ...d, notified: true })))
    setBulkSent(true)
    setBulkMessage('')
    setTimeout(() => setBulkSent(false), 4000)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Users size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Staff Management</h1>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left: Guide availability */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={15} className="text-[#C9A96E]" />
            <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Availability</h2>
          </div>

          {guides.map(g => {
            const bf = blockForms[g.id] ?? { from: '', to: '', reason: '' }
            return (
              <div key={g.id} className="bg-white rounded-xl border border-black/8 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                    <span className="font-sans text-xs font-semibold text-[#C9A96E]">{g.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-semibold text-black/80 truncate">{g.name}</p>
                    <span className={`font-sans text-[10px] px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[g.status]}`}>{g.status}</span>
                  </div>
                </div>

                {/* Blocked dates */}
                {g.blocked.length > 0 && (
                  <div className="space-y-1.5">
                    {g.blocked.map(b => (
                      <div key={b.id} className="flex items-start justify-between gap-2 bg-black/3 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-sans text-xs font-medium text-black/70">{b.from} – {b.to}</p>
                          {b.reason && <p className="font-sans text-[10px] text-black/40">{b.reason}</p>}
                        </div>
                        <button onClick={() => removeBlock(g.id, b.id)} className="font-sans text-[10px] text-red-400 hover:text-red-600 shrink-0">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add block form */}
                <div className="space-y-2 border-t border-black/6 pt-3">
                  <p className="font-sans text-[10px] font-semibold text-black/30 uppercase tracking-wider">Mark Unavailable</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="date" value={bf.from} onChange={e => setBlockField(g.id, 'from', e.target.value)} placeholder="From" className={`${inp} text-xs`} />
                    <input type="date" value={bf.to} onChange={e => setBlockField(g.id, 'to', e.target.value)} placeholder="To" className={`${inp} text-xs`} />
                  </div>
                  <div className="flex gap-1.5">
                    <input value={bf.reason} onChange={e => setBlockField(g.id, 'reason', e.target.value)} placeholder="Reason (optional)" className={`${inp} text-xs flex-1`} />
                    <button onClick={() => addBlock(g.id)} className="bg-[#C9A96E] text-white font-sans text-xs px-3 py-1.5 rounded-lg hover:bg-[#b8965d] shrink-0">Add</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: Notifications */}
        <div className="col-span-3 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={15} className="text-[#C9A96E]" />
            <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Upcoming Departures</h2>
          </div>

          <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/6">
                  {['Tour', 'Date', 'Guide', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departures.map((d, i) => (
                  <tr key={d.id} className={i < departures.length - 1 ? 'border-b border-black/5' : ''}>
                    <td className="px-4 py-3 font-sans text-sm text-black/80 max-w-[160px]">
                      <span className="line-clamp-2">{d.tour}</span>
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-black/60 whitespace-nowrap">{d.date}</td>
                    <td className="px-4 py-3 font-sans text-sm text-black/60 whitespace-nowrap">{d.guide}</td>
                    <td className="px-4 py-3">
                      {d.notified ? (
                        <span className="flex items-center gap-1 font-sans text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <CheckCircle size={10} /> Guide notified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-sans text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <Clock size={10} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => notify(d.id)}
                        className="font-sans text-xs text-[#C9A96E] hover:underline whitespace-nowrap"
                      >
                        {d.notified ? 'Re-notify' : 'Notify Now'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk notification */}
          <div className="bg-white rounded-xl border border-black/8 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Send size={14} className="text-[#C9A96E]" />
              <p className="font-sans text-sm font-semibold text-black/70">Send Bulk Notification</p>
            </div>
            <textarea
              value={bulkMessage}
              onChange={e => setBulkMessage(e.target.value)}
              rows={3}
              placeholder="Type a message to send to all assigned guides for upcoming departures…"
              className={`${inp} resize-none`}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={sendBulk}
                className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors"
              >
                <Send size={14} /> Send to All Assigned Guides
              </button>
              {bulkSent && (
                <span className="flex items-center gap-1.5 font-sans text-sm text-emerald-600">
                  <CheckCircle size={14} /> Notifications sent to {departures.length} guides
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
