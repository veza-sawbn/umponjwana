'use client'
import { BarChart2, TrendingUp, Users, Star } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const REVENUE = [12400, 18600, 15200, 22800, 19400, 24680]
const BOOKINGS_DATA = [8, 14, 11, 17, 13, 16]
const MAX_REV = Math.max(...REVENUE)

export default function AnalyticsPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-3">
        <BarChart2 size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Analytics</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue YTD',    value: 'R 113 080', icon: TrendingUp, delta: '+18%' },
          { label: 'Total Bookings', value: '79',         icon: Users,      delta: '+12%' },
          { label: 'Avg Booking Val',value: 'R 1 431',   icon: BarChart2,  delta: '+5%'  },
          { label: 'Avg Rating',     value: '4.8 ★',     icon: Star,       delta: '+0.2' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white rounded-xl border border-black/8 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-sans text-xs text-black/40 uppercase tracking-wider">{k.label}</p>
                <Icon size={15} className="text-[#C9A96E]" />
              </div>
              <p className="font-display italic text-2xl text-black/90">{k.value}</p>
              <p className="font-sans text-xs text-emerald-600 mt-1">{k.delta} vs last period</p>
            </div>
          )
        })}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-xl border border-black/8 p-6">
        <p className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider mb-6">Monthly Revenue (ZAR)</p>
        <div className="flex items-end gap-3 h-40">
          {REVENUE.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <p className="font-sans text-[10px] text-black/40">R {(v / 1000).toFixed(0)}k</p>
              <div
                className="w-full bg-[#C9A96E]/20 rounded-t-md transition-all hover:bg-[#C9A96E]/40"
                style={{ height: `${(v / MAX_REV) * 100}%` }}
              />
              <p className="font-sans text-[10px] text-black/40">{MONTHS[i]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bookings chart */}
      <div className="bg-white rounded-xl border border-black/8 p-6">
        <p className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider mb-6">Monthly Bookings</p>
        <div className="flex items-end gap-3 h-28">
          {BOOKINGS_DATA.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <p className="font-sans text-[10px] text-black/40">{v}</p>
              <div className="w-full bg-black/8 rounded-t-md hover:bg-black/15 transition-all" style={{ height: `${(v / Math.max(...BOOKINGS_DATA)) * 100}%` }} />
              <p className="font-sans text-[10px] text-black/40">{MONTHS[i]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
