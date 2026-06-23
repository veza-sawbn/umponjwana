'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Pencil, Archive, Trash2, ChevronDown } from 'lucide-react'

const LISTINGS = [
  { id: 'l1', title: 'Cathedral Peak Mountain Lodge', type: 'accommodation', supplier: 'Mountain Retreats SA', region: 'Northern Berg', price: 1850, status: 'published', created: '12 Jan 2026' },
  { id: 'l2', title: 'Guided Rock Climbing Experience', type: 'activity', supplier: 'Drakensberg Adventures', region: 'Northern Berg', price: 750, status: 'published', created: '15 Jan 2026' },
  { id: 'l3', title: 'Tugela Falls Circuit', type: 'hike', supplier: 'Berg Trail Co.', region: 'Northern Berg', price: 580, status: 'published', created: '20 Jan 2026' },
  { id: 'l4', title: 'Tendele Tented Camp', type: 'accommodation', supplier: 'Wilderness Stays', region: 'Northern Berg', price: 2400, status: 'published', created: '3 Feb 2026' },
  { id: 'l5', title: "Giant's Castle Restcamp", type: 'accommodation', supplier: 'Ezemvelo KZN Wildlife', region: 'Central Berg', price: 680, status: 'published', created: '8 Feb 2026' },
  { id: 'l6', title: 'San Rock Art Full-Day Tour', type: 'experience', supplier: 'Berg Cultural Tours', region: 'Central Berg', price: 620, status: 'published', created: '14 Feb 2026' },
  { id: 'l7', title: 'Sani Pass 4x4 Experience', type: 'activity', supplier: 'Sani Adventures', region: 'Southern Berg', price: 1200, status: 'pending', created: '1 Jun 2026' },
  { id: 'l8', title: 'Champagne Valley Glamping', type: 'accommodation', supplier: 'Champagne Glamping', region: 'Central Berg', price: 1650, status: 'pending', created: '5 Jun 2026' },
  { id: 'l9', title: 'Berg Mountain Biking Trail', type: 'activity', supplier: 'Berg Adventures', region: 'Central Berg', price: 480, status: 'draft', created: '18 Jun 2026' },
  { id: 'l10', title: 'Drakensberg Photography Tour', type: 'experience', supplier: 'Berg Photo Safaris', region: 'Northern Berg', price: 950, status: 'archived', created: '2 Mar 2026' },
]

const TYPE_LABEL: Record<string, string> = {
  accommodation: 'Stay', activity: 'Activity', hike: 'Hike', experience: 'Experience', event: 'Event',
}

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  draft: 'bg-gray-100 text-gray-500',
  archived: 'bg-red-50 text-red-400',
}

export default function AdminListingsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [listings, setListings] = useState(LISTINGS)

  const filtered = listings.filter(l => {
    const matchSearch = l.title.toLowerCase().includes(search.toLowerCase()) || l.supplier.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || l.type === typeFilter
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  function publish(id: string) {
    setListings(p => p.map(l => l.id === id ? { ...l, status: 'published' } : l))
  }
  function archive(id: string) {
    setListings(p => p.map(l => l.id === id ? { ...l, status: 'archived' } : l))
  }
  function remove(id: string) {
    setListings(p => p.filter(l => l.id !== id))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Listings</h1>
        </div>
        <button className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">
          <Plus size={15} /> New Listing
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 p-4 mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search listings or suppliers…"
            className="flex-1 font-sans text-sm focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="accommodation">Accommodation</option>
          <option value="activity">Activity</option>
          <option value="hike">Hike</option>
          <option value="experience">Experience</option>
          <option value="event">Event</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="pending">Pending</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <span className="font-sans text-xs text-gray-400 flex items-center">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Title', 'Type', 'Supplier', 'Region', 'Price', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4">
                  <p className="font-sans text-sm font-medium text-gray-800">{l.title}</p>
                  <p className="font-sans text-xs text-gray-400">{l.created}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="font-sans text-xs bg-[#F7F5F2] px-2 py-1 text-gray-600">{TYPE_LABEL[l.type] || l.type}</span>
                </td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{l.supplier}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-500">{l.region}</td>
                <td className="px-5 py-4 font-display italic text-[#2d6a4f]">R {l.price.toLocaleString()}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <button title="Preview" className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors"><Eye size={14} /></button>
                    <button title="Edit" className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors"><Pencil size={14} /></button>
                    {l.status === 'pending' && (
                      <button onClick={() => publish(l.id)} className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors">Publish</button>
                    )}
                    {l.status !== 'archived' && (
                      <button onClick={() => archive(l.id)} title="Archive" className="p-1.5 text-gray-400 hover:text-[#C9A96E] transition-colors"><Archive size={14} /></button>
                    )}
                    <button onClick={() => remove(l.id)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-sans text-sm text-gray-400">No listings match your filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}
