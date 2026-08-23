'use client'

/**
 * /admin/customers/[id] — Customer 360 view (§18 of the handoff).
 *
 * One chronological timeline built from three independent tables — orders,
 * behavioural events and consent changes — merged and sorted client-side.
 * Nothing here is a separate copy of that data; this page only reads.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, Globe, Compass,
  Eye, ShoppingBag, ShieldCheck, ShieldOff, Loader2,
} from 'lucide-react'
import {
  getCustomerById, getCustomerSegmentNames, getCustomerTimeline,
  type CustomerProfile, type CustomerTimelineEntry,
} from '@/lib/customers-admin'
import { formatMoney } from '@/lib/allocation'

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

const TIMELINE_ICON: Record<CustomerTimelineEntry['kind'], typeof Eye> = {
  event: Eye, order: ShoppingBag, consent: ShieldCheck,
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={14} className="text-gray-300 shrink-0" />
      <span className="font-sans text-xs text-gray-400 w-20 shrink-0">{label}</span>
      <span className="font-sans text-sm text-gray-700 truncate">{value}</span>
    </div>
  )
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(i => <span key={i} className="font-sans text-xs px-2.5 py-1 bg-[#F7F5F2] text-gray-600">{i}</span>)}
      </div>
    </div>
  )
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [segmentNames, setSegmentNames] = useState<string[]>([])
  const [timeline, setTimeline] = useState<CustomerTimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const id = params?.id
    if (!id) return
    setLoading(true)
    Promise.all([getCustomerById(id), getCustomerSegmentNames(id), getCustomerTimeline(id)])
      .then(([c, segs, tl]) => {
        if (!c) { setNotFound(true); return }
        setCustomer(c); setSegmentNames(segs); setTimeline(tl)
      })
      .finally(() => setLoading(false))
  }, [params?.id])

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }
  if (notFound || !customer) {
    return (
      <div className="p-8">
        <Link href="/admin/customers" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Customers</Link>
        <p className="font-sans text-sm text-gray-400">Customer not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <button onClick={() => router.push('/admin/customers')} className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Customers</button>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">{customer.fullName}</h1>
            <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STAGE_STYLE[customer.lifecycleStage] ?? STAGE_STYLE.visitor}`}>
              {STAGE_LABEL[customer.lifecycleStage] ?? customer.lifecycleStage}
            </span>
            {customer.marketingConsent ? (
              <span className="inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><ShieldCheck size={12} /> Marketing opted in</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-sans text-xs text-gray-400"><ShieldOff size={12} /> Not opted in</span>
            )}
          </div>
          <p className="font-sans text-sm text-gray-400 mt-1">Customer since {fmtDate(customer.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Lifetime Spend', value: formatMoney(customer.lifetimeSpend) },
          { label: 'Trips', value: String(customer.tripCount) },
          { label: 'Upcoming Trip', value: fmtDate(customer.upcomingTravel) },
          { label: 'Last Activity', value: fmtDate(customer.lastActivityAt) },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 p-4">
            <p className="font-display italic text-xl text-[#000000]">{k.value}</p>
            <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Profile panel */}
        <div className="bg-white border border-gray-200 p-6 space-y-5 lg:col-span-1 h-fit">
          <h2 className="font-display italic text-lg text-[#000000]">Profile</h2>
          <div className="space-y-3">
            <InfoRow icon={Mail} label="Email" value={customer.email || '—'} />
            <InfoRow icon={Phone} label="Phone" value={customer.phone || '—'} />
            <InfoRow icon={Globe} label="Country" value={customer.country || '—'} />
            <InfoRow icon={Compass} label="Source" value={customer.acquisitionSource || '—'} />
          </div>

          {segmentNames.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <TagList label="Segments" items={segmentNames} />
            </div>
          )}
          <TagList label="Tags" items={customer.tags} />
          <TagList label="Interests" items={customer.interests} />
          <TagList label="Favourite Destinations" items={customer.favouriteDestinations} />
          <TagList label="Favourite Activities" items={customer.favouriteActivities} />
        </div>

        {/* Timeline */}
        <div className="bg-white border border-gray-200 p-6 lg:col-span-2">
          <h2 className="font-display italic text-lg text-[#000000] mb-6">Activity Timeline</h2>
          {timeline.length === 0 ? (
            <p className="font-sans text-sm text-gray-400 py-8 text-center">No recorded activity yet.</p>
          ) : (
            <div className="space-y-0 max-h-[720px] overflow-y-auto">
              {timeline.map((t, i) => {
                const Icon = TIMELINE_ICON[t.kind]
                return (
                  <div key={`${t.at}-${i}`} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-[#F7F5F2] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={13} className="text-[#2d6a4f]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm text-gray-700">{t.label}</p>
                      {t.detail && <p className="font-sans text-xs text-gray-400 mt-0.5">{t.detail}</p>}
                    </div>
                    <p className="font-sans text-xs text-gray-300 shrink-0 whitespace-nowrap">{fmtDateTime(t.at)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
