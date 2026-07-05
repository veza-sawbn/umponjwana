'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Users, CalendarDays, Bell, CheckCircle, Clock, Send } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getDepartures, updateDeparture, type Departure } from '@/lib/departures'
import {
  getSupplierEntities, updateSupplierEntity, type SupplierEntity,
} from '@/lib/supplier-entities'

interface BlockedRange { id: string; from: string; to: string; reason: string }
type Guide = SupplierEntity & { name: string; status: string; blocked?: BlockedRange[] }
type Dep = Departure & { guideNotified?: boolean }

const GUIDE_ENTITY = 'guides'

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  verified:  'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  'on leave': 'bg-amber-100 text-amber-700',
  inactive:  'bg-slate-100 text-slate-500',
}

function initialsOf(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function StaffPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [departures, setDepartures] = useState<Dep[]>([])
  const [loading, setLoading] = useState(true)
  const [blockForms, setBlockForms] = useState<Record<string, { from: string; to: string; reason: string }>>({})

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const today = new Date().toISOString().slice(0, 10)
      const [roster, deps] = await Promise.all([
        getSupplierEntities<Guide>(GUIDE_ENTITY, user.id),
        getDepartures(),
      ])
      setGuides(roster)
      setDepartures(
        (deps as Dep[])
          .filter(d => d.supplierId === user.id && d.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
      )
      setLoading(false)
    })
  }, [])

  function setBlockField(guideId: string, key: string, val: string) {
    setBlockForms(f => ({ ...f, [guideId]: { ...(f[guideId] ?? { from: '', to: '', reason: '' }), [key]: val } }))
  }

  async function addBlock(guideId: string) {
    const f = blockForms[guideId]
    if (!f?.from || !f?.to) return
    const guide = guides.find(g => g.id === guideId)
    if (!guide) return
    const blocked = [...(guide.blocked ?? []), { id: `blk-${Date.now()}`, from: f.from, to: f.to, reason: f.reason }]
    try {
      await updateSupplierEntity(GUIDE_ENTITY, guideId, { blocked })
      setGuides(gs => gs.map(g => g.id === guideId ? { ...g, blocked } : g))
      setBlockForms(fm => ({ ...fm, [guideId]: { from: '', to: '', reason: '' } }))
      toast.success('Unavailability saved.')
    } catch {
      toast.error('Could not save. Please try again.')
    }
  }

  async function removeBlock(guideId: string, blockId: string) {
    const guide = guides.find(g => g.id === guideId)
    if (!guide) return
    const blocked = (guide.blocked ?? []).filter(b => b.id !== blockId)
    try {
      await updateSupplierEntity(GUIDE_ENTITY, guideId, { blocked })
      setGuides(gs => gs.map(g => g.id === guideId ? { ...g, blocked } : g))
    } catch {
      toast.error('Could not remove. Please try again.')
    }
  }

  async function markNotified(depId: string) {
    try {
      await updateDeparture(depId, { guideNotified: true })
      setDepartures(ds => ds.map(d => d.id === depId ? { ...d, guideNotified: true } : d))
      toast.success('Marked as notified.')
    } catch {
      toast.error('Could not update. Please try again.')
    }
  }

  async function markAllNotified() {
    const pending = departures.filter(d => !d.guideNotified)
    if (pending.length === 0) return
    try {
      await Promise.all(pending.map(d => updateDeparture(d.id, { guideNotified: true })))
      setDepartures(ds => ds.map(d => ({ ...d, guideNotified: true })))
      toast.success(`Marked ${pending.length} departure${pending.length !== 1 ? 's' : ''} as notified.`)
    } catch {
      toast.error('Could not update all departures.')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Users size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Staff Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Guide availability */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={15} className="text-[#C9A96E]" />
            <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Guide Availability</h2>
          </div>

          {loading && <p className="font-sans text-sm text-black/30">Loading…</p>}
          {!loading && guides.length === 0 && (
            <div className="bg-white rounded-xl border border-black/8 p-6 text-center">
              <p className="font-sans text-sm text-black/40 mb-3">No guides registered yet.</p>
              <Link href="/supplier/guides" className="font-sans text-xs text-[#C9A96E] hover:underline">Register your guides →</Link>
            </div>
          )}

          {guides.map(g => {
            const bf = blockForms[g.id] ?? { from: '', to: '', reason: '' }
            return (
              <div key={g.id} className="bg-white rounded-xl border border-black/8 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                    <span className="font-sans text-xs font-semibold text-[#C9A96E]">{initialsOf(g.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-semibold text-black/80 truncate">{g.name}</p>
                    <span className={`font-sans text-[10px] px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[g.status] ?? STATUS_STYLE.pending}`}>{g.status}</span>
                  </div>
                </div>

                {(g.blocked ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    {(g.blocked ?? []).map(b => (
                      <div key={b.id} className="flex items-start justify-between gap-2 bg-black/3 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-sans text-xs font-medium text-black/70">{b.from} – {b.to}</p>
                          {b.reason && <p className="font-sans text-[10px] text-black/40">{b.reason}</p>}
                        </div>
                        <button onClick={() => removeBlock(g.id, b.id)} aria-label="Remove unavailability" className="font-sans text-[10px] text-red-400 hover:text-red-600 shrink-0">×</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 border-t border-black/6 pt-3">
                  <p className="font-sans text-[10px] font-semibold text-black/30 uppercase tracking-wider">Mark Unavailable</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="date" value={bf.from} onChange={e => setBlockField(g.id, 'from', e.target.value)} aria-label="Unavailable from" className={`${inp} text-xs`} />
                    <input type="date" value={bf.to} min={bf.from || undefined} onChange={e => setBlockField(g.id, 'to', e.target.value)} aria-label="Unavailable to" className={`${inp} text-xs`} />
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

        {/* Right: Departure reminders */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={15} className="text-[#C9A96E]" />
            <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Upcoming Departures</h2>
          </div>

          <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/6">
                  {['Tour', 'Date', 'Guide', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && departures.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center font-sans text-sm text-black/30">No upcoming departures — schedule one under Departures.</td></tr>
                )}
                {departures.map((d, i) => (
                  <tr key={d.id} className={i < departures.length - 1 ? 'border-b border-black/5' : ''}>
                    <td className="px-4 py-3 font-sans text-sm text-black/80 max-w-[160px]">
                      <span className="line-clamp-2">{d.tour}</span>
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-black/60 whitespace-nowrap">{d.date}</td>
                    <td className="px-4 py-3 font-sans text-sm text-black/60 whitespace-nowrap">{d.guide || 'Unassigned'}</td>
                    <td className="px-4 py-3">
                      {d.guideNotified ? (
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
                      {!d.guideNotified && (
                        <button
                          onClick={() => markNotified(d.id)}
                          className="font-sans text-xs text-[#C9A96E] hover:underline whitespace-nowrap"
                        >
                          Mark notified
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-black/8 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Send size={14} className="text-[#C9A96E]" />
              <p className="font-sans text-sm font-semibold text-black/70">Guide reminders</p>
            </div>
            <p className="font-sans text-xs text-black/40 leading-relaxed">
              Track which guides you&apos;ve briefed for upcoming departures. Contact guides directly
              by phone or WhatsApp, then mark the departure as notified.
            </p>
            <button
              onClick={markAllNotified}
              disabled={departures.every(d => d.guideNotified)}
              className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-40"
            >
              <CheckCircle size={14} /> Mark all as notified
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
