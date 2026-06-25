'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Clock, XCircle, TrendingUp, Users, ListChecks, DollarSign, Building2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/auth'

type Stats = { totalUsers: number; totalSuppliers: number; totalListings: number; totalBookings: number; totalRevenue: number; pendingBookings: number }
type Supplier = { id: string; full_name?: string | null; email?: string | null; is_approved: boolean; created_at: string }
type Booking = { id: string; total_amount: number; status: string; created_at: string; listing_id?: string | null }
type Guide = { id: string; full_name: string; verification_status: string; supplier_id: string }

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  cancelled: 'bg-red-50 text-red-500',
  completed: 'bg-gray-100 text-gray-500',
}
const STATUS_ICON: Record<string, any> = { confirmed: CheckCircle, pending: Clock, cancelled: XCircle, completed: CheckCircle }

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalSuppliers: 0, totalListings: 0, totalBookings: 0, totalRevenue: 0, pendingBookings: 0 })
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [error, setError] = useState('')

  async function countRows(table: string, filter?: (query: any) => any) {
    let query = supabase.from(table).select('*', { count: 'exact', head: true })
    if (filter) query = filter(query)
    const { count, error } = await query
    if (error) throw error
    return count || 0
  }

  async function loadDashboard() {
    setError('')
    try {
      const [totalUsers, totalSuppliers, totalListings, totalBookings, pendingBookings, supplierResult, bookingResult, guideResult] = await Promise.all([
        countRows('profiles'),
        countRows('profiles', q => q.eq('role', 'supplier')),
        countRows('listings'),
        countRows('bookings'),
        countRows('bookings', q => q.eq('status', 'pending')),
        supabase.from('profiles').select('id, full_name, email, is_approved, created_at').eq('role', 'supplier').eq('is_approved', false).order('created_at', { ascending: false }).limit(5),
        supabase.from('bookings').select('id, total_amount, status, created_at, listing_id').order('created_at', { ascending: false }).limit(6),
        supabase.from('guides').select('id, full_name, verification_status, supplier_id').eq('verification_status', 'pending').order('created_at', { ascending: false }).limit(5),
      ])
      if (supplierResult.error) throw supplierResult.error
      if (bookingResult.error) throw bookingResult.error
      if (guideResult.error) throw guideResult.error
      const revenue = (bookingResult.data || []).reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0)
      setStats({ totalUsers, totalSuppliers, totalListings, totalBookings, totalRevenue: revenue, pendingBookings })
      setSuppliers(supplierResult.data || [])
      setBookings(bookingResult.data || [])
      setGuides(guideResult.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin dashboard data from Supabase.')
    }
  }

  useEffect(() => { loadDashboard() }, [])

  async function approveSupplier(id: string) {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', id)
    if (error) setError(error.message)
    await loadDashboard()
  }

  async function verifyGuide(id: string, verified: boolean) {
    const { error } = await supabase.from('guides').update({ verification_status: verified ? 'verified' : 'rejected' }).eq('id', id)
    if (error) setError(error.message)
    await loadDashboard()
  }

  const cards = [
    { label: 'Published Listings', value: stats.totalListings, sub: 'Listings in Supabase', icon: ListChecks, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Total Bookings', value: stats.totalBookings, sub: `${stats.pendingBookings} pending`, icon: TrendingUp, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: 'Recent Revenue', value: `R ${stats.totalRevenue.toLocaleString()}`, sub: 'Latest loaded bookings', icon: DollarSign, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Suppliers', value: stats.totalSuppliers, sub: `${suppliers.length} pending approval`, icon: Building2, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: 'Registered Users', value: stats.totalUsers, sub: 'Profiles in Supabase', icon: Users, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
    { label: 'Pending Guides', value: guides.length, sub: 'Guide registrations awaiting review', icon: AlertTriangle, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
  ]

  return <div className="p-8">
    <div className="mb-8"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Platform Overview</h1><p className="font-sans text-sm text-gray-500 mt-1">Live data from Supabase</p>{error && <p className="mt-3 text-sm text-red-500">{error}</p>}</div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">{cards.map(s => { const Icon = s.icon; return <div key={s.label} className="bg-white border border-gray-200 p-5"><div className={`${s.bg} p-2 inline-block mb-3`}><Icon size={16} className={s.color}/></div><p className="font-display italic text-2xl text-[#000000] mb-0.5">{s.value}</p><p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{s.label}</p><p className="font-sans text-xs text-gray-500 mt-1">{s.sub}</p></div> })}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="bg-white border border-gray-200"><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h2 className="font-display italic text-xl text-[#000000]">Pending Approvals</h2><p className="font-sans text-xs text-gray-400">{suppliers.length} suppliers and {guides.length} guides awaiting review</p></div><Link href="/admin/suppliers" className="font-sans text-xs text-[#2d6a4f] hover:underline">View suppliers →</Link></div><div className="divide-y divide-gray-100">
        {suppliers.map(s => <div key={s.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1"><p className="font-sans text-sm font-medium">{s.full_name || s.email || 'Supplier'}</p><p className="font-sans text-xs text-gray-400">Supplier account pending approval</p></div><button onClick={() => approveSupplier(s.id)} className="bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs">Approve</button></div>)}
        {guides.map(g => <div key={g.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1"><p className="font-sans text-sm font-medium">{g.full_name}</p><p className="font-sans text-xs text-gray-400">Guide registration</p></div><button onClick={() => verifyGuide(g.id, true)} className="bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs">Approve</button><button onClick={() => verifyGuide(g.id, false)} className="border border-red-200 text-red-400 px-3 py-1.5 font-sans text-xs">Reject</button></div>)}
        {suppliers.length === 0 && guides.length === 0 && <div className="px-6 py-10 text-center"><CheckCircle size={24} className="text-[#2d6a4f] mx-auto mb-2"/><p className="font-sans text-sm text-gray-400">All applications reviewed</p></div>}
      </div></div>
      <div className="bg-white border border-gray-200"><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h2 className="font-display italic text-xl text-[#000000]">Recent Bookings</h2><p className="font-sans text-xs text-gray-400">Latest Supabase bookings</p></div><Link href="/admin/bookings" className="font-sans text-xs text-[#2d6a4f] hover:underline">View all →</Link></div><div className="divide-y divide-gray-100">{bookings.map(b => { const Icon = STATUS_ICON[b.status] || Clock; return <div key={b.id} className="px-6 py-4 flex items-center gap-4"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><p className="font-sans text-xs text-gray-400 font-mono">{b.id.slice(0, 8)}</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${STATUS_STYLE[b.status] || STATUS_STYLE.pending}`}><Icon size={9}/> {b.status}</span></div><p className="font-sans text-sm font-medium truncate">Booking</p><p className="font-sans text-xs text-gray-400 truncate">{b.listing_id || 'Listing'}</p></div><div className="text-right shrink-0"><p className="font-display italic text-lg text-[#2d6a4f]">R {Number(b.total_amount || 0).toLocaleString()}</p><p className="font-sans text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</p></div></div>})}</div></div>
    </div>
  </div>
}
