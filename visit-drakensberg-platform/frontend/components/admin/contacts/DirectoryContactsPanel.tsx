'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, RefreshCw, Loader2, Upload, X, FileUp, ChevronDown, ChevronRight,
  Mail, Phone, Globe, MapPin, Building2, Send, CalendarClock,
} from 'lucide-react'
import {
  getDirectoryContacts, getContactSegments, importDirectoryContacts,
  recomputeContactSegments, setDirectoryOutreach, OUTREACH_STATUSES,
  type DirectoryContact, type ContactSegment, type DirectoryOutreachStatus,
} from '@/lib/directory-contacts'
import { isDirectoryContactsCsv, parseDirectoryContactsCsv, type DirectoryContactRow } from '@/lib/csv'

// The platform's own outreach book: establishments we want to recruit onto
// the platform, segmented by where the listing came from, what kind of place
// it is, which region it's in, how reachable it is, and where the
// conversation has got to. Segment membership is computed
// (vd_recompute_contact_segments) exactly like the customer side — the
// filter chips below read that membership, they never assign it.

const STATUS_STYLE: Record<DirectoryOutreachStatus, string> = {
  not_contacted:   'bg-gray-100 text-gray-500',
  contacted:       'bg-blue-50 text-blue-600',
  in_conversation: 'bg-[#C9A96E]/20 text-[#8B6914]',
  converted:       'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  declined:        'bg-red-50 text-red-600',
  unreachable:     'bg-gray-100 text-gray-400',
}

const GROUP_ORDER = ['Reachability', 'Outreach', 'Sector', 'Source', 'Region']

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<DirectoryContactRow[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    file.text().then(text => {
      if (!isDirectoryContactsCsv(text)) {
        setRows([])
        setError('That looks like a plain address-book CSV. This importer needs the master directory export — a header row with Establishment plus Source Site(s) or Source Listing URL(s).')
        return
      }
      const parsed = parseDirectoryContactsCsv(text)
      if (parsed.length === 0) {
        setRows([])
        setError('No usable rows found — every row needs an establishment name.')
        return
      }
      setRows(parsed)
      setFileName(file.name)
    }).catch(() => setError('Could not read that file.'))
  }

  async function handleImport() {
    if (rows.length === 0) return
    setImporting(true)
    setError(null)
    const { error: err } = await importDirectoryContacts(rows)
    setImporting(false)
    if (err) { setError(err); return }
    onImported()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display italic text-xl">Import Directory Contacts</h2>
            <p className="font-sans text-sm text-gray-500 mt-1">
              Load or refresh the master establishment list. Outreach progress already recorded is never overwritten.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 bg-[#F7F5F2] p-8 text-center font-sans text-sm text-gray-500 hover:border-[#2d6a4f] transition-colors mb-1">
          <Upload size={24} className="mx-auto mb-2 text-gray-300" />
          {fileName || 'Choose the master contacts .csv'}
        </button>
        <p className="font-sans text-[11px] text-gray-400 mb-4">
          Establishment, Source Site(s), Category, Region, Email, Phone, Website, Social, Address, Contact Status,
          Outreach Status, Owner, Follow-up Date and notes are all read. Multi-value cells may be separated by
          <span className="font-mono"> | </span> or <span className="font-mono">;</span>. Rows are matched on the
          establishment name, so re-importing updates in place.
        </p>

        {rows.length > 0 && (
          <div className="border border-gray-200 bg-[#F7F5F2] px-4 py-3 mb-4">
            <p className="font-sans text-sm text-gray-700">
              <FileUp size={13} className="inline -mt-0.5 mr-1.5 text-[#2d6a4f]" />
              {rows.length} establishment{rows.length === 1 ? '' : 's'} ready
              <span className="text-gray-400"> · {rows.filter(r => r.emails.length).length} with email</span>
            </p>
            <p className="font-sans text-xs text-gray-400 mt-1 truncate">
              {rows.slice(0, 3).map(r => r.establishment).join(' · ')}{rows.length > 3 ? ` · +${rows.length - 3} more` : ''}
            </p>
          </div>
        )}

        {error && <p className="font-sans text-xs text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-gray-300">
            Cancel
          </button>
          <button onClick={handleImport} disabled={rows.length === 0 || importing}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm disabled:opacity-40">
            {importing ? <Loader2 size={14} className="animate-spin" /> : null}
            {importing ? 'Importing…' : `Import${rows.length ? ` ${rows.length}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The expanded row: everything the compile captured that the table itself
 *  has no room for, plus the outreach fields that aren't a one-click change. */
function ContactDetail({ contact, onSaved }: { contact: DirectoryContact; onSaved: () => void }) {
  const [owner, setOwner] = useState(contact.owner ?? '')
  const [followUp, setFollowUp] = useState(contact.followUpDate ?? '')
  const [lastContacted, setLastContacted] = useState(contact.lastContacted ?? '')
  const [notes, setNotes] = useState(contact.outreachNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    owner !== (contact.owner ?? '') ||
    followUp !== (contact.followUpDate ?? '') ||
    lastContacted !== (contact.lastContacted ?? '') ||
    notes !== contact.outreachNotes

  async function save() {
    setSaving(true)
    setError(null)
    const { error: err } = await setDirectoryOutreach(contact.id, {
      owner: owner.trim() || null,
      followUpDate: followUp || null,
      lastContacted: lastContacted || null,
      outreachNotes: notes,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onSaved()
  }

  const links = [
    ...contact.websites.map(u => ({ label: 'Website', url: u })),
    ...contact.socials.map(u => ({ label: 'Social', url: u })),
    ...(contact.bookingUrl ? [{ label: 'Booking', url: contact.bookingUrl }] : []),
    ...contact.sourceListingUrls.map(u => ({ label: 'Listing', url: u })),
  ]

  return (
    <div className="bg-[#F7F5F2] border-t border-gray-100 px-5 py-5 grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        {contact.address && (
          <p className="font-sans text-xs text-gray-600 flex gap-2">
            <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" /> {contact.address}
          </p>
        )}
        {contact.emails.length > 1 && (
          <p className="font-sans text-xs text-gray-600">Also: {contact.emails.slice(1).join(', ')}</p>
        )}
        {contact.phones.length > 1 && (
          <p className="font-sans text-xs text-gray-600">Also: {contact.phones.slice(1).join(', ')}</p>
        )}
        {contact.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {contact.categories.map(c => (
              <span key={c} className="font-sans text-[10px] px-2 py-0.5 bg-white border border-gray-200 text-gray-500">{c}</span>
            ))}
          </div>
        )}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {links.map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                className="font-sans text-xs text-[#2d6a4f] hover:underline break-all">{l.label} ↗</a>
            ))}
          </div>
        )}
        {contact.dataNotes && (
          <p className="font-sans text-xs text-gray-400 italic border-l-2 border-gray-200 pl-3">{contact.dataNotes}</p>
        )}
        <p className="font-sans text-[11px] text-gray-400">
          Verified {fmtDate(contact.verifiedOn)} · from {contact.sourceSites.join(', ') || 'unknown source'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400 mb-1">Owner</span>
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Who's handling this"
              className="w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
          </label>
          <label className="block">
            <span className="block font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400 mb-1">Last contacted</span>
            <input type="date" value={lastContacted} onChange={e => setLastContacted(e.target.value)}
              className="w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
          </label>
        </div>
        <label className="block">
          <span className="block font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400 mb-1">Follow-up date</span>
          <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)}
            className="w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
        </label>
        <label className="block">
          <span className="block font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400 mb-1">Outreach notes</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="What was said, what's next…"
            className="w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
        </label>
        {error && <p className="font-sans text-xs text-red-600">{error}</p>}
        <button onClick={save} disabled={!dirty || saving}
          className="inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save outreach'}
        </button>
      </div>
    </div>
  )
}

export default function DirectoryContactsPanel() {
  const [contacts, setContacts] = useState<DirectoryContact[]>([])
  const [segments, setSegments] = useState<ContactSegment[]>([])
  const [membersBySegment, setMembersBySegment] = useState<Map<string, Set<string>>>(new Map())
  const [activeSegments, setActiveSegments] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [c, s] = await Promise.all([getDirectoryContacts(), getContactSegments()])
    setContacts(c)
    setSegments(s.segments)
    setMembersBySegment(s.membersBySegment)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleRecompute() {
    setRecomputing(true)
    const { error } = await recomputeContactSegments()
    if (!error) await load()
    setRecomputing(false)
  }

  async function handleStatusChange(contact: DirectoryContact, status: DirectoryOutreachStatus) {
    setSavingStatus(contact.id)
    const { error } = await setDirectoryOutreach(contact.id, { outreachStatus: status })
    if (!error) await load()
    setSavingStatus(null)
  }

  function toggleSegment(id: string) {
    setActiveSegments(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  // Several chips selected narrows rather than widens — "Clarens" plus "Has
  // Email" is the list you'd actually send a campaign to.
  const filtered = useMemo(() => contacts.filter(c => {
    for (const segmentId of activeSegments) {
      if (!membersBySegment.get(segmentId)?.has(c.id)) return false
    }
    if (!search.trim()) return true
    const haystack = [
      c.establishment, c.email, c.phone, c.address, c.contactPerson,
      ...c.regions, ...c.categories, ...c.sourceSites,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search.trim().toLowerCase())
  }), [contacts, activeSegments, membersBySegment, search])

  const groupedSegments = useMemo(() => {
    const groups = new Map<string, ContactSegment[]>()
    for (const s of segments) {
      groups.set(s.group, [...(groups.get(s.group) ?? []), s])
    }
    return [...groups.entries()].sort(
      (a, b) => (GROUP_ORDER.indexOf(a[0]) + 1 || 99) - (GROUP_ORDER.indexOf(b[0]) + 1 || 99),
    )
  }, [segments])

  const stats = useMemo(() => ({
    total: contacts.length,
    withEmail: contacts.filter(c => c.email).length,
    inPlay: contacts.filter(c => c.outreachStatus === 'contacted' || c.outreachStatus === 'in_conversation').length,
    converted: contacts.filter(c => c.outreachStatus === 'converted').length,
  }), [contacts])

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <p className="font-sans text-sm text-gray-500 max-w-2xl">
          Establishments compiled from the regional directories — the list we work through to get them onto the
          platform. Segments are computed from the data itself; combine chips to narrow to an outreach list.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={handleRecompute} disabled={recomputing}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50">
            {recomputing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {recomputing ? 'Recomputing…' : 'Recompute Segments'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Establishments', value: stats.total, icon: Building2 },
          { label: 'Reachable by Email', value: stats.withEmail, icon: Mail },
          { label: 'Outreach in Play', value: stats.inPlay, icon: Send },
          { label: 'Converted', value: stats.converted, icon: CalendarClock },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <div className="bg-[#2d6a4f]/8 w-8 h-8 flex items-center justify-center mb-3"><Icon size={15} className="text-[#2d6a4f]" /></div>
              <p className="font-display italic text-2xl text-[#000000]">{loading ? '…' : s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {groupedSegments.length > 0 && (
        <div className="bg-white border border-gray-200 p-4 mb-6 space-y-3">
          {groupedSegments.map(([groupName, groupSegments]) => (
            <div key={groupName} className="flex flex-col sm:flex-row sm:items-baseline gap-2">
              <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 sm:w-28 shrink-0">{groupName}</p>
              <div className="flex flex-wrap gap-1.5">
                {groupSegments.map(s => {
                  const active = activeSegments.includes(s.id)
                  return (
                    <button key={s.id} onClick={() => toggleSegment(s.id)} title={s.description}
                      className={`font-sans text-xs px-2.5 py-1 border transition-colors ${
                        active
                          ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-[#2d6a4f]'
                      }`}>
                      {s.name} <span className={active ? 'text-white/70' : 'text-gray-400'}>({s.count})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {activeSegments.length > 0 && (
            <button onClick={() => setActiveSegments([])}
              className="font-sans text-xs text-gray-400 hover:text-[#2d6a4f] underline">
              Clear {activeSegments.length} segment filter{activeSegments.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 sm:py-2 flex-1">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search establishment, email, phone, region or category…"
            className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" />
        </div>
        <p className="font-sans text-sm text-gray-400 self-center shrink-0">
          {loading ? '' : `${filtered.length} of ${contacts.length}`}
        </p>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading directory…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Building2 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">
            {contacts.length === 0 ? 'No directory contacts yet' : 'Nothing matches those filters'}
          </p>
          <p className="font-sans text-sm text-gray-400">
            {contacts.length === 0
              ? 'Import the master establishment CSV to start working the list.'
              : 'Clear a segment chip or the search to widen the list.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-8" />
                {['Establishment', 'Contact', 'Where', 'Source', 'Outreach', 'Follow-up'].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => {
                const open = expanded === c.id
                return (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-[#F7F5F2] transition-colors align-top">
                      <td className="pl-3 py-4">
                        <button onClick={() => setExpanded(open ? null : c.id)}
                          aria-label={open ? 'Collapse' : 'Expand'} className="text-gray-300 hover:text-[#2d6a4f]">
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-sans text-sm font-medium text-[#000000]">{c.establishment}</p>
                        <p className="font-sans text-xs text-gray-400 mt-0.5">{c.sectors.join(' · ')}</p>
                        {c.contactPerson && <p className="font-sans text-xs text-gray-500 mt-0.5">{c.contactPerson}</p>}
                      </td>
                      <td className="px-5 py-4 space-y-0.5">
                        {c.email && (
                          <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
                            <Mail size={11} className="text-gray-300 shrink-0" /> {c.email}
                          </p>
                        )}
                        {c.phone && (
                          <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
                            <Phone size={11} className="text-gray-300 shrink-0" /> {c.phone}
                          </p>
                        )}
                        {!c.email && !c.phone && c.websites.length > 0 && (
                          <p className="font-sans text-xs text-gray-400 flex items-center gap-1.5">
                            <Globe size={11} className="text-gray-300 shrink-0" /> web only
                          </p>
                        )}
                        {!c.email && !c.phone && c.websites.length === 0 && (
                          <span className="font-sans text-xs text-gray-300">none published</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-sans text-xs text-gray-500">{c.regions.join(', ') || '—'}</td>
                      <td className="px-5 py-4 font-sans text-xs text-gray-500">{c.sourceSites.join(', ') || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <select value={c.outreachStatus} disabled={savingStatus === c.id}
                            onChange={e => handleStatusChange(c, e.target.value as DirectoryOutreachStatus)}
                            className={`font-sans text-[10px] tracking-[0.08em] uppercase px-2 py-1 border-0 focus:outline-none disabled:opacity-50 ${STATUS_STYLE[c.outreachStatus]}`}>
                            {OUTREACH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                          {savingStatus === c.id && <Loader2 size={12} className="animate-spin text-gray-300" />}
                        </div>
                        {c.owner && <p className="font-sans text-[11px] text-gray-400 mt-1">{c.owner}</p>}
                      </td>
                      <td className="px-5 py-4 font-sans text-xs text-gray-500">{fmtDate(c.followUpDate)}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <ContactDetail contact={c} onSaved={load} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={load} />}
    </div>
  )
}
