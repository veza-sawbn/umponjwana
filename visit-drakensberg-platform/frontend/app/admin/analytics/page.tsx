'use client'

import { useEffect, useMemo, useState } from 'react'
// `Map` is aliased — the lucide icon of that name shadows the global Map
// constructor used for the aggregations below.
import { TrendingUp, Users, DollarSign, Map as MapIcon, RefreshCw, Eye, Compass, Globe } from 'lucide-react'
import { getOrders, getAllOrderLines, type MasterOrder, type OrderLine } from '@/lib/orders'
import { formatMoney } from '@/lib/allocation'
import { supabase } from '@/lib/auth'
import {
  getRecentEvents, getRecentSessions, trafficSourceLabel, catalogEventLabel, CATALOG_VIEW_EVENTS,
  type TrafficEvent, type TrafficSession,
} from '@/lib/analytics-admin'

// Booking/revenue figures below are derived from live order and order-line
// data — the same sources the finance and operations consoles read.
// Cancelled orders and lines are excluded from every total so they reconcile
// with /admin/finance.
//
// Traffic/funnel figures (further down) are derived from the first-party
// event stream (vd_sessions/vd_analytics_events, §21) instead — real site
// visitors and behaviour, not just registered accounts. It only reflects
// traffic since that instrumentation shipped (Phase 3 of the CRM/analytics
// handoff) — there's no historical backfill.

const MONTHS_SHOWN = 6
const TRAFFIC_WINDOW_DAYS = 30

type Registration = { created_at: string; role: string }

function monthKeys(count: number): string[] {
  const keys: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'short' })
}

/** Percentage change between the two most recent months, or null when there's no baseline. */
function trend(series: number[]): number | null {
  if (series.length < 2) return null
  const current = series[series.length - 1]
  const previous = series[series.length - 2]
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function TrendLabel({ value }: { value: number | null }) {
  if (value === null) return <span className="font-sans text-xs text-gray-300">—</span>
  const positive = value >= 0
  return (
    <span className={`font-sans text-xs ${positive ? 'text-[#2d6a4f]' : 'text-red-400'}`}>
      {positive ? '+' : ''}{value}%
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-sm text-gray-400 py-8 text-center">{children}</p>
}

export default function AdminAnalyticsPage() {
  const [orders, setOrders] = useState<MasterOrder[]>([])
  const [lines, setLines] = useState<OrderLine[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [events, setEvents] = useState<TrafficEvent[]>([])
  const [sessions, setSessions] = useState<TrafficSession[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [o, l, r, ev, se] = await Promise.all([
      getOrders().catch(() => [] as MasterOrder[]),
      getAllOrderLines().catch(() => [] as OrderLine[]),
      (async () => {
        try {
          const { data } = await supabase.from('profiles').select('created_at, role')
          return Array.isArray(data) ? data as Registration[] : []
        } catch { return [] }
      })(),
      getRecentEvents(TRAFFIC_WINDOW_DAYS),
      getRecentSessions(TRAFFIC_WINDOW_DAYS),
    ])
    setOrders(o); setLines(l); setRegistrations(r); setEvents(ev); setSessions(se)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Cancelled bookings are excluded so these totals reconcile with /admin/finance.
  const active = useMemo(() => orders.filter(o => o.booking_status !== 'cancelled'), [orders])
  const activeLines = useMemo(() => lines.filter(l => l.fulfilment_status !== 'cancelled'), [lines])

  const keys = useMemo(() => monthKeys(MONTHS_SHOWN), [])

  const monthly = useMemo(() => {
    const bookings = new Map<string, number>()
    const revenue = new Map<string, number>()
    for (const o of active) {
      const k = o.created_at.slice(0, 7)
      bookings.set(k, (bookings.get(k) ?? 0) + 1)
      revenue.set(k, (revenue.get(k) ?? 0) + Number(o.total_value))
    }
    return keys.map(k => ({
      key: k,
      label: monthLabel(k),
      bookings: bookings.get(k) ?? 0,
      revenue: revenue.get(k) ?? 0,
    }))
  }, [active, keys])

  const signupsByMonth = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of registrations) {
      if (!r.created_at) continue
      const k = r.created_at.slice(0, 7)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return keys.map(k => ({ key: k, label: monthLabel(k), count: m.get(k) ?? 0 }))
  }, [registrations, keys])

  const topListings = useMemo(() => {
    const m = new Map<string, { title: string; revenue: number; bookings: number }>()
    for (const l of activeLines) {
      const title = l.title?.trim() || 'Untitled line'
      const entry = m.get(title) ?? { title, revenue: 0, bookings: 0 }
      entry.revenue += Number(l.gross_amount) - Number(l.discount_amount)
      entry.bookings += 1
      m.set(title, entry)
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [activeLines])

  const byRegion = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of active) {
      const key = (o.destination || '').trim() || 'Unspecified'
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    const total = active.length || 1
    return [...m.entries()]
      .map(([region, bookings]) => ({ region, bookings, pct: Math.round((bookings / total) * 100) }))
      .sort((a, b) => b.bookings - a.bookings)
  }, [active])

  const revenue = active.reduce((s, o) => s + Number(o.total_value), 0)
  const travellers = registrations.filter(r => r.role !== 'supplier').length
  const activeRegions = byRegion.filter(r => r.region !== 'Unspecified').length

  // ── Traffic & funnel (from the event stream, §4/§5/§21) ──────────────────
  const uniqueVisitors = useMemo(() => new Set(sessions.map(s => s.anon_id)).size, [sessions])
  const pageViews = useMemo(() => events.filter(e => e.event_name === 'page_view').length, [events])

  const topPages = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of events) {
      if (e.event_name !== 'page_view' || !e.page_url) continue
      m.set(e.page_url, (m.get(e.page_url) ?? 0) + 1)
    }
    return [...m.entries()].map(([page, views]) => ({ page, views })).sort((a, b) => b.views - a.views).slice(0, 6)
  }, [events])

  const topCatalogViews = useMemo(() => {
    const m = new Map<string, { label: string; kind: string; views: number }>()
    for (const e of events) {
      if (!CATALOG_VIEW_EVENTS.has(e.event_name)) continue
      const name = (e.properties?.name as string) || (e.properties?.id as string) || 'Unnamed'
      const key = `${e.event_name}:${name}`
      const entry = m.get(key) ?? { label: name, kind: catalogEventLabel(e.event_name), views: 0 }
      entry.views += 1
      m.set(key, entry)
    }
    return [...m.values()].sort((a, b) => b.views - a.views).slice(0, 6)
  }, [events])

  const trafficSources = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions) {
      const label = trafficSourceLabel(s)
      m.set(label, (m.get(label) ?? 0) + 1)
    }
    const total = sessions.length || 1
    return [...m.entries()]
      .map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [sessions])

  // Funnel stages counted by distinct session, not raw event count — a
  // visitor who views a trail three times still only counts once at that
  // stage, matching the drop-off table shape in the handoff (§5).
  const funnel = useMemo(() => {
    const sessionsWithCatalogView = new Set(events.filter(e => CATALOG_VIEW_EVENTS.has(e.event_name) && e.session_id).map(e => e.session_id))
    const sessionsStarted = new Set(events.filter(e => e.event_name === 'booking_started' && e.session_id).map(e => e.session_id))
    const sessionsCompleted = new Set(events.filter(e => e.event_name === 'booking_completed' && e.session_id).map(e => e.session_id))
    const stages = [
      { label: 'Website Visitors', count: sessions.length },
      { label: 'Product Viewed', count: sessionsWithCatalogView.size },
      { label: 'Booking Started', count: sessionsStarted.size },
      { label: 'Booking Completed', count: sessionsCompleted.size },
    ]
    const top = stages[0].count || 1
    return stages.map((s, i) => ({
      ...s,
      pctOfTop: Math.round((s.count / top) * 100),
      pctOfPrevious: i === 0 ? null : Math.round((s.count / (stages[i - 1].count || 1)) * 100),
    }))
  }, [events, sessions])

  const maxPageViews = Math.max(...topPages.map(p => p.views), 1)
  const maxCatalogViews = Math.max(...topCatalogViews.map(c => c.views), 1)

  const maxBookings = Math.max(...monthly.map(m => m.bookings), 1)
  const maxRevenue = Math.max(...monthly.map(m => m.revenue), 1)
  const maxSignups = Math.max(...signupsByMonth.map(m => m.count), 1)
  const maxListingRevenue = Math.max(...topListings.map(l => l.revenue), 1)

  const range = keys.length
    ? `${monthLabel(keys[0])} – ${monthLabel(keys[keys.length - 1])} ${keys[keys.length - 1].slice(0, 4)}`
    : ''

  const kpis = [
    { label: 'Total Bookings', value: String(active.length), trend: trend(monthly.map(m => m.bookings)), icon: TrendingUp },
    { label: 'Total Revenue', value: formatMoney(revenue), trend: trend(monthly.map(m => m.revenue)), icon: DollarSign },
    { label: 'Registered Travellers', value: String(travellers), trend: trend(signupsByMonth.map(m => m.count)), icon: Users },
    { label: 'Active Regions', value: String(activeRegions), trend: null, icon: MapIcon },
  ]

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Analytics</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            Platform performance overview{range ? ` · ${range}` : ''} · excludes cancelled bookings
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <Icon size={16} className="text-[#C9A96E]" />
                {loading ? <span className="font-sans text-xs text-gray-300">…</span> : <TrendLabel value={k.trend} />}
              </div>
              <p className="font-display italic text-2xl text-[#000000]">{loading ? '…' : k.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{k.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        {/* Monthly bookings bar chart */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Monthly Bookings</h2>
          {loading ? <Empty>Loading…</Empty> : active.length === 0 ? <Empty>No bookings recorded yet.</Empty> : (
            <div className="flex items-end gap-3 h-40">
              {monthly.map(m => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="font-sans text-xs text-gray-500">{m.bookings}</span>
                  <div
                    className="w-full bg-[#2d6a4f] transition-all"
                    style={{ height: `${Math.round((m.bookings / maxBookings) * 120)}px` }}
                  />
                  <span className="font-sans text-xs text-gray-400">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly revenue bar chart */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Monthly Revenue</h2>
          {loading ? <Empty>Loading…</Empty> : active.length === 0 ? <Empty>No revenue recorded yet.</Empty> : (
            <div className="flex items-end gap-3 h-40">
              {monthly.map(m => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="font-sans text-xs text-gray-500">
                    {m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(0)}k` : Math.round(m.revenue)}
                  </span>
                  <div
                    className="w-full bg-[#C9A96E]"
                    style={{ height: `${Math.round((m.revenue / maxRevenue) * 120)}px` }}
                  />
                  <span className="font-sans text-xs text-gray-400">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Top listings */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Top Listings by Revenue</h2>
          {loading ? <Empty>Loading…</Empty> : topListings.length === 0 ? <Empty>No booked services yet.</Empty> : (
            <div className="space-y-4">
              {topListings.map((l, i) => (
                <div key={l.title}>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-sans text-xs text-gray-300 w-4 shrink-0">{i + 1}</span>
                      <span className="font-sans text-sm text-gray-700 truncate">{l.title}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-display italic text-[#2d6a4f]">{formatMoney(l.revenue)}</span>
                      <span className="font-sans text-xs text-gray-400 ml-2">({l.bookings} {l.bookings === 1 ? 'line' : 'lines'})</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#F7F5F2] overflow-hidden">
                    <div className="h-full bg-[#2d6a4f]" style={{ width: `${Math.round((l.revenue / maxListingRevenue) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bookings by region */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Bookings by Destination</h2>
          {loading ? <Empty>Loading…</Empty> : byRegion.length === 0 ? <Empty>No bookings recorded yet.</Empty> : (
            <div className="space-y-5">
              {byRegion.map(r => (
                <div key={r.region}>
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <span className="font-sans text-sm text-gray-700 capitalize truncate">{r.region}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-sans text-xs text-gray-400">{r.bookings} {r.bookings === 1 ? 'booking' : 'bookings'}</span>
                      <span className="font-display italic text-[#C9A96E] w-10 text-right">{r.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-[#F7F5F2] overflow-hidden">
                    <div className="h-full bg-[#C9A96E]" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="font-display italic text-lg mb-4">New Registrations</h3>
            {loading ? <Empty>Loading…</Empty> : registrations.length === 0 ? <Empty>No registrations yet.</Empty> : (
              <div className="flex items-end gap-2 h-20">
                {signupsByMonth.map(s => (
                  <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-[#2d6a4f]/30" style={{ height: `${Math.round((s.count / maxSignups) * 64)}px` }} />
                    <span className="font-sans text-[10px] text-gray-400">{s.label.charAt(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Website Traffic & Booking Funnel ──────────────────────────────── */}
      <div className="mt-10 pt-8 border-t border-gray-200">
        <div className="mb-6">
          <h2 className="font-display italic text-2xl text-[#000000]">Website Traffic &amp; Booking Funnel</h2>
          <p className="font-sans text-sm text-gray-400 mt-1">
            Last {TRAFFIC_WINDOW_DAYS} days · from live visitor behaviour, not just registered accounts
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Sessions', value: String(sessions.length), icon: Globe },
            { label: 'Unique Visitors', value: String(uniqueVisitors), icon: Users },
            { label: 'Page Views', value: String(pageViews), icon: Eye },
            {
              label: 'Booking Start → Complete',
              value: funnel[2].count > 0 ? `${Math.round((funnel[3].count / funnel[2].count) * 100)}%` : '—',
              icon: Compass,
            },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white border border-gray-200 p-5">
                <Icon size={16} className="text-[#C9A96E] mb-3" />
                <p className="font-display italic text-2xl text-[#000000]">{loading ? '…' : k.value}</p>
                <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{k.label}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Top pages */}
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="font-display italic text-xl text-[#000000] mb-6">Top Pages</h3>
            {loading ? <Empty>Loading…</Empty> : topPages.length === 0 ? <Empty>No pageviews recorded yet.</Empty> : (
              <div className="space-y-4">
                {topPages.map((p, i) => (
                  <div key={p.page}>
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-sans text-xs text-gray-300 w-4 shrink-0">{i + 1}</span>
                        <span className="font-sans text-sm text-gray-700 truncate">{p.page}</span>
                      </div>
                      <span className="font-display italic text-[#2d6a4f] shrink-0">{p.views}</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F5F2] overflow-hidden">
                      <div className="h-full bg-[#2d6a4f]" style={{ width: `${Math.round((p.views / maxPageViews) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traffic sources */}
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="font-display italic text-xl text-[#000000] mb-6">Traffic Sources</h3>
            {loading ? <Empty>Loading…</Empty> : trafficSources.length === 0 ? <Empty>No sessions recorded yet.</Empty> : (
              <div className="space-y-5">
                {trafficSources.map(s => (
                  <div key={s.source}>
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <span className="font-sans text-sm text-gray-700 truncate capitalize">{s.source}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-sans text-xs text-gray-400">{s.count} {s.count === 1 ? 'session' : 'sessions'}</span>
                        <span className="font-display italic text-[#C9A96E] w-10 text-right">{s.pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#F7F5F2] overflow-hidden">
                      <div className="h-full bg-[#C9A96E]" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Top viewed listings */}
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="font-display italic text-xl text-[#000000] mb-6">Trending Listings</h3>
            {loading ? <Empty>Loading…</Empty> : topCatalogViews.length === 0 ? <Empty>No listing views recorded yet.</Empty> : (
              <div className="space-y-4">
                {topCatalogViews.map((c, i) => (
                  <div key={`${c.kind}-${c.label}`}>
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-sans text-xs text-gray-300 w-4 shrink-0">{i + 1}</span>
                        <span className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 shrink-0">{c.kind}</span>
                        <span className="font-sans text-sm text-gray-700 truncate">{c.label}</span>
                      </div>
                      <span className="font-display italic text-[#2d6a4f] shrink-0">{c.views}</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F5F2] overflow-hidden">
                      <div className="h-full bg-[#2d6a4f]" style={{ width: `${Math.round((c.views / maxCatalogViews) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booking funnel */}
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="font-display italic text-xl text-[#000000] mb-6">Booking Funnel</h3>
            {loading ? <Empty>Loading…</Empty> : sessions.length === 0 ? <Empty>No sessions recorded yet.</Empty> : (
              <div className="space-y-5">
                {funnel.map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <span className="font-sans text-sm text-gray-700">{s.label}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-sans text-xs text-gray-400">{s.count.toLocaleString()}</span>
                        {s.pctOfPrevious !== null && (
                          <span className="font-sans text-xs text-gray-400">({s.pctOfPrevious}% of previous)</span>
                        )}
                        <span className="font-display italic text-[#C9A96E] w-10 text-right">{s.pctOfTop}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#F7F5F2] overflow-hidden">
                      <div className="h-full bg-[#C9A96E]" style={{ width: `${s.pctOfTop}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
