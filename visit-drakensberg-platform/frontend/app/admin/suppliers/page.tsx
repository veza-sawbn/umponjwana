'use client'

import { useState } from 'react'
import { Search, CheckCircle, XCircle, PauseCircle, Eye } from 'lucide-react'

const SUPPLIERS = [
  { id: 's1', name: 'Mountain Retreats SA', contact: 'Johan Pretorius', email: 'johan@mountainretreats.co.za', type: 'Accommodation', listings: 3, status: 'approved', joined: '12 Jan 2026' },
  { id: 's2', name: 'Drakensberg Adventures', contact: 'Sipho Dlamini', email: 'sipho@bergadventures.co.za', type: 'Activity', listings: 5, status: 'approved', joined: '18 Jan 2026' },
  { id: 's3', name: 'Berg Cultural Tours', contact: 'Lerato Sithole', email: 'lerato@bergcultural.co.za', type: 'Experience', listings: 2, status: 'approved', joined: '25 Jan 2026' },
  { id: 's4', name: 'Ezemvelo KZN Wildlife', contact: 'Admin Office', email: 'bookings@ezemvelo.co.za', type: 'Accommodation', listings: 8, status: 'approved', joined: '1 Feb 2026' },
  { id: 's5', name: 'Berg Shuttles', contact: 'Jerome van Niekerk', email: 'jerome@bergshuttles.co.za', type: 'Shuttle', listings: 1, status: 'suspended', joined: '14 Feb 2026' },
  { id: 's6', name: 'Berg Escapes', contact: 'Nomvula Khumalo', email: 'nomvula@bergescapes.co.za', type: 'Accommodation', listings: 0, status: 'pending', joined: '21 Jun 2026' },
  { id: 's7', name: 'Sani Adventures', contact: 'Danie Botha', email: 'danie@saniadventures.co.za', type: 'Activity', listings: 0, status: 'pending', joined: '19 Jun 2026' },
  { id: 's8', name: 'Royal Berg Tours', contact: 'Ayanda Mthembu', email: 'ayanda@royalbergtours.co.za', type: 'Guided Tours', listings: 0, status: 'pending', joined: '17 Jun 2026' },
  { id: 's9', name: 'Champagne Glamping', contact: 'Priscilla Nel', email: 'priscilla@champagneglamp.co.za', type: 'Accommodation', listings: 0, status: 'pending', joined: '15 Jun 2026' },
]

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  suspended: 'bg-red-50 text-red-400',
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState(SUPPLIERS)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = suppliers.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || s.status === filter
    return matchSearch && matchFilter
  })

  function updateStatus(id: string, status: string) {
    setSuppliers(p => p.map(s => s.id === id ? { ...s, status } : s))
  }

  const counts = {
    all: suppliers.length,
    pending: suppliers.filter(s => s.status === 'pending').length,
    approved: suppliers.filter(s => s.status === 'approved').length,
    suspended: suppliers.filter(s => s.status === 'suspended').length,
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Suppliers</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {(['all', 'pending', 'approved', 'suspended'] as const).map(f => (
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

      {/* Search */}
      <div className="bg-white border border-gray-200 p-4 mb-6 flex items-center gap-2">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 font-sans text-sm focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Business', 'Contact', 'Type', 'Listings', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm shrink-0">
                      {s.name[0]}
                    </div>
                    <p className="font-sans text-sm font-medium">{s.name}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="font-sans text-sm">{s.contact}</p>
                  <p className="font-sans text-xs text-gray-400">{s.email}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="font-sans text-xs bg-[#F7F5F2] px-2 py-1 text-gray-600">{s.type}</span>
                </td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{s.listings}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                </td>
                <td className="px-5 py-4 font-sans text-sm text-gray-400">{s.joined}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <button title="View" className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors"><Eye size={14} /></button>
                    {s.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus(s.id, 'approved')}
                          className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors flex items-center gap-1"
                        >
                          <CheckCircle size={11} /> Approve
                        </button>
                        <button
                          onClick={() => updateStatus(s.id, 'suspended')}
                          className="px-2.5 py-1 border border-red-200 text-red-400 font-sans text-xs hover:bg-red-50 transition-colors flex items-center gap-1"
                        >
                          <XCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                    {s.status === 'approved' && (
                      <button
                        onClick={() => updateStatus(s.id, 'suspended')}
                        className="px-2.5 py-1 border border-gray-200 text-gray-500 font-sans text-xs hover:border-red-200 hover:text-red-400 transition-colors flex items-center gap-1"
                      >
                        <PauseCircle size={11} /> Suspend
                      </button>
                    )}
                    {s.status === 'suspended' && (
                      <button
                        onClick={() => updateStatus(s.id, 'approved')}
                        className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors"
                      >
                        Reinstate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
