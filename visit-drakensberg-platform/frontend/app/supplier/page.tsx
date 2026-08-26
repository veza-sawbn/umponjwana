'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { useSupplier } from '@/lib/supplier-context'
import { SUPPLIER_CONFIG } from '@/lib/supplier-config'
import { getMyOrders, type SupplierOrder } from '@/lib/booking-orders'
import { supabase } from '@/lib/auth'

/* ── per-type stat cards ─────────────────────────────────────────── */
const TYPE_STATS: Record<string, { label: string; value: string }[]> = {
  Accommodation: [
    { label: 'Active Properties', value: '2' },
    { label: 'Room Types', value: '5' },
    { label: 'Occupancy This Month', value: '78%' },
    { label: 'Revenue This Month', value: 'R 24 680' },
  ],
  Activity: [
    { label: 'Active Activities', value: '4' },
    { label: 'Bookings This Month', value: '31' },
    { label: 'Avg Rating', value: '4.8' },
    { label: 'Revenue This Month', value: 'R 18 200' },
  ],
  'Guided Tours': [
    { label: 'Active Tours', value: '3' },
    { label: 'Departures Scheduled', value: '8' },
    { label: 'Guides Available', value: '4' },
    { label: 'Revenue This Month', value: 'R 31 500' },
  ],
  Shuttle: [
    { label: 'Fleet Size', value: '3' },
    { label: 'Trips This Month', value: '47' },
    { label: 'Active Routes', value: '6' },
    { label: 'Revenue This Month', value: 'R 14 100' },
  ],
  Experience: [
    { label: 'Active Experiences', value: '5' },
    { label: 'Bookings This Month', value: '22' },
    { label: 'Avg Group Size', value: '8' },
    { label: 'Revenue This Month', value: 'R 27 400' },
  ],
}

const STATUS_STYLES: Record<string, string> = {
  confirmed:  'bg-emerald-100 text-emerald-700',
  completed:  'bg-slate-100 text-slate-600',
  pending:    'bg-amber-100 text-amber-700',
  cancelled:  'bg-red-100 text-red-600',
}

export default function SupplierOverview() {
  const { config, supplierType, supplierTypes, nav, isApproved, loading } = useSupplier()
  const [recentBookings, setRecentBookings] = useState<SupplierOrder[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setBookingsLoading(false); return }
      // RLS scopes this to orders that actually belong to the signed-in
      // supplier — never another supplier's bookings.
      const orders = await getMyOrders()
      setRecentBookings(orders.slice(0, 5))
      setBookingsLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isApproved) {
    return (
      <div className="p-8 max-w-lg">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex gap-4">
          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-sans font-semibold text-amber-800">Account Pending Approval</p>
            <p className="font-sans text-sm text-amber-700 mt-1">
              Your supplier account is currently under review. You&apos;ll receive an email once approved and can then
              manage your listings and bookings.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const stats = supplierType ? (TYPE_STATS[supplierType] ?? []) : []

  // Quick-links: first type-specific nav items (skip Overview and shared tail)
  const typeSpecificLinks = nav.filter(item =>
    item.href !== '/supplier' &&
    !['/supplier/bookings', '/supplier/availability', '/supplier/discounts',
      '/supplier/reviews', '/supplier/media', '/supplier/analytics', '/supplier/messages',
    ].includes(item.href)
  )

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <p className="font-sans text-sm text-black/40 uppercase tracking-widest mb-1">
          {supplierTypes.length > 1
            ? supplierTypes.join(' · ')
            : (config?.label ?? 'Supplier')}
        </p>
        <h1 className="font-display italic text-3xl text-black/90">Dashboard Overview</h1>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-black/8 p-5">
              <p className="font-sans text-xs text-black/40 uppercase tracking-wider mb-1">{s.label}</p>
              <p className="font-display italic text-2xl text-black/90">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      {typeSpecificLinks.length > 0 && (
        <div>
          <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider mb-3">Manage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {typeSpecificLinks.map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-white border border-black/8 rounded-xl p-4 flex items-center gap-3 hover:border-[#C9A96E]/40 hover:shadow-sm transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center group-hover:bg-[#C9A96E]/20 transition-colors">
                    <Icon size={16} className="text-[#C9A96E]" />
                  </div>
                  <span className="font-sans text-sm font-medium text-black/70 group-hover:text-black/90 transition-colors flex-1">{item.label}</span>
                  <ArrowRight size={14} className="text-black/20 group-hover:text-[#C9A96E] transition-colors" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Recent Bookings</h2>
          <Link href="/supplier/bookings" className="font-sans text-xs text-[#C9A96E] hover:underline">View all</Link>
        </div>
        {bookingsLoading ? (
          <div className="bg-white rounded-xl border border-black/8 flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-black/8 p-8 text-center">
            <p className="font-sans text-sm text-black/40">No bookings yet. They&apos;ll appear here as guests confirm them.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/6">
                  {['Reference', 'Guest', 'Item', 'Date', 'Total', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b, i) => {
                  const firstItem = b.items[0]
                  const itemLabel = firstItem
                    ? `${firstItem.title}${b.items.length > 1 ? ` +${b.items.length - 1}` : ''}`
                    : '—'
                  const date = b.checkIn || firstItem?.date
                  return (
                    <tr key={b.id} className={i < recentBookings.length - 1 ? 'border-b border-black/5' : ''}>
                      <td className="px-4 py-3 font-sans text-xs text-black/40">{b.reference}</td>
                      <td className="px-4 py-3 font-sans text-sm text-black/80">{b.customerName}</td>
                      <td className="px-4 py-3 font-sans text-sm text-black/60 max-w-[180px] truncate">{itemLabel}</td>
                      <td className="px-4 py-3 font-sans text-sm text-black/60">{date ? new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="px-4 py-3 font-sans text-sm text-black/80">R {b.orderTotal.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[b.status]}`}>{b.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
