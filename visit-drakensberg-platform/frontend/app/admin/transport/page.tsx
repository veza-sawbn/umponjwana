'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Bus, Calendar, ChevronDown, ChevronUp, MapPin, RefreshCw,
  Sparkles, Truck, Users, Zap,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import {
  acceptTransportRequest, cancelTransportRequest, getTransportCompanies, getTransportRequests,
  SUPPLIER_CATEGORIES, vehicleAvailableOn, vehicleSeats, getFleet,
  type TransportCompany, type TransportRequest,
} from '@/lib/transport'
import { rankSuppliers, OFFER_SHORTLIST_SIZE, type ScoredCandidate } from '@/lib/transport-dispatch'
import { areaName, runTransportOptimisation, type TransportInsights } from '@/lib/transport-optimizer'
import { notify } from '@/lib/notifications'

// Dispatch console: every transport request with its suitability ranking,
// manual/auto assignment, marketplace fleet overview, and the background
// optimisation service (runs on an interval while this console is open).

const OPTIMISER_INTERVAL_MS = 60_000

const STATUS_STYLE: Record<string, string> = {
  offered: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  driver_assigned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-600',
  unassigned: 'bg-red-100 text-red-600',
  pending: 'bg-amber-100 text-amber-700',
}

export default function AdminTransportPage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [companies, setCompanies] = useState<TransportCompany[]>([])
  const [insights, setInsights] = useState<TransportInsights | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [ranking, setRanking] = useState<Record<string, ScoredCandidate[]>>({})
  const [optimising, setOptimising] = useState(false)

  const load = useCallback(async () => {
    const [reqs, comps] = await Promise.all([getTransportRequests(), getTransportCompanies()])
    setRequests(reqs)
    setCompanies(comps)
    setLoading(false)
  }, [])

  const optimise = useCallback(async () => {
    setOptimising(true)
    try {
      const { data } = await supabase.auth.getUser()
      const result = await runTransportOptimisation({ persist: true, adminUserId: data.user?.id })
      setInsights(result)
    } finally {
      setOptimising(false)
    }
  }, [])

  useEffect(() => {
    load().then(optimise)
    const loader = setInterval(load, 20_000)
    const optimiser = setInterval(optimise, OPTIMISER_INTERVAL_MS)
    return () => { clearInterval(loader); clearInterval(optimiser) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groups = useMemo(() => ({
    attention: requests.filter(r => ['unassigned', 'pending'].includes(r.status)),
    offered: requests.filter(r => r.status === 'offered'),
    active: requests.filter(r => ['accepted', 'driver_assigned', 'in_progress'].includes(r.status)),
    done: requests.filter(r => ['completed', 'cancelled'].includes(r.status)),
  }), [requests])

  async function toggleRanking(request: TransportRequest) {
    if (expanded === request.id) { setExpanded(null); return }
    setExpanded(request.id)
    if (!ranking[request.id]) {
      const { candidates } = await rankSuppliers({
        pickup: request.pickup, dropoff: request.dropoff, date: request.date, time: request.time,
        passengers: request.passengers, distanceKm: request.distanceKm, quotedPrice: request.quotedPrice,
      })
      setRanking(current => ({ ...current, [request.id]: candidates }))
    }
  }

  /** Auto-assign: give the job straight to the top-ranked eligible supplier. */
  async function autoAssign(request: TransportRequest) {
    setBusy(request.id)
    try {
      const { candidates } = await rankSuppliers({
        pickup: request.pickup, dropoff: request.dropoff, date: request.date, time: request.time,
        passengers: request.passengers, distanceKm: request.distanceKm, quotedPrice: request.quotedPrice,
      })
      const top = candidates.find(c => c.eligible && c.bestVehicle)
      if (!top || !top.bestVehicle) {
        alert('No eligible supplier with an available vehicle for this request.')
        return
      }
      await acceptTransportRequest(request, top.company, top.bestVehicle)
      await notify(top.company.supplierId, 'booking',
        'Transfer assigned to you',
        `Visit Drakensberg assigned you ${request.pickup.address} → ${request.dropoff.address} on ${request.date} (${request.passengers} pax, R${request.quotedPrice.toLocaleString()}). Assign a driver to get rolling.`,
        '/supplier/jobs')
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function reoffer(request: TransportRequest) {
    setBusy(request.id)
    try {
      const { candidates } = await rankSuppliers({
        pickup: request.pickup, dropoff: request.dropoff, date: request.date, time: request.time,
        passengers: request.passengers, distanceKm: request.distanceKm, quotedPrice: request.quotedPrice,
      })
      const now = new Date().toISOString()
      const offers = candidates.filter(c => c.eligible).map((c, i) => ({
        supplierId: c.company.supplierId,
        companyId: c.company.id,
        companyName: c.company.companyName,
        category: c.company.category,
        score: c.score,
        rank: i + 1,
        breakdown: c.breakdown,
        offeredAt: i < OFFER_SHORTLIST_SIZE ? now : undefined,
      }))
      const notified = offers.filter(o => o.offeredAt)
      await supabase.from('vd_transport_requests').update({
        status: notified.length ? 'offered' : 'unassigned',
        offered_supplier_ids: notified.map(o => o.supplierId),
        value: { ...request, status: notified.length ? 'offered' : 'unassigned', offers },
        updated_at: now,
      }).eq('id', request.id)
      await Promise.all(notified.map(o =>
        notify(o.supplierId, 'booking', 'New transfer opportunity',
          `${request.pickup.address} → ${request.dropoff.address} on ${request.date} · ${request.passengers} pax · R${request.quotedPrice.toLocaleString()}.`,
          '/supplier/jobs')))
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function cancel(request: TransportRequest) {
    if (!confirm('Cancel this transport request?')) return
    setBusy(request.id)
    try {
      const company = request.assignment
        ? companies.find(c => c.supplierId === request.assignment!.supplierId) ?? null
        : null
      await cancelTransportRequest(request, company)
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="p-8"><p className="font-sans text-sm text-black/40">Loading transport marketplace…</p></div>

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bus size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Transport Dispatch</h1>
        </div>
        <button onClick={optimise} disabled={optimising}
          className="flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 font-sans text-xs text-black/60 hover:border-black/30 disabled:opacity-50">
          <RefreshCw size={13} className={optimising ? 'animate-spin' : ''} /> Run optimisation pass
        </button>
      </div>

      {/* Marketplace summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Registered companies" value={String(companies.length)} />
        <Stat label="Needs attention" value={String(groups.attention.length)} alert={groups.attention.length > 0} />
        <Stat label="Awaiting acceptance" value={String(groups.offered.length)} />
        <Stat label="Active trips" value={String(groups.active.length)} />
        <Stat label="Completed" value={String(requests.filter(r => r.status === 'completed').length)} />
      </div>

      {/* Optimisation insights */}
      <section className="bg-white rounded-xl border border-black/8 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-[#C9A96E]" />
          <h2 className="font-sans text-sm font-semibold text-black/70">Optimisation service</h2>
          {insights && <span className="font-sans text-[11px] text-black/30">last pass {new Date(insights.generatedAt).toLocaleTimeString()} · learning from {insights.completedTrips} completed trips</span>}
        </div>
        {!insights ? (
          <p className="font-sans text-xs text-black/40">First pass runs automatically…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <p className="font-sans text-xs font-medium text-black/50 mb-2">Follow-on matches (boosted to rank 1)</p>
              {insights.followOnMatches.length === 0
                ? <p className="font-sans text-xs text-black/35">No pending pickup sits near an inbound journey right now.</p>
                : insights.followOnMatches.map(m => (
                  <p key={`${m.requestId}-${m.supplierId}`} className="font-sans text-xs text-black/55 mb-1.5">
                    <Zap size={11} className="inline text-[#C9A96E] mr-1" />
                    <span className="font-medium">{m.companyName}</span> ends a trip {m.gapKm} km from {m.pickupAddress} on {m.date} — moved from #{m.previousRank} to #1.
                  </p>
                ))}
            </div>
            <div>
              <p className="font-sans text-xs font-medium text-black/50 mb-2">Destination clusters (next journeys)</p>
              {insights.clusters.length === 0
                ? <p className="font-sans text-xs text-black/35">No upcoming journeys to cluster.</p>
                : insights.clusters.slice(0, 6).map(c => (
                  <p key={`${c.areaId}-${c.date}`} className="font-sans text-xs text-black/55 mb-1.5">
                    <MapPin size={11} className="inline text-[#C9A96E] mr-1" />
                    {c.areaName} · {c.date}: {c.inbound} inbound / {c.outbound} outbound
                  </p>
                ))}
            </div>
            <div>
              <p className="font-sans text-xs font-medium text-black/50 mb-2">Learned demand corridors</p>
              {insights.regionPairs.length === 0
                ? <p className="font-sans text-xs text-black/35">Grows as booking history accumulates.</p>
                : insights.regionPairs.slice(0, 6).map(p => (
                  <p key={`${p.fromAreaId}-${p.toAreaId}`} className="font-sans text-xs text-black/55 mb-1.5">
                    {areaName(p.fromAreaId)} → {areaName(p.toAreaId)}: {p.trips} trips{p.returnTrips ? ` · ${p.returnTrips} with return flow` : ''}
                  </p>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* Requests needing attention + offered + active */}
      <RequestGroup title={`Needs attention (${groups.attention.length})`} requests={groups.attention} emptyText="Nothing unassigned — the marketplace is covering demand."
        busy={busy} expanded={expanded} ranking={ranking} onToggle={toggleRanking} onAutoAssign={autoAssign} onReoffer={reoffer} onCancel={cancel} />
      <RequestGroup title={`Awaiting supplier acceptance (${groups.offered.length})`} requests={groups.offered} emptyText="No open offers."
        busy={busy} expanded={expanded} ranking={ranking} onToggle={toggleRanking} onAutoAssign={autoAssign} onReoffer={reoffer} onCancel={cancel} />
      <RequestGroup title={`Active trips (${groups.active.length})`} requests={groups.active} emptyText="No active trips."
        busy={busy} expanded={expanded} ranking={ranking} onToggle={toggleRanking} onCancel={cancel} />
      <RequestGroup title={`History (${groups.done.length})`} requests={groups.done.slice(0, 10)} emptyText="No completed or cancelled trips yet."
        busy={busy} expanded={expanded} ranking={ranking} onToggle={toggleRanking} />

      {/* Supplier directory */}
      <section className="space-y-3">
        <h2 className="font-sans text-sm font-semibold text-black/70">Transport companies ({companies.length})</h2>
        {companies.length === 0 ? (
          <p className="font-sans text-sm text-black/35">No transport companies registered yet. Shuttle suppliers register from their dashboard → Transport Company.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {companies.map(c => <CompanyCard key={c.id} company={c} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-black/8 bg-white'}`}>
      <p className="font-sans text-[11px] uppercase tracking-wide text-black/35 mb-1">{label}</p>
      <p className={`font-display italic text-2xl ${alert ? 'text-red-600' : 'text-black/85'}`}>{value}</p>
    </div>
  )
}

function RequestGroup({ title, requests, emptyText, busy, expanded, ranking, onToggle, onAutoAssign, onReoffer, onCancel }: {
  title: string
  requests: TransportRequest[]
  emptyText: string
  busy: string | null
  expanded: string | null
  ranking: Record<string, ScoredCandidate[]>
  onToggle: (r: TransportRequest) => void
  onAutoAssign?: (r: TransportRequest) => void
  onReoffer?: (r: TransportRequest) => void
  onCancel?: (r: TransportRequest) => void
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-sm font-semibold text-black/70">{title}</h2>
      {requests.length === 0 ? <p className="font-sans text-sm text-black/35">{emptyText}</p> : (
        <div className="grid gap-3">
          {requests.map(request => (
            <div key={request.id} className="bg-white rounded-xl border border-black/8 p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-sans text-sm font-semibold text-black/90">
                    <span className="truncate">{request.pickup.address}</span>
                    <ArrowRight size={14} className="shrink-0 text-[#C9A96E]" />
                    <span className="truncate">{request.dropoff.address}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-1.5 font-sans text-xs text-black/40">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {request.date}</span>
                    <span className="flex items-center gap-1"><Users size={11} /> {request.passengers} pax</span>
                    {request.distanceKm !== undefined && <span>{request.distanceKm} km</span>}
                    <span className="capitalize">{request.tripClass} trip</span>
                    {request.customerName && <span>{request.customerName}</span>}
                    {request.bookingReference && <span>Ref {request.bookingReference}</span>}
                    {request.assignment && <span className="flex items-center gap-1"><Truck size={11} /> {request.assignment.companyName}{request.assignment.driverName ? ` · ${request.assignment.driverName}` : ''}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display italic text-lg text-black/85">R {request.quotedPrice.toLocaleString()}</span>
                  <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[request.status] ?? 'bg-slate-100 text-slate-500'}`}>{request.status.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                <button onClick={() => onToggle(request)} className="flex items-center gap-1 font-sans text-xs text-[#C9A96E] hover:underline">
                  {expanded === request.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Suitability ranking
                </button>
                {onAutoAssign && ['unassigned', 'pending', 'offered'].includes(request.status) && (
                  <button disabled={busy === request.id} onClick={() => onAutoAssign(request)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#C9A96E] px-3 py-1.5 font-sans text-xs text-white hover:bg-[#b8965d] disabled:opacity-50">
                    <Zap size={12} /> Auto-assign top supplier
                  </button>
                )}
                {onReoffer && ['unassigned', 'pending'].includes(request.status) && (
                  <button disabled={busy === request.id} onClick={() => onReoffer(request)}
                    className="rounded-lg border border-black/10 px-3 py-1.5 font-sans text-xs text-black/60 hover:border-black/30 disabled:opacity-50">
                    Re-run dispatch & offer
                  </button>
                )}
                {onCancel && !['completed', 'cancelled'].includes(request.status) && (
                  <button disabled={busy === request.id} onClick={() => onCancel(request)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 font-sans text-xs text-red-500 hover:bg-red-50 disabled:opacity-50">
                    Cancel
                  </button>
                )}
              </div>

              {expanded === request.id && (
                <div className="rounded-lg bg-[#F7F5F2] p-4 space-y-3">
                  {!ranking[request.id] ? <p className="font-sans text-xs text-black/40">Scoring suppliers…</p> :
                    ranking[request.id].length === 0 ? <p className="font-sans text-xs text-black/40">No transport companies registered.</p> :
                    ranking[request.id].map((c, i) => (
                      <div key={c.company.id} className="bg-white rounded-lg border border-black/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-sans text-xs font-semibold text-black/80">
                            #{i + 1} {c.company.companyName}
                            <span className="ml-2 font-normal text-black/40">{SUPPLIER_CATEGORIES[c.company.category].label}</span>
                          </p>
                          <p className="font-sans text-xs">
                            {c.eligible
                              ? <span className="text-emerald-600 font-semibold">{c.score} pts</span>
                              : <span className="text-red-500">Ineligible: {c.reasons.join('; ')}</span>}
                          </p>
                        </div>
                        {c.eligible && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {c.breakdown.map(line => (
                              <span key={line.factor} className="font-sans text-[11px] text-black/45" title={line.note}>
                                {line.factor}: {line.points}/{line.max}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CompanyCard({ company }: { company: TransportCompany }) {
  const cat = SUPPLIER_CATEGORIES[company.category]
  const [fleet, setFleet] = useState<{ vehicles: number; available: number; drivers: number } | null>(null)

  useEffect(() => {
    getFleet(company.supplierId).then(({ vehicles, drivers }) => {
      const today = new Date().toISOString().slice(0, 10)
      setFleet({
        vehicles: vehicles.length,
        available: vehicles.filter(v => vehicleAvailableOn(v, today) && vehicleSeats(v) > 0).length,
        drivers: drivers.length,
      })
    })
  }, [company.supplierId])

  return (
    <div className="bg-white rounded-xl border border-black/8 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-sm font-semibold text-black/85">{company.companyName}</p>
          <p className="font-sans text-xs text-black/40 mt-0.5">{cat.label} · {company.homeBase.address || 'No home base set'}</p>
        </div>
        <span className="font-sans text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 capitalize">{company.status}</span>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 font-sans text-xs text-black/45">
        <span>{fleet ? `${fleet.available}/${fleet.vehicles} vehicles free` : 'Loading fleet…'}</span>
        <span>{fleet ? `${fleet.drivers} drivers` : ''}</span>
        <span>{company.stats?.completedTrips ?? 0} trips completed</span>
        <span>{(company.openJobs ?? []).length} open jobs</span>
        <span>R{company.ratePerKm}/km</span>
      </div>
    </div>
  )
}
