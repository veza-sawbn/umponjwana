'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, ScanLine, KeyRound, Bus, RefreshCw, Users } from 'lucide-react'
import {
  redeemTicket, getTicketByCode, getTicketById, getDepartureTickets, type Ticket, type RedeemResult,
} from '@/lib/tickets'
import { getEventById } from '@/lib/events'
import { timeslotsForDate, type Activity } from '@/lib/activities'
import { todayISO } from '@/lib/upcoming'

// The boarding screen. Given day tours (`loadDayTours`), the user picks the
// departure they are running and the manifest below shows every booked seat
// grouped by hotel pickup; they scan each guest's QR (or type their code) as
// they board. Grand Tour day tours are boarded by VD Operations
// (/operations/boarding); suppliers use this without day tours, as a plain
// scanner for their own event tickets (/supplier/check-in). The database
// enforces that split, not this component — see vd_redeem_ticket in
// supabase/migrations/20261008_grand_tour_ops_only.sql.

type Outcome = {
  kind: 'success' | 'duplicate' | 'invalid' | 'mismatch'
  message: string
  detail?: string
  ticket?: Ticket
}

type Departure = { activityId: string; date: string; timeslotId: string }

const SCANNER_ID = 'vd-check-in-reader'

/** A refused or failed check-in, worded for the person holding the scanner. */
function failure(err: unknown): Outcome {
  const msg = err instanceof Error ? err.message : ''
  if (/VD Operations/i.test(msg)) return { kind: 'invalid', message: 'Grand Tour tickets are boarded by VD Operations.' }
  if (/not authorized/i.test(msg)) return { kind: 'invalid', message: 'This ticket isn’t for one of the tours or events you check in.' }
  return { kind: 'invalid', message: 'Could not check in this ticket. Try again.' }
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

export default function BoardingConsole({
  title, intro, loadDayTours,
}: {
  title: string
  intro: string
  /** Day tours whose departures this user boards. Omit for a scanner only. */
  loadDayTours?: () => Promise<Activity[]>
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const scannerRef = useRef<import('html5-qrcode').Html5QrcodeScanner | null>(null)
  const busyRef = useRef(false)

  const [activities, setActivities] = useState<Activity[]>([])
  const [activityId, setActivityId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [timeslotId, setTimeslotId] = useState('')
  const [manifest, setManifest] = useState<Ticket[]>([])
  const [manifestLoading, setManifestLoading] = useState(false)

  const activity = activities.find(a => a.id === activityId)
  const daySlots = activity ? timeslotsForDate(activity, date) : []
  const departure: Departure | null = activityId && timeslotId ? { activityId, date, timeslotId } : null
  const departureRef = useRef<Departure | null>(null)
  departureRef.current = departure

  useEffect(() => {
    if (!loadDayTours) return
    loadDayTours()
      .then(all => {
        const scheduled = all
          .filter(a => (a.timeslots?.length ?? 0) > 0)
          .sort((a, b) => a.name.localeCompare(b.name))
        setActivities(scheduled)
        if (scheduled.length === 1) setActivityId(scheduled[0].id)
      })
      .catch(() => setActivities([]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Default to the first departure running on the chosen day.
  useEffect(() => {
    if (!activity) { setTimeslotId(''); return }
    const slots = timeslotsForDate(activity, date)
    if (!slots.some(s => s.id === timeslotId)) setTimeslotId(slots[0]?.id ?? '')
  }, [activity, date, timeslotId])

  const loadManifest = useCallback(async () => {
    if (!departure) { setManifest([]); return }
    setManifestLoading(true)
    try {
      setManifest(await getDepartureTickets(departure.activityId, departure.date, departure.timeslotId))
    } finally {
      setManifestLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departure?.activityId, departure?.date, departure?.timeslotId])

  useEffect(() => { loadManifest() }, [loadManifest])

  useEffect(() => {
    let cancelled = false
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (cancelled) return
      const scanner = new Html5QrcodeScanner(SCANNER_ID, { fps: 10, qrbox: 240 }, false)
      scanner.render(
        // The scanner is created once; go through the ref so each scan runs
        // the latest handler, with the current departure and manifest.
        decodedText => { decodedRef.current(decodedText) },
        () => {}, // per-frame "no QR found" noise — nothing to surface
      )
      scannerRef.current = scanner
    }).catch(() => setCameraError(true))

    return () => {
      cancelled = true
      scannerRef.current?.clear().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function describe(ticket: Ticket): Promise<string> {
    if (ticket.activityId) {
      const name = activities.find(a => a.id === ticket.activityId)?.name ?? 'Day tour'
      const parts = [name]
      if (ticket.slotDate) parts.push(`${fmtDate(ticket.slotDate)}${ticket.departureTime ? ` ${ticket.departureTime}` : ''}`)
      if (ticket.pickupLabel) parts.push(`pickup ${ticket.pickupLabel}${ticket.pickupTime ? ` ${ticket.pickupTime}` : ''}`)
      return parts.join(' · ')
    }
    if (!ticket.eventId) return ''
    const event = await getEventById(ticket.eventId).catch(() => null)
    const tier = event?.ticketTypes?.find(t => t.id === ticket.ticketTypeId)?.name
    return [event?.title, tier].filter(Boolean).join(' · ')
  }

  async function report(result: RedeemResult) {
    if (result.ok) {
      setOutcome({
        kind: 'success',
        message: result.ticket.holderName ? `Welcome aboard, ${result.ticket.holderName.split(' ')[0]}` : 'Checked in',
        detail: await describe(result.ticket),
        ticket: result.ticket,
      })
      loadManifest()
      return
    }
    const detail = result.ticket ? await describe(result.ticket) : undefined
    if (result.reason === 'already_redeemed') {
      setOutcome({
        kind: 'duplicate',
        message: result.redeemedAt
          ? `Already checked in at ${new Date(result.redeemedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
          : 'Already checked in',
        detail,
        ticket: result.ticket,
      })
    } else if (result.reason === 'wrong_date') {
      setOutcome({ kind: 'invalid', message: 'Not valid today', detail: detail ? `This seat is for ${detail}` : undefined, ticket: result.ticket })
    } else if (result.reason === 'void') {
      setOutcome({ kind: 'invalid', message: 'This ticket was cancelled.', detail, ticket: result.ticket })
    } else {
      setOutcome({ kind: 'invalid', message: 'Not a valid ticket for one of your tours or events.' })
    }
  }

  /** Checks the ticket belongs on the selected departure before boarding it. */
  async function checkIn(ticketId: string, token: string, via: 'scan' | 'manual', force = false) {
    const dep = departureRef.current
    if (dep && !force) {
      const ticket = await getTicketById(ticketId)
      if (ticket && ticket.token === token && ticket.status === 'issued' && (
        ticket.activityId !== dep.activityId || ticket.slotDate !== dep.date || ticket.timeslotId !== dep.timeslotId
      )) {
        setOutcome({
          kind: 'mismatch',
          message: 'Booked on a different departure',
          detail: await describe(ticket),
          ticket,
        })
        return
      }
    }
    await report(await redeemTicket(ticketId, token, via))
  }

  async function handleDecoded(decodedText: string) {
    if (busyRef.current) return
    busyRef.current = true
    scannerRef.current?.pause(true)
    try {
      const [ticketId, token] = decodedText.split(':')
      if (!ticketId || !token) {
        setOutcome({ kind: 'invalid', message: 'This QR code isn’t a Visit Drakensberg ticket.' })
        return
      }
      await checkIn(ticketId, token, 'scan')
    } catch (err) {
      setOutcome(failure(err))
    }
  }

  const decodedRef = useRef(handleDecoded)
  decodedRef.current = handleDecoded

  function scanNext() {
    setOutcome(null)
    busyRef.current = false
    scannerRef.current?.resume()
  }

  async function handleManualCheckIn() {
    if (!manualCode.trim()) return
    setManualBusy(true)
    busyRef.current = true
    scannerRef.current?.pause(true)
    try {
      const ticket = await getTicketByCode(manualCode.trim())
      if (!ticket) {
        setOutcome({ kind: 'invalid', message: 'No ticket found with that code.' })
      } else {
        await checkIn(ticket.id, ticket.token, 'manual')
      }
      setManualCode('')
    } catch (err) {
      setOutcome(failure(err))
    } finally {
      setManualBusy(false)
    }
  }

  async function boardFromManifest(ticket: Ticket) {
    busyRef.current = true
    scannerRef.current?.pause(true)
    try {
      await report(await redeemTicket(ticket.id, ticket.token, 'manual'))
    } catch (err) {
      setOutcome(failure(err))
    }
  }

  const byPickup = useMemo(() => {
    const groups = new Map<string, { label: string; time: string | null; tickets: Ticket[] }>()
    for (const t of manifest) {
      const key = t.pickupLabel ?? ''
      const g = groups.get(key) ?? { label: t.pickupLabel ?? 'Meeting point', time: t.pickupTime, tickets: [] }
      g.tickets.push(t)
      groups.set(key, g)
    }
    return Array.from(groups.values()).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  }, [manifest])
  const liveSeats = manifest.filter(t => t.status !== 'void')
  const boarded = liveSeats.filter(t => t.status === 'redeemed').length

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3">
          <ScanLine size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">{title}</h1>
        </div>
        <p className="font-sans text-sm text-black/50 mt-1">{intro}</p>
      </div>

      {activities.length > 0 && (
        <div className="bg-white rounded-xl border border-black/8 p-5 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="block font-sans text-[11px] uppercase tracking-wider text-black/40 mb-1.5">Tour</span>
            <select value={activityId} onChange={e => setActivityId(e.target.value)} className="w-full border border-black/15 rounded-lg px-3 py-2 font-sans text-sm">
              <option value="">Any ticket</option>
              {activities.map(a => <option key={a.id} value={a.id}>{a.name}{a.grandTour?.enabled ? ' · Grand Tour' : ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block font-sans text-[11px] uppercase tracking-wider text-black/40 mb-1.5">Date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={!activityId} className="w-full border border-black/15 rounded-lg px-3 py-2 font-sans text-sm disabled:opacity-40" />
          </label>
          <label className="block">
            <span className="block font-sans text-[11px] uppercase tracking-wider text-black/40 mb-1.5">Departure</span>
            <select value={timeslotId} onChange={e => setTimeslotId(e.target.value)} disabled={!activityId || daySlots.length === 0} className="w-full border border-black/15 rounded-lg px-3 py-2 font-sans text-sm disabled:opacity-40">
              {daySlots.length === 0 ? <option value="">{activityId ? 'None this day' : '—'}</option> : daySlots.map(s => <option key={s.id} value={s.id}>{s.time}</option>)}
            </select>
          </label>
        </div>
      )}

      {outcome ? (
        <div
          role="status"
          className={`rounded-xl p-8 text-center border-2 ${
            outcome.kind === 'success' ? 'bg-emerald-50 border-emerald-500'
            : outcome.kind === 'invalid' ? 'bg-red-50 border-red-400'
            : 'bg-amber-50 border-amber-400'
          }`}
        >
          {outcome.kind === 'success' ? <CheckCircle2 size={48} className="text-emerald-600 mx-auto mb-3" />
            : outcome.kind === 'invalid' ? <XCircle size={48} className="text-red-500 mx-auto mb-3" />
            : <AlertCircle size={48} className="text-amber-500 mx-auto mb-3" />}
          <p className="font-display italic text-2xl mb-1">{outcome.message}</p>
          {outcome.detail && <p className="font-sans text-sm text-black/60">{outcome.detail}</p>}
          {outcome.ticket && <p className="font-sans text-xs text-black/40 mt-1">{outcome.ticket.code}{outcome.ticket.holderName ? ` · ${outcome.ticket.holderName}` : ''}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {outcome.kind === 'mismatch' && outcome.ticket && (
              <button
                onClick={() => checkIn(outcome.ticket!.id, outcome.ticket!.token, 'manual', true)}
                className="border border-amber-500 text-amber-700 px-5 py-2.5 rounded-lg font-sans text-sm font-medium hover:bg-amber-100"
              >
                Board anyway
              </button>
            )}
            <button onClick={scanNext} className="bg-[#2d6a4f] text-white px-6 py-2.5 rounded-lg font-sans text-sm font-medium hover:bg-[#235a3f]">
              Scan next ticket
            </button>
          </div>
        </div>
      ) : null}

      {/* The reader stays mounted (hidden while a result shows) so pausing
          and resuming it does not have to restart the camera. */}
      <div className={outcome ? 'hidden' : ''}>
        <div id={SCANNER_ID} className="bg-white rounded-xl border border-black/8 overflow-hidden" />
        {cameraError && (
          <p className="font-sans text-sm text-red-500 mt-3 text-center">
            Couldn&apos;t start the camera. You can still check guests in by code or from the manifest below.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-black/8 p-5">
        <p className="font-sans text-[11px] tracking-wider uppercase text-black/40 mb-3 flex items-center gap-2">
          <KeyRound size={13} /> No camera? Enter the ticket code
        </p>
        <div className="flex gap-3">
          <input
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualCheckIn()}
            placeholder="TIX-XXXXXXXX"
            className="flex-1 min-w-0 border border-black/15 rounded-lg px-4 py-2.5 font-sans text-sm uppercase focus:outline-none focus:border-[#2d6a4f]"
          />
          <button
            onClick={handleManualCheckIn}
            disabled={manualBusy || !manualCode.trim()}
            className="bg-[#2d6a4f] text-white px-5 py-2.5 rounded-lg font-sans text-sm font-medium hover:bg-[#235a3f] disabled:opacity-40"
          >
            Check in
          </button>
        </div>
      </div>

      {departure && (
        <div className="bg-white rounded-xl border border-black/8">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/8">
            <div>
              <p className="font-sans font-semibold text-black/90 flex items-center gap-2"><Bus size={16} className="text-[#C9A96E]" /> Manifest</p>
              <p className="font-sans text-xs text-black/50 mt-0.5">
                {activity?.name} · {fmtDate(date)} · {daySlots.find(s => s.id === timeslotId)?.time}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-sans text-sm text-black/70 flex items-center gap-1.5"><Users size={14} /> {boarded}/{liveSeats.length} boarded</span>
              <button onClick={loadManifest} aria-label="Refresh manifest" className="p-1.5 text-black/40 hover:text-black/80">
                <RefreshCw size={15} className={manifestLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          {manifest.length === 0 ? (
            <p className="px-5 py-8 font-sans text-sm text-black/40 text-center">
              {manifestLoading ? 'Loading…' : 'No paid seats on this departure yet.'}
            </p>
          ) : (
            byPickup.map(g => (
              <div key={g.label} className="border-b border-black/5 last:border-0">
                <p className="px-5 pt-4 pb-2 font-sans text-[11px] uppercase tracking-wider text-black/50">
                  {g.label}{g.time ? ` · ${g.time}` : ''} · {g.tickets.filter(t => t.status !== 'void').length} seat{g.tickets.filter(t => t.status !== 'void').length === 1 ? '' : 's'}
                </p>
                <ul>
                  {g.tickets.map(t => (
                    <li key={t.id} className={`flex items-center justify-between gap-3 px-5 py-2.5 ${t.status === 'void' ? 'opacity-40' : ''}`}>
                      <div className="min-w-0">
                        <p className="font-sans text-sm text-black/85 truncate">{t.holderName || 'Guest'}</p>
                        <p className="font-sans text-[11px] text-black/40">{t.code}</p>
                      </div>
                      {t.status === 'redeemed' ? (
                        <span className="font-sans text-xs text-emerald-700 flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={13} /> {t.redeemedAt ? new Date(t.redeemedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : 'Boarded'}
                        </span>
                      ) : t.status === 'void' ? (
                        <span className="font-sans text-xs text-red-500 shrink-0">Cancelled</span>
                      ) : (
                        <button onClick={() => boardFromManifest(t)} className="font-sans text-xs border border-[#2d6a4f] text-[#2d6a4f] rounded-lg px-3 py-1.5 hover:bg-[#2d6a4f] hover:text-white shrink-0">
                          Board
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
