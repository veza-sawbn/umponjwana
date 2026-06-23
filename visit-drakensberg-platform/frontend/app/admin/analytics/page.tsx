'use client'

import { TrendingUp, Users, DollarSign, Map } from 'lucide-react'

const MONTHLY_BOOKINGS = [
  { month: 'Jan', bookings: 48, revenue: 82400 },
  { month: 'Feb', bookings: 62, revenue: 104800 },
  { month: 'Mar', bookings: 71, revenue: 128600 },
  { month: 'Apr', bookings: 89, revenue: 156200 },
  { month: 'May', bookings: 115, revenue: 198400 },
  { month: 'Jun', bookings: 142, revenue: 241600 },
]

const TOP_LISTINGS = [
  { title: 'Cathedral Peak Mountain Lodge', bookings: 42, revenue: 87820 },
  { title: 'Tendele Tented Camp', bookings: 28, revenue: 89600 },
  { title: 'San Rock Art Full-Day Tour', bookings: 35, revenue: 21700 },
  { title: 'Tugela Falls Guided Hike', bookings: 31, revenue: 17980 },
  { title: "Giant's Castle Restcamp", bookings: 26, revenue: 20280 },
]

const TOP_REGIONS = [
  { region: 'Northern Berg', bookings: 186, pct: 54 },
  { region: 'Central Berg', bookings: 103, pct: 30 },
  { region: 'Southern Berg', bookings: 42, pct: 12 },
  { region: 'Foothills', bookings: 11, pct: 4 },
]

const maxBookings = Math.max(...MONTHLY_BOOKINGS.map(m => m.bookings))
const maxRevenue = Math.max(...MONTHLY_BOOKINGS.map(m => m.revenue))
const maxListingRevenue = Math.max(...TOP_LISTINGS.map(l => l.revenue))

export default function AdminAnalyticsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Analytics</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">Platform performance overview · January – June 2026</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Bookings', value: '527', change: '+38%', icon: TrendingUp },
          { label: 'Total Revenue', value: 'R 912,000', change: '+44%', icon: DollarSign },
          { label: 'Unique Visitors', value: '1,248', change: '+21%', icon: Users },
          { label: 'Active Regions', value: '4', change: 'Consistent', icon: Map },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <Icon size={16} className="text-[#C9A96E]" />
                <span className="font-sans text-xs text-[#2d6a4f]">{k.change}</span>
              </div>
              <p className="font-display italic text-2xl text-[#000000]">{k.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{k.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        {/* Monthly bookings bar chart */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Monthly Bookings</h2>
          <div className="flex items-end gap-3 h-40">
            {MONTHLY_BOOKINGS.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="font-sans text-xs text-gray-500">{m.bookings}</span>
                <div
                  className="w-full bg-[#2d6a4f] transition-all"
                  style={{ height: `${Math.round((m.bookings / maxBookings) * 120)}px` }}
                />
                <span className="font-sans text-xs text-gray-400">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly revenue bar chart */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Monthly Revenue (R)</h2>
          <div className="flex items-end gap-3 h-40">
            {MONTHLY_BOOKINGS.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="font-sans text-xs text-gray-500">{(m.revenue / 1000).toFixed(0)}k</span>
                <div
                  className="w-full bg-[#C9A96E]"
                  style={{ height: `${Math.round((m.revenue / maxRevenue) * 120)}px` }}
                />
                <span className="font-sans text-xs text-gray-400">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Top listings */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Top Listings by Revenue</h2>
          <div className="space-y-4">
            {TOP_LISTINGS.map((l, i) => (
              <div key={l.title}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-gray-300 w-4">{i + 1}</span>
                    <span className="font-sans text-sm text-gray-700">{l.title}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-display italic text-[#2d6a4f]">R {l.revenue.toLocaleString()}</span>
                    <span className="font-sans text-xs text-gray-400 ml-2">({l.bookings} bookings)</span>
                  </div>
                </div>
                <div className="h-1.5 bg-[#F7F5F2] overflow-hidden">
                  <div className="h-full bg-[#2d6a4f]" style={{ width: `${Math.round((l.revenue / maxListingRevenue) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings by region */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl text-[#000000] mb-6">Bookings by Region</h2>
          <div className="space-y-5">
            {TOP_REGIONS.map(r => (
              <div key={r.region}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-sans text-sm text-gray-700">{r.region}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-sans text-xs text-gray-400">{r.bookings} bookings</span>
                    <span className="font-display italic text-[#C9A96E] w-10 text-right">{r.pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-[#F7F5F2] overflow-hidden">
                  <div className="h-full bg-[#C9A96E]" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="font-display italic text-lg mb-4">Visitor Registrations</h3>
            <div className="flex items-end gap-2 h-20">
              {[48, 55, 62, 71, 88, 102].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-[#2d6a4f]/30" style={{ height: `${Math.round((v / 102) * 64)}px` }} />
                  <span className="font-sans text-[10px] text-gray-400">
                    {['J', 'F', 'M', 'A', 'M', 'J'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
