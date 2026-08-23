'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bus, Calendar, Check, Clock, MapPin, Phone, Plane, Play, Route, Truck, Users, X } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import {
  acceptTransportRequest, assignDriverToRequest, completeTrip, declineTransportRequest,
  driverAvailable, getFleet, getMyTransportCompany, getTransportRequests, startTrip,
  vehicleAvailableOn, vehicleSeats,
  type TransportCompany, type TransportDriver, type TransportRequest, type TransportVehicle,
} from '@/lib/transport'

// Transport job board. Opportunities arrive ranked by the dispatch engine;
// accepting reserves a vehicle, assigning a driver puts them on duty,
// completing the trip frees both again — no manual calendar upkeep.

const STATUS_LABEL: Record<string, string> = {
  offered: 'New opportunity',
  accepted: 'Accepted — assign a driver',
  driver_assigned: 'Driver assigned — ready to go',
  in_progress: 'Trip in progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  unassigned: 'Reassigned',
}

const STATUS_STYLE: Record<string, string> = {
  offered: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  driver_assigned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-600',
  unassigned: 'bg-slate-100 text-slate-500',
}

export default function TransportJobsPage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [company, setCompany] = useState<TransportCompany | null>(null)
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([])
  const [drivers, setDrivers] = useState<TransportDriver[]>([])
  const [vehiclePick, setVehiclePick] = useState<Record<string, string>>({})
  const [driverPick, setDriverPick] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    if (!data.user) { setLoading(false); return }
    const ownerId = effectiveSupplierId(data.user.id)
    setUserId(ownerId)
    const [myCompany, myRequests, fleet] = await Promise.all([
      getMyTransportCompany(ownerId),
      getTransportRequests(),
      getFleet(ownerId),
    ])
    setCompany(myCompany)
    setRequests(myRequests)
    setVehicles(fleet.vehicles)
    setDrivers(fleet.drivers)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  const mine = useMemo(() => {
    if (!userId) return { open: [] as TransportRequest[], active: [] as TransportRequest[], history: [] as TransportRequest[] }
    const offeredToMe = (r: TransportRequest) =>
      r.status === 'offered' && r.offers.some(o => o.supplierId === userId && o.offeredAt && !o.response)
    const assignedToMe = (r: TransportRequest) => r.assignment?.supplierId === userId
    return {
      open: requests.filter(offeredToMe),
      active: requests.filter(r => assignedToMe(r) && ['accepted', 'driver_assigned', 'in_progress'].includes(r.status)),
      history: requests.filter(r => assignedToMe(r) && ['completed', 'cancelled'].includes(r.status)),
    }
  }, [requests, userId])

  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id)
    try {
      await action()
      await load()
    } catch (err) {
      console.error('Transport job action failed:', err)
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="p-8"><p className="font-sans text-sm text-black/40">Loading transport jobs…</p></div>

  if (!company) {
    return (
      <div className="p-8 space-y-4">
        <div className="flex items-center gap-3"><Route size={20} className="text-[#C9A96E]" /><h1 className="font-display italic text-2xl text-black/90">Transport Jobs</h1></div>
        <div className="bg-white rounded-xl border border-black/8 p-6 max-w-xl">
          <p className="font-sans text-sm text-black/60 mb-4">
            Register your transport company first — booking opportunities are matched to registered companies by
            category, region, fleet availability, reliability and price.
          </p>
          <Link href="/supplier/transport" className="inline-flex items-center gap-2 rounded-lg bg-[#C9A96E] px-4 py-2 font-sans text-sm text-white hover:bg-[#b8965d]">
            Register transport company <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-3">
        <Route size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Transport Jobs</h1>
      </div>

      <Section title={`New opportunities (${mine.open.length})`} empty={mine.open.length === 0} emptyText="No open opportunities right now. You are notified the moment a matching trip is generated.">
        {mine.open.map(request => {
          const myOffer = request.offers.find(o => o.supplierId === userId)
          const usable = vehicles.filter(v => vehicleAvailableOn(v, request.date) && vehicleSeats(v) >= request.passengers)
          const requestedUsable = request.requestedVehicleId && usable.some(v => v.id === request.requestedVehicleId)
            ? request.requestedVehicleId
            : undefined
          const picked = vehiclePick[request.id] ?? requestedUsable ?? usable[0]?.id ?? ''
          const vehicle = usable.find(v => v.id === picked)
          return (
            <JobCard key={request.id} request={request}>
              {request.requestedVehicleName ? (
                <p className="font-sans text-xs text-black/45">
                  The customer chose <span className="font-semibold text-[#C9A96E]">{request.requestedVehicleName}</span> for this trip
                  {!requestedUsable && ' — it is no longer available on that date, pick a substitute'}.
                </p>
              ) : myOffer && (
                <p className="font-sans text-xs text-black/45">
                  You ranked <span className="font-semibold text-[#C9A96E]">#{myOffer.rank}</span> for this trip
                  (suitability {myOffer.score}/115).
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <select value={picked} onChange={e => setVehiclePick(c => ({ ...c, [request.id]: e.target.value }))}
                  className="font-sans text-xs border border-black/10 rounded-lg px-3 py-2 bg-white">
                  {usable.length === 0 && <option value="">No available vehicle fits {request.passengers} pax</option>}
                  {usable.map(v => <option key={v.id} value={v.id}>{v.name ?? [v.make, v.model].filter(Boolean).join(' ')} · {vehicleSeats(v)} seats</option>)}
                </select>
                <button
                  disabled={!vehicle || busy === request.id}
                  onClick={() => vehicle && run(request.id, () => acceptTransportRequest(request, company, vehicle))}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-sans text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
                  <Check size={13} /> Accept — reserve vehicle
                </button>
                <button
                  disabled={busy === request.id}
                  onClick={() => run(request.id, () => declineTransportRequest(request, company))}
                  className="flex items-center gap-1.5 rounded-lg border border-black/10 px-4 py-2 font-sans text-xs text-black/60 hover:border-black/30 disabled:opacity-50">
                  <X size={13} /> Decline
                </button>
              </div>
            </JobCard>
          )
        })}
      </Section>

      <Section title={`Active trips (${mine.active.length})`} empty={mine.active.length === 0} emptyText="No active trips.">
        {mine.active.map(request => {
          const availableDrivers = drivers.filter(driverAvailable)
          const pickedDriver = driverPick[request.id] ?? availableDrivers[0]?.id ?? ''
          const driver = availableDrivers.find(d => d.id === pickedDriver)
          return (
            <JobCard key={request.id} request={request}>
              <p className="font-sans text-xs text-black/45 flex items-center gap-1.5">
                <Truck size={12} className="text-[#C9A96E]" /> {request.assignment?.vehicleName ?? 'Vehicle'} reserved
                {request.assignment?.driverName && <> · driver {request.assignment.driverName}</>}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {request.status === 'accepted' && (
                  <>
                    <select value={pickedDriver} onChange={e => setDriverPick(c => ({ ...c, [request.id]: e.target.value }))}
                      className="font-sans text-xs border border-black/10 rounded-lg px-3 py-2 bg-white">
                      {availableDrivers.length === 0 && <option value="">No available drivers</option>}
                      {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.fullName ?? d.name ?? 'Driver'}</option>)}
                    </select>
                    <button
                      disabled={!driver || busy === request.id}
                      onClick={() => driver && run(request.id, () => assignDriverToRequest(request, driver))}
                      className="flex items-center gap-1.5 rounded-lg bg-[#C9A96E] px-4 py-2 font-sans text-xs text-white hover:bg-[#b8965d] disabled:opacity-50">
                      <Users size={13} /> Assign driver
                    </button>
                  </>
                )}
                {request.status === 'driver_assigned' && (
                  <button
                    disabled={busy === request.id}
                    onClick={() => run(request.id, () => startTrip(request))}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-sans text-xs text-white hover:bg-indigo-700 disabled:opacity-50">
                    <Play size={13} /> Start trip
                  </button>
                )}
                {request.status === 'in_progress' && (
                  <button
                    disabled={busy === request.id}
                    onClick={() => run(request.id, () => completeTrip(request, company))}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-sans text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
                    <Check size={13} /> Complete trip — free vehicle
                  </button>
                )}
              </div>
            </JobCard>
          )
        })}
      </Section>

      <Section title={`History (${mine.history.length})`} empty={mine.history.length === 0} emptyText="Completed trips build your reliability score and unlock better-ranked opportunities.">
        {mine.history.slice(0, 12).map(request => <JobCard key={request.id} request={request} />)}
      </Section>
    </div>
  )
}

function Section({ title, empty, emptyText, children }: { title: string; empty: boolean; emptyText: string; children?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-sm font-semibold text-black/70">{title}</h2>
      {empty ? <p className="font-sans text-sm text-black/35">{emptyText}</p> : <div className="grid gap-3">{children}</div>}
    </section>
  )
}

function JobCard({ request, children }: { request: TransportRequest; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-black/8 p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-sans text-sm font-semibold text-black/90">
            <span className="truncate">{request.pickup.address}</span>
            <ArrowRight size={14} className="shrink-0 text-[#C9A96E]" />
            <span className="truncate">{request.dropoff.address}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-1.5 font-sans text-xs text-black/40">
            <span className="flex items-center gap-1"><Calendar size={11} /> {request.date}{request.time ? ` · ${request.time}` : ''}</span>
            <span className="flex items-center gap-1"><Users size={11} /> {request.passengers} pax</span>
            {request.distanceKm !== undefined && <span className="flex items-center gap-1"><MapPin size={11} /> {request.distanceKm} km</span>}
            {request.durationMinutes !== undefined && <span className="flex items-center gap-1"><Clock size={11} /> ~{Math.round(request.durationMinutes)} min</span>}
            <span className="flex items-center gap-1"><Bus size={11} /> {request.shuttleType ?? 'Transfer'} · {request.tripClass} trip</span>
            {request.bookingReference && <span>Ref {request.bookingReference}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-display italic text-lg text-black/85">R {request.quotedPrice.toLocaleString()}</span>
          <span className={`font-sans text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[request.status] ?? 'bg-slate-100 text-slate-500'}`}>
            {STATUS_LABEL[request.status] ?? request.status}
          </span>
        </div>
      </div>
      <MeetAndGreetSummary request={request} />
      {children}
    </div>
  )
}

/** Passenger-tracking details the guest supplied for the meet & greet. */
function MeetAndGreetSummary({ request }: { request: TransportRequest }) {
  const details = request.meetAndGreet
  if (!details || Object.values(details).every(v => !v)) return null
  return (
    <div className="rounded-lg bg-[#F7F5F2] px-4 py-3">
      <p className="font-sans text-[11px] uppercase tracking-wide text-black/35 mb-1.5">Meet & greet — passenger tracking</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-xs text-black/60">
        {details.flightNumber && (
          <span className="flex items-center gap-1">
            <Plane size={11} className="text-[#C9A96E]" />
            {details.flightNumber}{details.airline ? ` (${details.airline})` : ''}
          </span>
        )}
        {details.arrivalTime && <span className="flex items-center gap-1"><Clock size={11} className="text-[#C9A96E]" /> Arrives {details.arrivalTime}</span>}
        {details.nameBoard && <span>Name board: <span className="font-medium">{details.nameBoard}</span></span>}
        {details.contactPhone && <span className="flex items-center gap-1"><Phone size={11} className="text-[#C9A96E]" /> {details.contactPhone}</span>}
        {details.luggage && <span>Luggage: {details.luggage}</span>}
        {details.childSeats && <span>Child seats: {details.childSeats}</span>}
      </div>
      {details.notes && <p className="font-sans text-xs text-black/45 mt-1.5">“{details.notes}”</p>}
    </div>
  )
}
