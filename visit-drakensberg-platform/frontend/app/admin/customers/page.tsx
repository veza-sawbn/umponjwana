'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Users, Globe, DollarSign, RefreshCw, Loader2 } from 'lucide-react'
import {
  getCustomerDirectory, getSegmentCounts, recomputeSegments,
  type CustomerDirectoryEntry, type SegmentCount,
} from '@/lib/customers-admin'
import { formatMoney } from '@/lib/allocation'

// Customer directory (§7 "Customer Management System", §9 segmentation).
// Segments are dynamic — computed by vd_recompute_segments() from live
// order/profile data (see the Phase 1 migration) — this page reads that
// computed membership and lets an admin trigger a fresh recompute; it never
// assigns a customer to a segment by hand.

const STAGE_LABEL: Record<string, string> = {
  visitor: 'Visitor', prospect: 'Prospect', customer: 'Customer',
  upcoming_traveller: 'Upcoming Traveller', traveller: 'Traveller',
  returning_customer: 'Returning Customer', advocate: 'Advocate',
}
const STAGE_STYLE: Record<string, string> = {
  visitor: 'bg-gray-100 text-gray-500',
  prospect: 'bg-[#C9A96E]/15 text-[#8B6914]',
  customer: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  upcoming_traveller: 'bg-blue-50 text-blue-600',
  traveller: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  returning_customer: 'bg-[#2d6a4f]/20 text-[#2d6a4f]',
  advocate: 'bg-[#C9A96E]/25 text-[#8B6914]',
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerDirectoryEntry[]>([])
  const [segments, setSegments] = useState<SegmentCount[]>([])
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)

  async function load() {
    setLoading(true)
    const [c, s] = await Promise.all([getCustomerDirectory(), getSegmentCounts()])
    setCustomers(c.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    setSegments(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleRecompute() {
    setRecomputing(true)
    const { error } = await recomputeSegments()
    if (!error) await load()
    setRecomputing(false)
  }

  const filtered = useMemo(() => customers.filter(c => {
    const haystack = `${c.fullName} ${c.email} ${c.phone ?? ''}`.toLowerCase()
    const matchSearch = haystack.includes(search.toLowerCase())
    const matchStage = stageFilter === 'all' || c.lifecycleStage === stageFilter
    return matchSearch && matchStage
  }), [customers, search, stageFilter])

  const totalSpend = customers.reduce((s, c) => s + c.lifetimeSpend, 0)
  const internationalCount = customers.filter(c => c.country && !/south africa|^za$|^rsa$/i.test(c.country)).length
  const consentedCount = customers.filter(c => c.marketingConsent).length

  const stages = ['all', ...Object.keys(STAGE_LABEL)]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Customers</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Visitor → Prospect → Customer → Returning Customer, tracked from live activity.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleRecompute} disabled={recomputing}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50">
            {recomputing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {recomputing ? 'Recomputing…' : 'Recompute Segments'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
        {[
          { label: 'Customers', value: String(customers.length), icon: Users },
          { label: 'Lifetime Spend', value: formatMoney(totalSpend), icon: DollarSign },
          { label: 'Marketing Opt-in', value: String(consentedCount), icon: Users },
          { label: 'International', value: String(internationalCount), icon: Globe },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <div className="bg-[#2d6a4f]/8 w-8 h-8 flex items-center justify-center mb-3"><Icon size={15} className="text-[#2d6a4f]" /></div>
              <p className="font-display italic text-2xl text-[#000000]">{loading ? '…' : s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Segment badges — click to filter by lifecycle stage isn't 1:1 with
          segment id, so these are informational counts, not filter buttons. */}
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {segments.map(s => (
            <span key={s.id} className="font-sans text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600">
              {s.name} <span className="text-gray-400">({s.count})</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 sm:py-2 flex-1 sm:min-w-[220px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone…"
            className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" />
        </div>
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <div className="flex w-max border border-gray-200 bg-white">
            {stages.map(s => (
              <button key={s} onClick={() => setStageFilter(s)}
                className={`px-4 py-2.5 sm:py-2 font-sans text-xs whitespace-nowrap transition-colors border-r border-gray-100 last:border-0 ${stageFilter === s ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
                {s === 'all' ? 'All' : STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phones */}
      <div className="md:hidden bg-white border border-gray-200 divide-y divide-gray-100">
        {filtered.map(c => (
          <Link key={c.id} href={`/admin/customers/${c.id}`} className="block p-4 active:bg-[#F7F5F2]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium truncate">{c.fullName}</p>
                <p className="font-sans text-xs text-gray-400 truncate">{c.email}</p>
              </div>
              <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 shrink-0 ${STAGE_STYLE[c.lifecycleStage] ?? STAGE_STYLE.visitor}`}>{STAGE_LABEL[c.lifecycleStage] ?? c.lifecycleStage}</span>
            </div>
            <div className="flex items-end justify-between gap-3 mt-3">
              <p className="font-sans text-xs text-gray-500">{c.tripCount} {c.tripCount === 1 ? 'trip' : 'trips'}{c.country ? ` · ${c.country}` : ''}</p>
              <p className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(c.lifetimeSpend)}</p>
            </div>
          </Link>
        ))}
        {!loading && filtered.length === 0 && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">No customers found.</p>}
        {loading && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">Loading customers…</p>}
      </div>

      <div className="hidden md:block bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Customer', 'Stage', 'Trips', 'Lifetime Spend', 'Upcoming Trip', 'Country', 'Joined'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-[#F7F5F2] transition-colors cursor-pointer" onClick={() => window.location.assign(`/admin/customers/${c.id}`)}>
                <td className="px-5 py-4"><p className="font-sans text-sm font-medium">{c.fullName}</p><p className="font-sans text-xs text-gray-400">{c.email}</p></td>
                <td className="px-5 py-4"><span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STAGE_STYLE[c.lifecycleStage] ?? STAGE_STYLE.visitor}`}>{STAGE_LABEL[c.lifecycleStage] ?? c.lifecycleStage}</span></td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{c.tripCount}</td>
                <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(c.lifetimeSpend)}</td>
                <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmtDate(c.upcomingTravel)}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{c.country || '—'}</td>
                <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No customers found.</td></tr>}
            {loading && <tr><td colSpan={7} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading customers…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
