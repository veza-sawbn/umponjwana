'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Clock, XCircle, TrendingUp, Users, ListChecks, DollarSign, Building2, AlertTriangle } from 'lucide-react'

const STATS = [
  { label: 'Published Listings', value: '184', sub: '12 pending review', icon: ListChecks, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
  { label: 'Bookings This Month', value: '342', sub: '+23% vs last month', icon: TrendingUp, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
  { label: 'Revenue (June)', value: 'R 184,200', sub: 'Across all suppliers', icon: DollarSign, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
  { label: 'Active Suppliers', value: '87', sub: '5 pending approval', icon: Building2, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
  { label: 'Registered Visitors', value: '1,248', sub: '+48 this week', icon: Users, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
  { label: 'Pending Approvals', value: '5', sub: 'Suppliers awaiting review', icon: AlertTriangle, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
]

const PENDING_SUPPLIERS = [
  { id: 'sup1', name: 'Nomvula Khumalo', email: 'nomvula@bergescapes.co.za', business: 'Berg Escapes', type: 'Accommodation', submitted: '21 Jun 2026' },
  { id: 'sup2', name: 'Danie Botha', email: 'danie@saniadventures.co.za', business: 'Sani Adventures', type: 'Activity', submitted: '19 Jun 2026' },
  { id: 'sup3', name: 'Ayanda Mthembu', email: 'ayanda@royalbergtours.co.za', business: 'Royal Berg Tours', type: 'Guided Tours', submitted: '17 Jun 2026' },
  { id: 'sup4', name: 'Priscilla Nel', email: 'priscilla@champagneglamp.co.za', business: 'Champagne Glamping', type: 'Accommodation', submitted: '15 Jun 2026' },
  { id: 'sup5', name: 'Jerome van Niekerk', email: 'jerome@bergshuttles.co.za', business: 'Berg Shuttles', type: 'Shuttle', submitted: '14 Jun 2026' },
]

const RECENT_BOOKINGS = [
  { id: 'BK-4421', guest: 'Sarah van der Merwe', listing: 'Cathedral Peak Mountain Lodge', amount: 8214, status: 'confirmed', date: '23 Jun 2026' },
  { id: 'BK-4420', guest: 'James Fourie', listing: 'Tugela Falls Guided Hike', amount: 1160, status: 'confirmed', date: '22 Jun 2026' },
  { id: 'BK-4419', guest: 'Priya Naidoo', listing: 'Tendele Tented Camp', amount: 6400, status: 'pending', date: '22 Jun 2026' },
  { id: 'BK-4418', guest: 'Lindiwe Dlamini', listing: "Giant's Castle Restcamp", amount: 2340, status: 'confirmed', date: '21 Jun 2026' },
  { id: 'BK-4417', guest: 'Mike Peterson', listing: 'Rock Climbing Experience', amount: 1500, status: 'cancelled', date: '20 Jun 2026' },
  { id: 'BK-4416', guest: 'Thandi Sithole', listing: 'San Rock Art Full-Day Tour', amount: 1240, status: 'completed', date: '18 Jun 2026' },
]

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  cancelled: 'bg-red-50 text-red-500',
  completed: 'bg-gray-100 text-gray-500',
}

const STATUS_ICON: Record<string, any> = {
  confirmed: CheckCircle,
  pending: Clock,
  cancelled: XCircle,
  completed: CheckCircle,
}

export default function AdminOverviewPage() {
  const [suppliers, setSuppliers] = useState(PENDING_SUPPLIERS)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Platform Overview</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">Monday, 23 June 2026</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {STATS.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`${s.bg} p-2`}>
                  <Icon size={16} className={s.color} />
                </div>
              </div>
              <p className="font-display italic text-2xl text-[#000000] mb-0.5">{s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{s.label}</p>
              <p className="font-sans text-xs text-gray-500 mt-1">{s.sub}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Pending supplier approvals */}
        <div className="bg-white border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-display italic text-xl text-[#000000]">Pending Approvals</h2>
              <p className="font-sans text-xs text-gray-400">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} awaiting review</p>
            </div>
            <Link href="/admin/suppliers" className="font-sans text-xs text-[#2d6a4f] hover:underline">View all →</Link>
          </div>
          {suppliers.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle size={24} className="text-[#2d6a4f] mx-auto mb-2" />
              <p className="font-sans text-sm text-gray-400">All applications reviewed</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {suppliers.map(sup => (
                <div key={sup.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] shrink-0">
                    {sup.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-medium truncate">{sup.name}</p>
                    <p className="font-sans text-xs text-gray-400">{sup.business} · {sup.type}</p>
                    <p className="font-sans text-xs text-gray-300">{sup.submitted}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setSuppliers(p => p.filter(s => s.id !== sup.id))}
                      className="bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs hover:bg-[#235a3f] transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setSuppliers(p => p.filter(s => s.id !== sup.id))}
                      className="border border-red-200 text-red-400 px-3 py-1.5 font-sans text-xs hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent bookings */}
        <div className="bg-white border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-display italic text-xl text-[#000000]">Recent Bookings</h2>
              <p className="font-sans text-xs text-gray-400">Latest platform activity</p>
            </div>
            <Link href="/admin/bookings" className="font-sans text-xs text-[#2d6a4f] hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {RECENT_BOOKINGS.map(b => {
              const Icon = STATUS_ICON[b.status]
              return (
                <div key={b.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-sans text-xs text-gray-400 font-mono">{b.id}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${STATUS_STYLE[b.status]}`}>
                        <Icon size={9} /> {b.status}
                      </span>
                    </div>
                    <p className="font-sans text-sm font-medium truncate">{b.guest}</p>
                    <p className="font-sans text-xs text-gray-400 truncate">{b.listing}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display italic text-lg text-[#2d6a4f]">R {b.amount.toLocaleString()}</p>
                    <p className="font-sans text-xs text-gray-400">{b.date}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
