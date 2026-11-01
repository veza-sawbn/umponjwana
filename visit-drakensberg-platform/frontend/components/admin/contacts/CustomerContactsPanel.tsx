'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, RefreshCw, Loader2, Upload, X, FileUp, Plus, Users } from 'lucide-react'
import {
  getContacts, saveContact, importContacts, searchContacts, groupContacts, contactLabel, contactDetail,
  SOURCE_LABEL, type Contact,
} from '@/lib/contacts'
import { parseContactsCsv, type CsvContactRow } from '@/lib/csv'
import { ContactAvatar } from './ContactPicker'

// The platform's own customer contact book (vd_contacts): the Wix import,
// registered accounts, everyone who has been invoiced (added automatically
// when the invoice is generated) and anyone added here. The same list the
// New Invoice form picks from.

const PAGE = 200

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<CsvContactRow[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    file.text().then(text => {
      const parsed = parseContactsCsv(text, { keepPhoneOnly: true })
      setRows(parsed)
      setFileName(file.name)
      if (parsed.length === 0) setError('No usable rows found. The CSV needs a header row with a name, email or phone column.')
    }).catch(() => setError('Could not read that file.'))
  }

  async function handleImport() {
    if (rows.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const n = await importContacts(rows)
      toast.success(`${n.toLocaleString('en-ZA')} contact${n === 1 ? '' : 's'} imported.`)
      onImported()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally { setImporting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display italic text-xl">Import Contacts</h2>
            <p className="font-sans text-sm text-gray-500 mt-1">
              Load a contact export, such as Wix&apos;s (Contacts → More Actions → Export). Contacts already in the
              book are matched on email, or phone when there is no email, and only their blank details are filled in.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 bg-[#F7F5F2] p-8 text-center font-sans text-sm text-gray-500 hover:border-[#2d6a4f] transition-colors mb-1">
          <Upload size={24} className="mx-auto mb-2 text-gray-300" />
          {fileName || 'Choose a .csv file'}
        </button>
        <p className="font-sans text-[11px] text-gray-400 mb-4">
          Recognised columns: name (or First Name/Last Name), email, phone, in any order. Wix&apos;s numbered
          Email 1/Phone 1 columns work, and contacts with only a phone number are kept.
        </p>

        {rows.length > 0 && (
          <div className="border border-gray-200 bg-[#F7F5F2] px-4 py-3 mb-4">
            <p className="font-sans text-sm text-gray-700">
              <FileUp size={13} className="inline -mt-0.5 mr-1.5 text-[#2d6a4f]" />
              {rows.length.toLocaleString('en-ZA')} contact{rows.length === 1 ? '' : 's'} ready
              <span className="text-gray-400"> · {rows.filter(r => r.email).length.toLocaleString('en-ZA')} with email</span>
            </p>
            <p className="font-sans text-xs text-gray-400 mt-1 truncate">
              {rows.slice(0, 3).map(r => r.name || r.email || r.phone).join(' · ')}{rows.length > 3 ? ` · +${rows.length - 3} more` : ''}
            </p>
          </div>
        )}

        {error && <p className="font-sans text-xs text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-gray-300">Cancel</button>
          <button onClick={handleImport} disabled={rows.length === 0 || importing}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm disabled:opacity-40">
            {importing ? <Loader2 size={14} className="animate-spin" /> : null}
            {importing ? 'Importing…' : `Import${rows.length ? ` ${rows.length.toLocaleString('en-ZA')}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await saveContact({ name: name.trim(), email: email.trim(), phone: phone.trim() })
      toast.success('Contact saved.')
      onSaved(); onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the contact')
    } finally { setSaving(false) }
  }

  const input = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-base sm:text-sm focus:outline-none focus:border-[#2d6a4f]'
  const label = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <h2 className="font-display italic text-xl">Add New Contact</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>
        <div className="space-y-3 mb-5">
          <div><label className={label}>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={input} /></div>
          <div><label className={label}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className={input} /></div>
          <div><label className={label}>Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 82 000 0000" className={input} /></div>
          <p className="font-sans text-[11px] text-gray-400">A name, and an email or phone number. An existing contact with the same email is updated instead.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-gray-300">Cancel</button>
          <button onClick={save} disabled={saving || !name.trim() || (!email.trim() && !phone.trim())}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Contact
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CustomerContactsPanel() {
  const [contacts, setContacts] = useState<Contact[] | null>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'invoiced' | 'imported' | 'account'>('all')
  const [limit, setLimit] = useState(PAGE)
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    setContacts(await getContacts())
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setLimit(PAGE) }, [search, filter])

  const all = useMemo(() => contacts ?? [], [contacts])
  const counts = useMemo(() => ({
    all: all.length,
    invoiced: all.filter(c => c.invoiceCount > 0).length,
    imported: all.filter(c => c.sources.includes('imported')).length,
    account: all.filter(c => !!c.userId).length,
  }), [all])

  const results = useMemo(() => {
    const base = all.filter(c =>
      filter === 'all' ? true
        : filter === 'invoiced' ? c.invoiceCount > 0
          : filter === 'imported' ? c.sources.includes('imported')
            : !!c.userId)
    return groupContacts(searchContacts(base, search)).flatMap(g => g.contacts)
  }, [all, filter, search])

  const chips: [typeof filter, string][] = [['all', 'All Contacts'], ['invoiced', 'Invoiced'], ['imported', 'Imported'], ['account', 'Registered']]

  if (!loading && contacts === null) {
    return (
      <div className="bg-white border border-gray-200 p-12 text-center">
        <p className="font-display italic text-2xl text-gray-300 mb-2">Contact book not set up yet</p>
        <p className="font-sans text-sm text-gray-400">Apply the 20261031_platform_contacts.sql migration to create it.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <p className="font-sans text-sm text-gray-500 max-w-2xl">
          Everyone you can invoice: your Wix contacts, registered accounts, and every customer an invoice has been
          generated for, added automatically. This is the list the New Invoice form picks from.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-3 sm:py-2 font-sans text-sm">
            <Plus size={14} /> Add Contact
          </button>
          <button onClick={load} aria-label="Refresh" className="border border-gray-200 px-3 text-gray-500 hover:text-[#2d6a4f]">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3 overflow-x-auto">
        {chips.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-sans text-sm whitespace-nowrap ${
              filter === id ? 'border-[#2d6a4f] text-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}>
            {label} <span className="text-gray-400">{counts[id].toLocaleString('en-ZA')}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 mb-4">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${counts.all.toLocaleString('en-ZA')} contacts`}
          className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" />
      </div>

      {loading && all.length === 0 ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading contacts…</p>
      ) : results.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Users size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No contacts found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Contact', 'Phone', 'Source', 'Invoices', 'Last Invoiced'].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.slice(0, limit).map(c => (
                <tr key={c.id} className="hover:bg-[#F7F5F2] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ContactAvatar contact={c} size={32} />
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-medium text-black truncate">{contactLabel(c)}</p>
                        <p className="font-sans text-xs text-gray-400 truncate">{c.email || contactDetail(c) || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-sans text-xs text-gray-500">{c.phone || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.sources.map(s => (
                        <span key={s} className="font-sans text-[10px] tracking-[0.08em] uppercase px-2 py-0.5 bg-gray-100 text-gray-500">
                          {SOURCE_LABEL[s] ?? s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-sans text-sm text-gray-600">{c.invoiceCount || '—'}</td>
                  <td className="px-5 py-3 font-sans text-xs text-gray-500">{fmt(c.lastInvoicedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > limit && (
            <button onClick={() => setLimit(l => l + PAGE)} className="w-full py-3 border-t border-gray-100 font-sans text-xs text-gray-500 hover:text-black">
              Showing {limit.toLocaleString('en-ZA')} of {results.length.toLocaleString('en-ZA')}. Show more
            </button>
          )}
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={load} />}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </div>
  )
}
