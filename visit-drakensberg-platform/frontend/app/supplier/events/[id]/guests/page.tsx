'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, CheckCircle2, XCircle, Clock, Plus } from 'lucide-react'
import { getEventById, sessionRemaining, type Event } from '@/lib/events'
import { getEventTickets, redeemTicket, addManualTicket, type Ticket } from '@/lib/tickets'

export default function EventGuestsPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionFilter, setSessionFilter] = useState<string>('')

  async function reload() {
    const [ev, tix] = await Promise.all([getEventById(id), getEventTickets(id)])
    setEvent(ev)
    setTickets(tix)
    if (!sessionFilter && ev?.sessions?.[0]) setSessionFilter(ev.sessions[0].id)
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [id])

  async function handleCheckIn(ticket: Ticket) {
    try {
      const result = await redeemTicket(ticket.id, ticket.token, 'manual')
      if (result.ok) {
        setTickets(prev => prev.map(t => t.id === ticket.id ? result.ticket : t))
        toast.success('Checked in.')
      } else if (result.reason === 'already_redeemed') {
        toast.error('Already checked in.')
      } else {
        toast.error('Could not check in this ticket.')
      }
    } catch {
      toast.error('Could not check in this ticket.')
    }
  }

  const [showManual, setShowManual] = useState(false)
  const [manualTier, setManualTier] = useState('')
  const [manualQty, setManualQty] = useState('1')

  async function handleAddWalkIn() {
    if (!event || !sessionFilter || !manualTier) return
    try {
      await addManualTicket({ eventId: event.id, sessionId: sessionFilter, ticketTypeId: manualTier, qty: parseInt(manualQty) || 1 })
      toast.success('Ticket(s) recorded.')
      setShowManual(false)
      setManualQty('1')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record this ticket.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <Navbar />
        <div className="pt-32 text-center font-sans text-sm text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <Navbar />
        <div className="pt-32 text-center">
          <p className="font-sans text-sm text-gray-500 mb-3">This event doesn&apos;t exist, or it belongs to another supplier.</p>
          <Link href="/supplier/events" className="font-sans text-sm text-[#2d6a4f] hover:underline">Back to events</Link>
        </div>
      </div>
    )
  }

  const visible = sessionFilter ? tickets.filter(t => t.sessionId === sessionFilter) : tickets
  const tierName = (id: string) => event.ticketTypes?.find(t => t.id === id)?.name ?? 'General'

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier/events" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Events
          </Link>
          <h1 className="font-display italic text-4xl lg:text-5xl">{event.title} — Guests</h1>
          <p className="mt-3 text-white/70 font-sans text-lg">
            Everyone who holds a ticket for this event, and who&apos;s been checked in.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {(event.sessions ?? []).map(s => (
            <button
              key={s.id}
              onClick={() => setSessionFilter(s.id)}
              className={`font-sans text-sm px-4 py-2 border transition-colors ${sessionFilter === s.id ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'border-gray-300 text-gray-600 hover:border-[#2d6a4f]'}`}
            >
              {new Date(s.starts_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              <span className="ml-2 text-xs opacity-70">{sessionRemaining(event, s.id)} left</span>
            </button>
          ))}
          <button
            onClick={() => { setShowManual(v => !v); setManualTier(event.ticketTypes?.[0]?.id ?? '') }}
            className="inline-flex items-center gap-1.5 font-sans text-sm text-[#2d6a4f] hover:underline ml-auto"
          >
            <Plus size={14} /> Record a walk-in ticket
          </button>
        </div>

        {showManual && (
          <div className="bg-white border border-gray-200 p-5 mb-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="block font-sans text-xs tracking-[0.1em] uppercase text-gray-500 mb-1">Ticket type</label>
              <select
                value={manualTier}
                onChange={e => setManualTier(e.target.value)}
                className="border border-gray-300 px-3 py-2 font-sans text-sm bg-white"
              >
                {(event.ticketTypes ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-sans text-xs tracking-[0.1em] uppercase text-gray-500 mb-1">Quantity</label>
              <input
                type="number"
                value={manualQty}
                onChange={e => setManualQty(e.target.value)}
                className="w-24 border border-gray-300 px-3 py-2 font-sans text-sm"
              />
            </div>
            <button onClick={handleAddWalkIn} className="bg-[#2d6a4f] text-white px-5 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors">
              Record
            </button>
            <p className="font-sans text-xs text-gray-400 w-full mt-1">
              For guests who already booked outside the platform — this reserves the same capacity a real sale would.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3 font-normal">Ticket</th>
                <th className="px-5 py-3 font-normal">Type</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(t => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-700">{t.code}</td>
                  <td className="px-5 py-3 text-gray-500">{tierName(t.ticketTypeId)}</td>
                  <td className="px-5 py-3">
                    {t.status === 'redeemed' ? (
                      <span className="inline-flex items-center gap-1.5 text-[#2d6a4f]">
                        <CheckCircle2 size={13} />
                        Checked in{t.redeemedAt ? ` · ${new Date(t.redeemedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    ) : t.status === 'void' ? (
                      <span className="inline-flex items-center gap-1.5 text-red-400"><XCircle size={13} /> Cancelled</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-400"><Clock size={13} /> Not checked in</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {t.status === 'issued' && (
                      <button
                        onClick={() => handleCheckIn(t)}
                        className="font-sans text-xs border border-[#2d6a4f] text-[#2d6a4f] px-3 py-1.5 hover:bg-[#2d6a4f] hover:text-white transition-colors"
                      >
                        Mark checked in
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No tickets for this date yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Footer />
    </div>
  )
}
