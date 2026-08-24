'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, RefreshCw, Loader2, BookUser, Upload, X, FileUp } from 'lucide-react'
import {
  getAllSupplierContacts, recomputeSupplierContacts, importSupplierContacts,
  type AdminSupplierContact,
} from '@/lib/admin-supplier-contacts'
import { getAdminSuppliers, type AdminSupplier } from '@/lib/admin-supabase'
import { parseContactsCsv, type CsvContactRow } from '@/lib/csv'
import { formatMoney } from '@/lib/allocation'

// Cross-supplier view — admin RLS allows reading every supplier's contacts
// (see vd_supplier_contacts's "Admins read all contacts" policy). Each
// supplier's own /supplier/contacts page can only ever see its own rows;
// this is the one place that legitimately sees across all of them.

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function ImportModal({ suppliers, onClose, onImported }: {
  suppliers: AdminSupplier[]
  onClose: () => void
  onImported: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<CsvContactRow[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    file.text().then(text => {
      const parsed = parseContactsCsv(text)
      if (parsed.length === 0) {
        setError('No usable rows found — the CSV needs a header row with a name (or first/last name) and/or email column.')
        setRows([])
      } else {
        setRows(parsed)
      }
      setFileName(file.name)
    }).catch(() => setError('Could not read that file.'))
  }

  async function handleImport() {
    if (!supplierId || rows.length === 0) return
    setImporting(true)
    setError(null)
    const { imported, error: err } = await importSupplierContacts(supplierId, rows)
    setImporting(false)
    if (err) { setError(err); return }
    onImported()
    onClose()
    void imported
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display italic text-xl">Import Contacts</h2>
            <p className="font-sans text-sm text-gray-500 mt-1">Bulk-add a contact list to one supplier&apos;s address book from a CSV file.</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        <label className="block font-sans text-xs tracking-[0.08em] uppercase text-gray-400 mb-1.5">Supplier</label>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
          className="w-full border border-gray-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-700 focus:outline-none focus:border-[#2d6a4f] mb-5">
          <option value="">Choose a supplier…</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.business_name}</option>)}
        </select>

        <label className="block font-sans text-xs tracking-[0.08em] uppercase text-gray-400 mb-1.5">CSV file</label>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 bg-[#F7F5F2] p-8 text-center font-sans text-sm text-gray-500 hover:border-[#2d6a4f] transition-colors mb-1">
          <Upload size={24} className="mx-auto mb-2 text-gray-300" />
          {fileName || 'Choose a .csv file — needs a name and/or email column'}
        </button>
        <p className="font-sans text-[11px] text-gray-400 mb-4">
          Recognised columns: name (or First Name/Last Name), email, phone — any order, case-insensitive.
          Exports with numbered columns like Email 1/Email 2 (e.g. Wix) work too.
        </p>

        {rows.length > 0 && (
          <div className="border border-gray-200 bg-[#F7F5F2] px-4 py-3 mb-4">
            <p className="font-sans text-sm text-gray-700">
              <FileUp size={13} className="inline -mt-0.5 mr-1.5 text-[#2d6a4f]" />
              {rows.length} contact{rows.length === 1 ? '' : 's'} ready to import
            </p>
            <p className="font-sans text-xs text-gray-400 mt-1 truncate">
              {rows.slice(0, 3).map(r => r.name || r.email).join(' · ')}{rows.length > 3 ? ` · +${rows.length - 3} more` : ''}
            </p>
          </div>
        )}

        {error && <p className="font-sans text-xs text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-gray-300">
            Cancel
          </button>
          <button onClick={handleImport} disabled={!supplierId || rows.length === 0 || importing}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm disabled:opacity-40">
            {importing ? <Loader2 size={14} className="animate-spin" /> : null}
            {importing ? 'Importing…' : `Import${rows.length ? ` ${rows.length}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<AdminSupplierContact[]>([])
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([])
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [showImport, setShowImport] = useState(false)

  async function load() {
    setLoading(true)
    const [c, s] = await Promise.all([getAllSupplierContacts(), getAdminSuppliers()])
    setContacts(c)
    setSuppliers(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleRecompute() {
    setRecomputing(true)
    const { error } = await recomputeSupplierContacts()
    if (!error) await load()
    setRecomputing(false)
  }

  const supplierNames = useMemo(() => [...new Set(contacts.map(c => c.supplierName))].sort(), [contacts])

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
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={handleRecompute} disabled={recomputing}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50">
            {recomputing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {recomputing ? 'Recomputing…' : 'Recompute Contacts'}
          </button>
        </div>
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
          {supplierNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading contacts…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <BookUser size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No contacts yet</p>
          <p className="font-sans text-sm text-gray-400">Contacts appear automatically once suppliers have real bookings, or once you import a list.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Guest', 'Contact', 'Supplier', 'Source', 'Bookings', 'Total Billed', 'Last Booking'].map(h => (
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
                  <td className="px-5 py-4">
                    <span className={`inline-block font-sans text-[10px] tracking-[0.08em] uppercase px-2 py-1 ${
                      c.source === 'booking' ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {c.source === 'booking' ? 'Booking' : c.source === 'imported' ? 'Imported' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-600">{c.bookingCount}</td>
                  <td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(c.lifetimeSpend)}</td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(c.lastBookingAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <ImportModal suppliers={suppliers} onClose={() => setShowImport(false)} onImported={load} />
      )}
    </div>
  )
}
