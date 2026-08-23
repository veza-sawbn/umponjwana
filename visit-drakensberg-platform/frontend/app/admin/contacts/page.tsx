'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw, Loader2, BookUser } from 'lucide-react'
import { getAllSupplierContacts, recomputeSupplierContacts, type AdminSupplierContact } from '@/lib/admin-supplier-contacts'
import { formatMoney } from '@/lib/allocation'

// Cross-supplier view — admin RLS allows reading every supplier's contacts
// (see vd_supplier_contacts's "Admins read all contacts" policy). Each
// supplier's own /supplier/contacts page can only ever see its own rows;
// this is the one place that legitimately sees across all of them.

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<AdminSupplierContact[]>([])
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)

  async function load() {
    setLoading(true)
    setContacts(await getAllSupplierContacts())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleRecompute() {
    setRecomputing(true)
    const { error } = await recomputeSupplierContacts()
    if (!error) await load()
    setRecomputing(false)
  }

  const suppliers = useMemo(() => [...new Set(contacts.map(c => c.supplierName))].sort(), [contacts])

  const filtered = useMemo(() => contacts.filter(c => {
    const haystack = `${c.name ?? ''} ${c.email ?? ''} ${c.phone ?? ''} ${c.supplierName}`.toLowerCase()
    const matchSearch = haystack.includes(search.toLowerCase())
    const matchSupplier = supplierFilter === 'all' || c.supplierName === supplierFilter
    return matchSearch && matchSupplier
  }), [contacts, search, supplierFilter])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Contacts</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Every supplier&apos;s contact list, across the whole platform. Each supplier only ever sees their own.</p>
        </div>
        <button onClick={handleRecompute} disabled={recomputing}
          className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50 shrink-0">
          {recomputing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {recomputing ? 'Recomputing…' : 'Recompute Contacts'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 sm:py-2 flex-1 sm:min-w-[220px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone or supplier…"
            className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" />
        </div>
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
          className="border border-gray-200 bg-white px-3 py-2.5 sm:py-2 font-sans text-sm text-gray-600 focus:outline-none focus:border-[#2d6a4f]">
          <option value="all">All Suppliers</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading contacts…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <BookUser size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No contacts yet</p>
          <p className="font-sans text-sm text-gray-400">Contacts appear automatically once suppliers have real bookings.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Guest', 'Contact', 'Supplier', 'Bookings', 'Total Billed', 'Last Booking'].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[#F7F5F2] transition-colors">
                  <td className="px-5 py-4 font-sans text-sm font-medium">{c.name || 'Guest'}</td>
                  <td className="px-5 py-4">
                    <div className="space-y-0.5">
                      {c.email && <p className="font-sans text-xs text-gray-500">{c.email}</p>}
                      {c.phone && <p className="font-sans text-xs text-gray-500">{c.phone}</p>}
                      {!c.email && !c.phone && <span className="font-sans text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-600">{c.supplierName}</td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-600">{c.bookingCount}</td>
                  <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(c.lifetimeSpend)}</td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(c.lastBookingAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
