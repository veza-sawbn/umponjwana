'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Mail, Phone, Calendar, RefreshCw, BookUser } from 'lucide-react'
import { getMyContacts, type SupplierContact } from '@/lib/supplier-contacts'
import { formatMoney } from '@/lib/allocation'

// Every customer who has actually booked with this supplier, automatically
// kept up to date — row-level security guarantees these are this supplier's
// own contacts only, no other supplier's. There's no way to add a contact
// by hand here: it only exists because a real booking created it.

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function SupplierContactsPage() {
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setContacts(await getMyContacts())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => contacts.filter(c => {
    const haystack = `${c.name ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  }), [contacts, search])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Supplier Console</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Contacts</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Every guest who has booked with you, kept up to date automatically.</p>
        </div>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors shrink-0">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-white px-3 py-2.5 sm:py-2 max-w-sm">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone…"
            className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading contacts…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <BookUser size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No contacts yet</p>
          <p className="font-sans text-sm text-gray-400">Once a guest completes a booking with you, they&apos;ll show up here automatically.</p>
        </div>
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {filtered.map(c => (
              <div key={c.id} className="p-4">
                <p className="font-sans text-sm font-medium">{c.name || 'Guest'}</p>
                {c.email && <p className="font-sans text-xs text-gray-400 mt-0.5">{c.email}</p>}
                {c.phone && <p className="font-sans text-xs text-gray-400">{c.phone}</p>}
                <div className="flex items-end justify-between gap-3 mt-3">
                  <p className="font-sans text-xs text-gray-500">{c.bookingCount} booking{c.bookingCount === 1 ? '' : 's'} · last {fmt(c.lastBookingAt)}</p>
                  <p className="font-display italic text-lg text-[#2d6a4f]">{formatMoney(c.lifetimeSpend)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Guest', 'Contact', 'First Booking', 'Last Booking', 'Bookings', 'Total Billed'].map(h => (
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
                        {c.email && <p className="font-sans text-xs text-gray-500 inline-flex items-center gap-1.5"><Mail size={11} className="text-gray-300" />{c.email}</p>}
                        {c.phone && <p className="font-sans text-xs text-gray-500 inline-flex items-center gap-1.5"><Phone size={11} className="text-gray-300" />{c.phone}</p>}
                        {!c.email && !c.phone && <span className="font-sans text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-sans text-xs text-gray-500 inline-flex items-center gap-1.5"><Calendar size={11} className="text-gray-300" />{fmt(c.firstBookingAt)}</td>
                    <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(c.lastBookingAt)}</td>
                    <td className="px-5 py-4 font-sans text-sm text-gray-600">{c.bookingCount}</td>
                    <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(c.lifetimeSpend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
