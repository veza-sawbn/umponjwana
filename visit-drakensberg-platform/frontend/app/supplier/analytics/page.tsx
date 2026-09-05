'use client'
import { useEffect, useMemo, useState } from 'react'
import { BarChart2, TrendingUp, Users, Star } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getMyOrderLines, type OrderLine } from '@/lib/orders'
import { getSupplierEntities, type SupplierEntity } from '@/lib/supplier-entities'
import { formatMoney } from '@/lib/allocation'

// Every number on this page comes from the supplier's own order lines and
// reviews (row-level security scopes both to them). Nothing is simulated: a
// supplier with no trading history sees empty states, not a demo curve.

type Review = SupplierEntity & { rating: number }

const MONTHS_SHOWN = 6

/** A line counts once its money is real. Lines still unpaid, or refunded,
 *  are left out — they would flatter the numbers. (vd_order_lines
 *  payment_status: unpaid | partial | paid | refunded.) */
function isEarned(line: OrderLine): boolean {
  return line.payment_status === 'paid' || line.payment_status === 'partial'
}

/** Revenue is recognised on the month the service is delivered, falling back
 *  to when the line was created for anything without a service date. */
function monthKey(line: OrderLine): string {
  return (line.service_date ?? line.created_at ?? '').slice(0, 7)
}

function monthKeysEndingNow(count: number): string[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-ZA', { month: 'short' })
}

function pctDelta(current: number, previous: number): string | null {
  if (!previous) return null
  const change = Math.round(((current - previous) / previous) * 100)
  return `${change >= 0 ? '+' : ''}${change}%`
}

type Bucket = { revenue: number; bookings: number }

export default function AnalyticsPage() {
  const [lines, setLines] = useState<OrderLine[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser()
      const [myLines, myReviews] = await Promise.all([
        getMyOrderLines(),
        data.user ? getSupplierEntities<Review>('reviews', effectiveSupplierId(data.user.id)) : Promise.resolve([]),
      ])
      setLines(myLines)
      setReviews(myReviews)
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const earned = lines.filter(isEarned)
    const months = monthKeysEndingNow(MONTHS_SHOWN)
    const priorMonths = monthKeysEndingNow(MONTHS_SHOWN * 2).slice(0, MONTHS_SHOWN)

    // One booking = one order, however many lines this supplier delivers on it.
    const buckets = new Map<string, Bucket>(months.map(m => [m, { revenue: 0, bookings: 0 }]))
    const ordersByMonth = new Map<string, Set<string>>(months.map(m => [m, new Set<string>()]))

    let priorRevenue = 0
    const priorOrders = new Set<string>()
    // Counted across the whole window, not summed from the monthly buckets —
    // an order with services in two months is still one booking.
    const windowOrders = new Set<string>()

    for (const line of earned) {
      const key = monthKey(line)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.revenue += Number(line.supplier_share) || 0
        ordersByMonth.get(key)!.add(line.order_id)
        windowOrders.add(line.order_id)
      } else if (priorMonths.includes(key)) {
        priorRevenue += Number(line.supplier_share) || 0
        priorOrders.add(line.order_id)
      }
    }
    for (const [key, orders] of ordersByMonth) buckets.get(key)!.bookings = orders.size

    const series = months.map(m => ({ key: m, ...buckets.get(m)! }))
    const revenue = series.reduce((sum, m) => sum + m.revenue, 0)
    const bookings = windowOrders.size
    const rated = reviews.filter(r => Number(r.rating) > 0)
    const rating = rated.length ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length : null

    return {
      series,
      revenue,
      bookings,
      avgBookingValue: bookings ? revenue / bookings : 0,
      rating,
      reviewCount: rated.length,
      revenueDelta: pctDelta(revenue, priorRevenue),
      bookingsDelta: pctDelta(bookings, priorOrders.size),
      avgDelta: pctDelta(
        bookings ? revenue / bookings : 0,
        priorOrders.size ? priorRevenue / priorOrders.size : 0,
      ),
      hasHistory: earned.length > 0,
    }
  }, [lines, reviews])

  const maxRevenue = Math.max(...stats.series.map(m => m.revenue), 0)
  const maxBookings = Math.max(...stats.series.map(m => m.bookings), 0)

  const kpis = [
    { label: `Revenue · last ${MONTHS_SHOWN} months`, value: formatMoney(stats.revenue), icon: TrendingUp, delta: stats.revenueDelta },
    { label: 'Bookings', value: String(stats.bookings), icon: Users, delta: stats.bookingsDelta },
    { label: 'Avg booking value', value: formatMoney(stats.avgBookingValue), icon: BarChart2, delta: stats.avgDelta },
    {
      label: 'Avg rating',
      value: stats.rating === null ? '—' : `${stats.rating.toFixed(1)} ★`,
      icon: Star,
      delta: null,
      note: stats.reviewCount ? `${stats.reviewCount} review${stats.reviewCount !== 1 ? 's' : ''}` : 'No reviews yet',
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-3">
        <BarChart2 size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Analytics</h1>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-black/40">Loading your figures…</p>
      ) : (
        <>
          <p className="font-sans text-xs text-black/40 max-w-2xl">
            Your own paid and part-paid order lines over the last {MONTHS_SHOWN} months, counted on the date each
            service is delivered. Revenue is your net share after commission and platform fees; comparisons are
            against the {MONTHS_SHOWN} months before that.
          </p>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(k => {
              const Icon = k.icon
              const positive = k.delta ? !k.delta.startsWith('-') : false
              return (
                <div key={k.label} className="bg-white rounded-xl border border-black/8 p-5">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <p className="font-sans text-xs text-black/40 uppercase tracking-wider">{k.label}</p>
                    <Icon size={15} className="text-[#C9A96E] shrink-0" />
                  </div>
                  <p className="font-display italic text-2xl text-black/90">{k.value}</p>
                  {k.delta ? (
                    <p className={`font-sans text-xs mt-1 ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                      {k.delta} vs previous period
                    </p>
                  ) : (
                    <p className="font-sans text-xs text-black/30 mt-1">{k.note ?? 'No earlier period to compare'}</p>
                  )}
                </div>
              )
            })}
          </div>

          {!stats.hasHistory ? (
            <div className="bg-white rounded-xl border border-black/8 p-8 text-center">
              <p className="font-sans text-sm text-black/50">No paid bookings yet.</p>
              {/* Charts stay hidden rather than drawing a flat, meaningless axis. */}
              <p className="font-sans text-xs text-black/35 mt-1">
                Your revenue and booking trends appear here as soon as your first booking is paid.
              </p>
            </div>
          ) : (
            <>
              {/* Revenue chart */}
              <div className="bg-white rounded-xl border border-black/8 p-6">
                <p className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider mb-6">Monthly Revenue (ZAR)</p>
                <div className="flex items-end gap-3 h-40">
                  {stats.series.map(m => (
                    <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-2">
                      <p className="font-sans text-[10px] text-black/40">
                        {m.revenue >= 1000 ? `R ${(m.revenue / 1000).toFixed(1)}k` : formatMoney(m.revenue)}
                      </p>
                      <div
                        className="w-full bg-[#C9A96E]/20 rounded-t-md transition-all hover:bg-[#C9A96E]/40"
                        style={{ height: maxRevenue ? `${(m.revenue / maxRevenue) * 100}%` : '0%' }}
                      />
                      <p className="font-sans text-[10px] text-black/40">{monthLabel(m.key)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bookings chart */}
              <div className="bg-white rounded-xl border border-black/8 p-6">
                <p className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider mb-6">Monthly Bookings</p>
                <div className="flex items-end gap-3 h-28">
                  {stats.series.map(m => (
                    <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-2">
                      <p className="font-sans text-[10px] text-black/40">{m.bookings}</p>
                      <div
                        className="w-full bg-black/8 rounded-t-md hover:bg-black/15 transition-all"
                        style={{ height: maxBookings ? `${(m.bookings / maxBookings) * 100}%` : '0%' }}
                      />
                      <p className="font-sans text-[10px] text-black/40">{monthLabel(m.key)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
