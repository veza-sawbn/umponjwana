'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Clock, XCircle, TrendingUp, Users, ListChecks, DollarSign, Building2, AlertTriangle, Inbox } from 'lucide-react'
import {
  getAdminStats, getAdminSuppliers, getAdminBookings, setAdminSupplierVerified,
  type AdminStats, type AdminSupplier,
} from '@/lib/admin-supabase'
import type { SavedBooking } from '@/lib/bookings'
import { ADMIN_QUICK_ACTIONS } from '@/lib/admin-nav'
import { getListingApplications, APPLICANT_TYPES, type ListingApplication } from '@/lib/listing-applications'

const typeLabel = (id: string) => APPLICANT_TYPES.find(t => t.id === id)?.label ?? id

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]', pending: 'bg-[#C9A96E]/15 text-[#8B6914]', cancelled: 'bg-red-50 text-red-500', completed: 'bg-gray-100 text-gray-500',
}
const STATUS_ICON: Record<string, any> = { confirmed: CheckCircle, pending: Clock, cancelled: XCircle, completed: CheckCircle }

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [pendingSuppliers, setPendingSuppliers] = useState<AdminSupplier[]>([])
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [newApplications, setNewApplications] = useState<ListingApplication[]>([])
  const [error, setError] = useState('')

  async function loadDashboard() {
    try {
      const [statsData, supplierData, bookingData, applicationData] = await Promise.all([
        getAdminStats(), getAdminSuppliers(), getAdminBookings(), getListingApplications(),
      ])
      setStats(statsData)
      setPendingSuppliers(supplierData.filter(s => !s.is_verified))
      setBookings(bookingData.slice(0, 6))
      setNewApplications(applicationData.filter(a => a.status === 'new' || a.status === 'in_review'))
      setError('')
    } catch {
      setError('Could not load live admin data. Confirm you are signed in as an admin.')
    }
  }

  useEffect(() => { loadDashboard() }, [])

  async function verifySupplier(id: string) {
    try {
      await setAdminSupplierVerified(id, true)
      await loadDashboard()
    } catch {
      setError('Approval failed — check your admin permissions.')
    }
  }

  const cards = [
    { label: 'Listings', value: stats?.totalListings ?? '—', sub: 'Properties, activities & tours', icon: ListChecks, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Total Bookings', value: stats?.totalBookings ?? '—', sub: `${stats?.cancelledBookings ?? 0} cancelled`, icon: TrendingUp, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: 'Booked Revenue', value: `R ${(stats?.totalRevenue ?? 0).toLocaleString()}`, sub: 'Confirmed bookings', icon: DollarSign, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Suppliers', value: stats?.totalSuppliers ?? '—', sub: `${stats?.pendingSuppliers ?? 0} pending approval`, icon: Building2, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: 'Registered Users', value: stats?.totalUsers ?? '—', sub: 'All platform accounts', icon: Users, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Pending Approvals', value: pendingSuppliers.length, sub: 'Suppliers awaiting review', icon: AlertTriangle, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: 'Listing Applications', value: newApplications.length, sub: 'New or in review', icon: Inbox, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
  ]

  return <div className="p-4 sm:p-6 lg:p-8">
    <div className="mb-6 lg:mb-8"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Platform Overview</h1><p className="font-sans text-sm text-gray-500 mt-1">Live data from Supabase</p>{error && <p className="mt-3 text-sm text-red-500">{error}</p>}</div>

    {/* Daily tasks, one tap away — mirrors the quick-action sheet behind the "+" tab. */}
    <div className="lg:hidden mb-6">
      <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Quick Actions</p>
      <div className="grid grid-cols-2 gap-3">
        {ADMIN_QUICK_ACTIONS.slice(0, 4).map(a => { const Icon = a.icon; return (
          <Link key={a.label} href={a.href} className="bg-white border border-gray-200 p-4 active:bg-[#F7F5F2] transition-colors">
            <div className="bg-[#2d6a4f]/8 w-9 h-9 flex items-center justify-center mb-3"><Icon size={16} className="text-[#2d6a4f]"/></div>
            <p className="font-sans text-sm text-gray-800 leading-snug">{a.label}</p>
          </Link>
        )})}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8 lg:mb-10">{cards.map(s => { const Icon=s.icon; return <div key={s.label} className="bg-white border border-gray-200 p-4 sm:p-5"><div className={`${s.bg} p-2 inline-block mb-3`}><Icon size={16} className={s.color}/></div><p className="font-display italic text-xl sm:text-2xl text-[#000000] mb-0.5">{s.value}</p><p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{s.label}</p><p className="font-sans text-xs text-gray-500 mt-1">{s.sub}</p></div> })}</div>

    {/* New leads from /list-with-us — the only place these are visible before this widget existed. */}
    <div className="bg-white border border-gray-200 mb-6 lg:mb-8"><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h2 className="font-display italic text-xl text-[#000000]">Listing Applications</h2><p className="font-sans text-xs text-gray-400">{newApplications.length} new or in review</p></div><Link href="/admin/listing-applications" className="font-sans text-xs text-[#2d6a4f] hover:underline">Review queue →</Link></div><div className="divide-y divide-gray-100">
      {newApplications.slice(0, 5).map(a => <Link key={a.id} href="/admin/listing-applications" className="px-6 py-4 flex items-center gap-4 hover:bg-[#F7F5F2]/60 transition-colors"><div className="flex-1 min-w-0"><p className="font-sans text-sm font-medium truncate">{a.tradingName || a.businessName}</p><p className="font-sans text-xs text-gray-400 truncate">{a.contactEmail} · {a.supplierTypes.map(typeLabel).join(', ') || 'No type selected'}</p></div><span className="font-sans text-xs text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleDateString()}</span></Link>)}
      {newApplications.length === 0 && <div className="px-6 py-10 text-center"><Inbox size={24} className="text-gray-300 mx-auto mb-2"/><p className="font-sans text-sm text-gray-400">No new applications</p></div>}
    </div></div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
      <div className="bg-white border border-gray-200"><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h2 className="font-display italic text-xl text-[#000000]">Pending Approvals</h2><p className="font-sans text-xs text-gray-400">{pendingSuppliers.length} suppliers awaiting review</p></div><Link href="/admin/suppliers" className="font-sans text-xs text-[#2d6a4f] hover:underline">View suppliers →</Link></div><div className="divide-y divide-gray-100">
        {pendingSuppliers.map(s => <div key={s.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1 min-w-0"><p className="font-sans text-sm font-medium truncate">{s.business_name}</p><p className="font-sans text-xs text-gray-400 truncate">{s.email || s.description}</p></div><button onClick={() => verifySupplier(s.id)} className="bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs">Approve</button></div>)}
        {pendingSuppliers.length === 0 && <div className="px-6 py-10 text-center"><CheckCircle size={24} className="text-[#2d6a4f] mx-auto mb-2"/><p className="font-sans text-sm text-gray-400">All applications reviewed</p></div>}
      </div></div>
      <div className="bg-white border border-gray-200"><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h2 className="font-display italic text-xl text-[#000000]">Recent Bookings</h2><p className="font-sans text-xs text-gray-400">Latest platform activity</p></div><Link href="/admin/bookings" className="font-sans text-xs text-[#2d6a4f] hover:underline">View all →</Link></div><div className="divide-y divide-gray-100">
        {bookings.map(b => { const Icon=STATUS_ICON[b.status] || Clock; return <div key={b.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><p className="font-sans text-xs text-gray-400 font-mono">{b.reference}</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${STATUS_STYLE[b.status] || STATUS_STYLE.pending}`}><Icon size={9}/> {b.status}</span></div><p className="font-sans text-sm font-medium truncate">{b.customerName || 'Guest booking'}</p><p className="font-sans text-xs text-gray-400 truncate">{b.stay?.title || (b.addons[0]?.title ?? 'Trip booking')}</p></div><div className="text-right shrink-0"><p className="font-display italic text-lg text-[#2d6a4f]">R {(b.total ?? 0).toLocaleString()}</p><p className="font-sans text-xs text-gray-400">{new Date(b.createdAt).toLocaleDateString()}</p></div></div>})}
        {bookings.length === 0 && <div className="px-6 py-10 text-center"><Clock size={24} className="text-gray-300 mx-auto mb-2"/><p className="font-sans text-sm text-gray-400">No bookings yet</p></div>}
      </div></div>
    </div>
  </div>
}
