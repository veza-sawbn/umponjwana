'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Clock, XCircle, TrendingUp, Users, ListChecks, DollarSign, Building2, AlertTriangle } from 'lucide-react'
import { admin } from '@/lib/api'

type Stats = { total_users: number; total_suppliers: number; total_listings: number; total_bookings: number; total_revenue: number; pending_bookings: number }
type Supplier = { id: string; business_name: string; description: string; website?: string; is_verified: boolean; created_at: string }
type Booking = { id: string; guest_name?: string; total_amount?: number; total_price?: number; status: string; created_at: string; listing_id?: string }
type Guide = { id: string; full_name: string; verification_status: string; supplier_id: string }

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]', pending: 'bg-[#C9A96E]/15 text-[#8B6914]', cancelled: 'bg-red-50 text-red-500', completed: 'bg-gray-100 text-gray-500',
}
const STATUS_ICON: Record<string, any> = { confirmed: CheckCircle, pending: Clock, cancelled: XCircle, completed: CheckCircle }

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [error, setError] = useState('')

  async function loadDashboard() {
    try {
      const [statsData, supplierData, bookingData, guideData] = await Promise.all([
        admin.getStats(), admin.getSuppliers({ limit: 100 }), admin.getBookings({ limit: 6 }), admin.getGuides({ status_filter: 'pending' }),
      ])
      setStats(statsData)
      setSuppliers((supplierData.items || []).filter((s: Supplier) => !s.is_verified))
      setBookings(bookingData.items || [])
      setGuides(guideData || [])
    } catch (err) {
      setError('Could not load live admin data. Check your admin session and API connection.')
    }
  }

  useEffect(() => { loadDashboard() }, [])

  async function verifySupplier(id: string) {
    await admin.verifySupplier(id)
    await loadDashboard()
  }

  async function verifyGuide(id: string, verified: boolean) {
    await admin.verifyGuide(id, verified)
    await loadDashboard()
  }

  const cards = [
    { label: 'Published Listings', value: stats?.total_listings ?? '—', sub: 'Live listings in database', icon: ListChecks, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Total Bookings', value: stats?.total_bookings ?? '—', sub: `${stats?.pending_bookings ?? 0} pending`, icon: TrendingUp, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: 'Total Revenue', value: `R ${(stats?.total_revenue ?? 0).toLocaleString()}`, sub: 'Paid payments', icon: DollarSign, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Suppliers', value: stats?.total_suppliers ?? '—', sub: `${suppliers.length} pending approval`, icon: Building2, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: 'Registered Users', value: stats?.total_users ?? '—', sub: 'All platform accounts', icon: Users, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Pending Guides', value: guides.length, sub: 'Guide registrations awaiting review', icon: AlertTriangle, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
  ]

  return <div className="p-8">
    <div className="mb-8"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Platform Overview</h1><p className="font-sans text-sm text-gray-500 mt-1">Live data from the platform API</p>{error && <p className="mt-3 text-sm text-red-500">{error}</p>}</div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">{cards.map(s => { const Icon=s.icon; return <div key={s.label} className="bg-white border border-gray-200 p-5"><div className={`${s.bg} p-2 inline-block mb-3`}><Icon size={16} className={s.color}/></div><p className="font-display italic text-2xl text-[#000000] mb-0.5">{s.value}</p><p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{s.label}</p><p className="font-sans text-xs text-gray-500 mt-1">{s.sub}</p></div> })}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="bg-white border border-gray-200"><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h2 className="font-display italic text-xl text-[#000000]">Pending Approvals</h2><p className="font-sans text-xs text-gray-400">{suppliers.length} suppliers and {guides.length} guides awaiting review</p></div><Link href="/admin/suppliers" className="font-sans text-xs text-[#2d6a4f] hover:underline">View suppliers →</Link></div><div className="divide-y divide-gray-100">
        {suppliers.map(s => <div key={s.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1"><p className="font-sans text-sm font-medium">{s.business_name}</p><p className="font-sans text-xs text-gray-400">{s.description}</p></div><button onClick={() => verifySupplier(s.id)} className="bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs">Approve</button></div>)}
        {guides.map(g => <div key={g.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1"><p className="font-sans text-sm font-medium">{g.full_name}</p><p className="font-sans text-xs text-gray-400">Guide registration</p></div><button onClick={() => verifyGuide(g.id, true)} className="bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs">Approve</button><button onClick={() => verifyGuide(g.id, false)} className="border border-red-200 text-red-400 px-3 py-1.5 font-sans text-xs">Reject</button></div>)}
        {suppliers.length === 0 && guides.length === 0 && <div className="px-6 py-10 text-center"><CheckCircle size={24} className="text-[#2d6a4f] mx-auto mb-2"/><p className="font-sans text-sm text-gray-400">All applications reviewed</p></div>}
      </div></div>
      <div className="bg-white border border-gray-200"><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h2 className="font-display italic text-xl text-[#000000]">Recent Bookings</h2><p className="font-sans text-xs text-gray-400">Latest platform activity</p></div><Link href="/admin/bookings" className="font-sans text-xs text-[#2d6a4f] hover:underline">View all →</Link></div><div className="divide-y divide-gray-100">{bookings.map(b => { const Icon=STATUS_ICON[b.status] || Clock; return <div key={b.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><p className="font-sans text-xs text-gray-400 font-mono">{b.id.slice(0,8)}</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${STATUS_STYLE[b.status] || STATUS_STYLE.pending}`}><Icon size={9}/> {b.status}</span></div><p className="font-sans text-sm font-medium truncate">{b.guest_name || 'Guest booking'}</p><p className="font-sans text-xs text-gray-400 truncate">{b.listing_id || 'Listing'}</p></div><div className="text-right shrink-0"><p className="font-display italic text-lg text-[#2d6a4f]">R {(b.total_amount ?? b.total_price ?? 0).toLocaleString()}</p><p className="font-sans text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</p></div></div>})}</div></div>
    </div>
  </div>
}
