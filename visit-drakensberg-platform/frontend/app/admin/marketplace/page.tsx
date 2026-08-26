'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Store, Building2, Users, Sparkles, CalendarDays, Package, CalendarPlus,
  Percent, Star, Mountain, TrendingUp,
} from 'lucide-react'
import { listEntities } from '@/lib/entities'
import { getTours, type Tour } from '@/lib/tours'
import { getDepartures, type Departure } from '@/lib/departures'
import { getPackages, PACKAGE_STATUS_LABELS, type MarketplacePackage } from '@/lib/packages'
import { getTripRequests, TRIP_STATUS_LABELS, type TripRequest } from '@/lib/custom-trips'
import { getSupplierEntities } from '@/lib/supplier-entities'
import type { OperatorProfile, GuideProfile } from '@/lib/operators'
import { getTrails, type Trail } from '@/lib/trails'
import { formatMoney } from '@/lib/allocation'

// Marketplace operations dashboard — a live view over the marketplace data
// the admin manages: tour operators, guides, experiences (tours), scheduled
// departures, packages, custom trip requests and supplier commissions.
// Existing admin sections (listings, suppliers, bookings, …) are untouched.

type Tab = 'operators' | 'guides' | 'experiences' | 'departures' | 'requests' | 'commissions'

export default function AdminMarketplacePage() {
  const [operators, setOperators] = useState<OperatorProfile[]>([])
  const [guides, setGuides] = useState<GuideProfile[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [departures, setDepartures] = useState<Departure[]>([])
  const [packages, setPackages] = useState<MarketplacePackage[]>([])
  const [requests, setRequests] = useState<TripRequest[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [tab, setTab] = useState<Tab>('operators')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      listEntities<OperatorProfile>('operator_profile'),
      getSupplierEntities<GuideProfile>('guides'),
      getTours(),
      getDepartures(),
      getPackages(),
      getTripRequests(),
      getTrails(),
    ]).then(([ops, gds, trs, deps, pkgs, reqs, trls]) => {
      setOperators(ops)
      setGuides(gds)
      setTours(trs)
      setDepartures(deps)
      setPackages(pkgs)
      setRequests(reqs)
      setTrails(trls)
      setLoading(false)
    })
  }, [])

  const trailName = (id: string) => trails.find(t => t.id === id)?.name ?? id
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = departures.filter(d => d.date >= today)

  // Marketplace analytics: booked seats × price per departure, commission at
  // each package component's configured rate.
  const analytics = useMemo(() => {
    const seatRevenue = departures.reduce((s, d) => s + d.bookedSeats * d.pricePerPerson, 0)
    const pkgMargin = packages.reduce((s, p) => s + p.components.reduce((x, c) => x + (c.sellingPrice - c.costPrice), 0), 0)
    const pkgCommission = packages.reduce((s, p) => s + p.components.reduce((x, c) => x + c.costPrice * (c.commissionPct / 100), 0), 0)
    const openRequests = requests.filter(r => ['pending_guide', 'pending_operator', 'quote_ready', 'awaiting_payment'].includes(r.status)).length
    const confirmedRequests = requests.filter(r => r.status === 'confirmed')
    return {
      seatRevenue,
      pkgMargin,
      pkgCommission,
      openRequests,
      requestRevenue: confirmedRequests.reduce((s, r) => s + (r.quote?.total ?? 0), 0),
    }
  }, [departures, packages, requests])

  const TABS: Array<{ id: Tab; label: string; icon: React.ElementType; count: number }> = [
    { id: 'operators', label: 'Tour Operators', icon: Building2, count: operators.length },
    { id: 'guides', label: 'Guides', icon: Users, count: guides.length },
    { id: 'experiences', label: 'Experiences', icon: Sparkles, count: tours.length },
    { id: 'departures', label: 'Scheduled Departures', icon: CalendarDays, count: upcoming.length },
    { id: 'requests', label: 'Custom Trip Requests', icon: CalendarPlus, count: requests.length },
    { id: 'commissions', label: 'Commissions & Contracts', icon: Percent, count: packages.length },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display italic text-3xl text-[#000000] flex items-center gap-3"><Store size={24} className="text-[#C9A96E]" /> Marketplace Operations</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Operators, guides, experiences, departures, custom bookings, commissions and marketplace analytics.</p>
        </div>
        <Link href="/admin/packages" className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">
          <Package size={14} /> Package Builder
        </Link>
      </div>

      {/* Analytics strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {[
          { label: 'Departure Revenue', value: `${formatMoney(analytics.seatRevenue)}`, icon: TrendingUp },
          { label: 'Custom Trip Revenue', value: `${formatMoney(analytics.requestRevenue)}`, icon: CalendarPlus },
          { label: 'Package Margin', value: `${formatMoney(analytics.pkgMargin)}`, icon: Package },
          { label: 'Supplier Commission', value: `${formatMoney(Math.round(analytics.pkgCommission))}`, icon: Percent },
          { label: 'Open Requests', value: `${analytics.openRequests}`, icon: Star },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <Icon size={15} className="text-[#C9A96E] mb-2" />
              <p className="font-display italic text-xl leading-tight">{s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 font-sans text-xs px-4 py-2.5 whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}>
              <Icon size={13} /> {t.label} <span className={tab === t.id ? 'text-white/60' : 'text-gray-400'}>({t.count})</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading marketplace data…</p>
      ) : (
        <div className="bg-white border border-gray-200 divide-y divide-gray-100">
          {tab === 'operators' && (
            operators.length === 0
              ? <Empty icon={Building2} text="No live operator profiles yet. Operators publish theirs from Supplier → Company Profile." />
              : operators.map(o => (
                <Row key={o.id}>
                  <div>
                    <p className="font-sans text-sm font-medium">{o.companyName}</p>
                    <p className="font-sans text-xs text-gray-400">{o.location || '—'} · {o.yearsOperating} yrs · {o.operatingRegions.join(', ') || 'no regions'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Chip className={o.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{o.status === 'active' ? 'Listed' : 'Draft'}</Chip>
                    <Link href={`/guides/operators/${o.id}`} className="font-sans text-xs text-[#2d6a4f] hover:underline">View →</Link>
                  </div>
                </Row>
              ))
          )}

          {tab === 'guides' && (
            guides.length === 0
              ? <Empty icon={Users} text="No guides registered by suppliers yet." />
              : guides.map(g => (
                <Row key={g.id}>
                  <div>
                    <p className="font-sans text-sm font-medium">{g.name}</p>
                    <p className="font-sans text-xs text-gray-400">{g.certs || 'no certs'} · {g.guideNo || 'no reg no.'}{g.yearsExperience ? ` · ${g.yearsExperience} yrs` : ''}</p>
                  </div>
                  <Chip className={g.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : g.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}>
                    {g.status}
                  </Chip>
                </Row>
              ))
          )}

          {tab === 'experiences' && (
            tours.length === 0
              ? <Empty icon={Sparkles} text="No supplier tours/experiences yet." />
              : tours.map(t => (
                <Row key={t.id}>
                  <div>
                    <p className="font-sans text-sm font-medium">{t.name}</p>
                    <p className="font-sans text-xs text-gray-400">
                      <Mountain size={10} className="inline -mt-0.5 mr-1" />{t.trailName || trailName(t.trailId)} · {t.supplierName} · {t.days} day{t.days !== 1 ? 's' : ''} · {formatMoney(t.pricePerPerson)} pp
                    </p>
                  </div>
                  <Chip className={t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{t.status}</Chip>
                </Row>
              ))
          )}

          {tab === 'departures' && (
            upcoming.length === 0
              ? <Empty icon={CalendarDays} text="No upcoming scheduled departures." />
              : upcoming.sort((a, b) => a.date.localeCompare(b.date)).map(d => (
                <Row key={d.id}>
                  <div>
                    <p className="font-sans text-sm font-medium">{d.tour} — {d.date}</p>
                    <p className="font-sans text-xs text-gray-400">{d.supplierName} · guide: {d.guide || 'TBC'} · {d.bookedSeats}/{d.maxSeats} seats · {formatMoney(d.pricePerPerson)} pp</p>
                  </div>
                  <Chip className={d.status === 'full' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}>{d.status}</Chip>
                </Row>
              ))
          )}

          {tab === 'requests' && (
            requests.length === 0
              ? <Empty icon={CalendarPlus} text="No custom trip requests yet." />
              : requests.map(r => (
                <Row key={r.id}>
                  <div>
                    <p className="font-sans text-sm font-medium">{r.reference} — {r.trailName}</p>
                    <p className="font-sans text-xs text-gray-400">
                      {r.customerName} · {r.startDate} → {r.endDate} · {r.groupSize} guests · {r.operatorName || 'unassigned operator'}
                      {r.quote ? ` · quoted ${formatMoney(r.quote.total)}` : ''}
                    </p>
                  </div>
                  <Chip className={
                    r.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                    : ['cancelled', 'rejected'].includes(r.status) ? 'bg-gray-100 text-gray-500'
                    : 'bg-amber-50 text-amber-700'
                  }>{TRIP_STATUS_LABELS[r.status]}</Chip>
                </Row>
              ))
          )}

          {tab === 'commissions' && (
            packages.length === 0
              ? <Empty icon={Percent} text="No packages configured. Component-level commission lives in the Package Builder." />
              : packages.flatMap(p => p.components.map(c => (
                <Row key={`${p.id}-${c.id}`}>
                  <div>
                    <p className="font-sans text-sm font-medium">{c.supplierName || 'Internal'} — {c.title || 'Untitled service'}</p>
                    <p className="font-sans text-xs text-gray-400">
                      Package: {p.title} ({PACKAGE_STATUS_LABELS[p.packageStatus]}) · cost {formatMoney(c.costPrice)} · sell {formatMoney(c.sellingPrice)}
                      {c.bookingRules ? ` · ${c.bookingRules}` : ''}{c.cancellationRules ? ` · ${c.cancellationRules}` : ''}
                    </p>
                  </div>
                  <Chip className="bg-[#C9A96E]/15 text-[#8B6914]">{c.commissionPct}% commission</Chip>
                </Row>
              )))
          )}
        </div>
      )}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-4">{children}</div>
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`font-sans text-[10px] tracking-[0.06em] uppercase px-2.5 py-1 shrink-0 ${className}`}>{children}</span>
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-16 text-center">
      <Icon size={26} className="text-gray-300 mx-auto mb-3" />
      <p className="font-sans text-sm text-gray-400">{text}</p>
    </div>
  )
}
