'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/auth'

type Supplier = {
  id: string
  full_name?: string | null
  email?: string | null
  bio?: string | null
  website?: string | null
  is_approved: boolean
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
}

function supplierStatus(supplier: Supplier) {
  return supplier.is_approved ? 'approved' : 'pending'
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadSuppliers() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, bio, is_approved, created_at')
        .eq('role', 'supplier')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setSuppliers(data || [])
    } catch {
      setError('Could not load suppliers from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSuppliers() }, [])

  const filtered = useMemo(() => suppliers.filter(supplier => {
    const status = supplierStatus(supplier)
    const searchable = `${supplier.full_name || ''} ${supplier.email || ''} ${supplier.bio || ''}`.toLowerCase()
    const matchSearch = searchable.includes(search.toLowerCase())
    const matchFilter = filter === 'all' || status === filter
    return matchSearch && matchFilter
  }), [filter, search, suppliers])

  const counts = {
    all: suppliers.length,
    pending: suppliers.filter(s => !s.is_approved).length,
    approved: suppliers.filter(s => s.is_approved).length,
  }

  async function setVerified(id: string, verified: boolean) {
    const { error } = await supabase.from('profiles').update({ is_approved: verified }).eq('id', id)
    if (error) setError(error.message)
    await loadSuppliers()
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Suppliers</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Live supplier profiles from Supabase.</p>
        </div>
        <button
          onClick={loadSuppliers}
          className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {(['all', 'pending', 'approved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-3 font-sans text-sm border-b-2 transition-colors capitalize ${
              filter === f ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {f} <span className="ml-1 font-sans text-xs text-gray-400">({counts[f]})</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 p-4 mb-6 flex items-center gap-2">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or bio…"
          className="flex-1 font-sans text-sm focus:outline-none"
        />
      </div>

      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Supplier', 'Email', 'Bio', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(supplier => {
              const status = supplierStatus(supplier)
              return (
                <tr key={supplier.id} className="hover:bg-[#F7F5F2] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm shrink-0">
                        {(supplier.full_name || supplier.email || 'S')[0]}
                      </div>
                      <p className="font-sans text-sm font-medium">{supplier.full_name || 'Supplier'}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 max-w-sm">
                    <p className="font-sans text-sm text-gray-600 line-clamp-2">{supplier.email || 'No email'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-sans text-sm text-gray-600 line-clamp-2">{supplier.bio || 'No bio provided'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[status]}`}>{status}</span>
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-400">{new Date(supplier.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {!supplier.is_approved ? (
                        <>
                          <button
                            onClick={() => setVerified(supplier.id, true)}
                            className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors flex items-center gap-1"
                          >
                            <CheckCircle size={11} /> Approve
                          </button>
                          <button
                            onClick={() => setVerified(supplier.id, false)}
                            className="px-2.5 py-1 border border-red-200 text-red-400 font-sans text-xs hover:bg-red-50 transition-colors flex items-center gap-1"
                          >
                            <XCircle size={11} /> Keep pending
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setVerified(supplier.id, false)}
                          className="px-2.5 py-1 border border-gray-200 text-gray-500 font-sans text-xs hover:border-red-200 hover:text-red-400 transition-colors flex items-center gap-1"
                        >
                          <XCircle size={11} /> Unverify
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No suppliers found.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading suppliers…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
