'use client'

import { useEffect, useState } from 'react'
import { Search, Archive, Trash2, CheckCircle } from 'lucide-react'
import {
  getAdminListings, setAdminListingStatus, deleteAdminListing, type AdminListing,
} from '@/lib/admin-supabase'

const TYPE_LABEL: Record<string, string> = {
  property: 'Stay', activity: 'Activity', tour: 'Tour',
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  draft: 'bg-gray-100 text-gray-500',
}

export default function AdminListingsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [listings, setListings] = useState<AdminListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      setListings(await getAdminListings())
      setError('')
    } catch {
      setError('Could not load listings. Confirm you are signed in as an admin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = listings.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = l.name.toLowerCase().includes(q) || l.supplierName.toLowerCase().includes(q) || l.region.toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || l.kind === typeFilter
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  async function setStatus(l: AdminListing, status: string) {
    await setAdminListingStatus(l.kind, l.id, status)
    setListings(p => p.map(x => x.id === l.id ? { ...x, status } : x))
  }

  async function remove(l: AdminListing) {
    if (!window.confirm(`Delete "${l.name}" permanently? This cannot be undone.`)) return
    await deleteAdminListing(l.kind, l.id)
    setListings(p => p.filter(x => x.id !== l.id))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Listings</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Every live supplier listing on the platform</p>
        </div>
      </div>

      {error && <p className="mb-4 font-sans text-sm text-red-500">{error}</p>}

      {/* Filters */}
      <div className="bg-white border border-gray-200 p-4 mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search listings, suppliers or regions…"
            aria-label="Search listings"
            className="flex-1 font-sans text-sm focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
          className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="property">Accommodation</option>
          <option value="activity">Activity</option>
          <option value="tour">Guided Tour</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </select>
        <span className="font-sans text-xs text-gray-400 flex items-center">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Title', 'Type', 'Supplier', 'Region', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4">
                  <p className="font-sans text-sm font-medium text-gray-800">{l.name}</p>
                  <p className="font-sans text-xs text-gray-400">{new Date(l.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="font-sans text-xs bg-[#F7F5F2] px-2 py-1 text-gray-600">{TYPE_LABEL[l.kind] || l.kind}</span>
                </td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{l.supplierName}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-500">{l.region}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[l.status] || 'bg-gray-100 text-gray-500'}`}>{l.status}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    {l.status !== 'active' && (
                      <button onClick={() => setStatus(l, 'active')} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors">
                        <CheckCircle size={11} /> Publish
                      </button>
                    )}
                    {l.status === 'active' && (
                      <button onClick={() => setStatus(l, 'draft')} title="Unpublish (set to draft)" aria-label={`Unpublish ${l.name}`} className="p-1.5 text-gray-400 hover:text-[#C9A96E] transition-colors">
                        <Archive size={14} />
                      </button>
                    )}
                    <button onClick={() => remove(l)} title="Delete" aria-label={`Delete ${l.name}`} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-sans text-sm text-gray-400">
              {listings.length === 0 ? 'No listings yet — they appear here as suppliers publish them.' : 'No listings match your filters.'}
            </p>
          </div>
        )}
        {loading && (
          <div className="py-12 text-center">
            <p className="font-sans text-sm text-gray-400">Loading listings…</p>
          </div>
        )}
      </div>
    </div>
  )
}
