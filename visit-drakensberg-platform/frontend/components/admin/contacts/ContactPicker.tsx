'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import {
  avatarColour, avatarText, contactDetail, contactLabel, groupContacts, searchContacts,
  type Contact,
} from '@/lib/contacts'

// Contact picker for the New Invoice form, modelled on the Wix contacts list:
// a "Search N contacts" box, All / Invoiced filter chips, an A–Z list with
// coloured initial avatars, and an "Add New Contact" button pinned to the
// bottom. Full-screen sheet on a phone, a dropdown panel from sm up.
//
// The book can run to thousands of rows (a full Wix export), so only the
// first PAGE rows of the current result are rendered; search narrows it.

const PAGE = 150

export function ContactAvatar({ contact, size = 36 }: { contact: Contact; size?: number }) {
  return (
    <span
      aria-hidden
      className="shrink-0 inline-flex items-center justify-center rounded-full text-white font-sans font-medium"
      style={{ width: size, height: size, background: avatarColour(contact.id), fontSize: size * 0.38 }}
    >
      {avatarText(contact)}
    </span>
  )
}

export default function ContactPicker({ contacts, selected, onSelect, onAddNew, loading }: {
  contacts: Contact[]
  selected: Contact | null
  onSelect: (c: Contact) => void
  onAddNew: () => void
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'invoiced'>('all')
  const [limit, setLimit] = useState(PAGE)
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const invoicedCount = useMemo(() => contacts.filter(c => c.invoiceCount > 0).length, [contacts])
  const results = useMemo(() => {
    const base = filter === 'invoiced' ? contacts.filter(c => c.invoiceCount > 0) : contacts
    return searchContacts(base, query)
  }, [contacts, filter, query])
  const groups = useMemo(() => groupContacts(results).reduce<{ letter: string; contacts: Contact[] }[]>((acc, g) => {
    // Cut the grouped list at `limit` rows in total.
    const used = acc.reduce((n, a) => n + a.contacts.length, 0)
    if (used >= limit) return acc
    acc.push({ letter: g.letter, contacts: g.contacts.slice(0, limit - used) })
    return acc
  }, []), [results, limit])

  useEffect(() => { setLimit(PAGE) }, [query, filter])

  useEffect(() => {
    if (!open) return
    // Focus the search box, but not on a phone, where the keyboard would
    // cover half the list before anyone asked for it.
    if (window.matchMedia('(min-width: 640px)').matches) searchRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  function choose(c: Contact) {
    onSelect(c)
    setOpen(false)
    setQuery('')
  }

  const chip = (id: 'all' | 'invoiced', label: string, count: number) => (
    <button type="button" onClick={() => setFilter(id)}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-sans text-xs whitespace-nowrap transition-colors ${
        filter === id ? 'border-[#2d6a4f] text-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-300 text-gray-600 hover:border-gray-400'
      }`}>
      {label} <span className="text-gray-400">{count.toLocaleString('en-ZA')}</span>
    </button>
  )

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="w-full flex items-center gap-3 border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-gray-300 focus:outline-none focus:border-[#2d6a4f]">
        {selected ? (
          <>
            <ContactAvatar contact={selected} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block font-sans text-sm text-black truncate">{contactLabel(selected)}</span>
              {contactDetail(selected) && <span className="block font-sans text-xs text-gray-400 truncate">{contactDetail(selected)}</span>}
            </span>
            <span className="font-sans text-xs text-[#2d6a4f] shrink-0">Change</span>
          </>
        ) : (
          <>
            <Search size={16} className="text-gray-400 shrink-0" />
            <span className="flex-1 font-sans text-base sm:text-sm text-gray-400">
              {loading ? 'Loading contacts…' : `Select a contact (${contacts.length.toLocaleString('en-ZA')})`}
            </span>
            <ChevronDown size={16} className="text-gray-400 shrink-0" />
          </>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a contact"
          className="fixed inset-0 z-[60] bg-white flex flex-col sm:absolute sm:inset-auto sm:left-0 sm:right-0 sm:top-full sm:mt-1 sm:max-h-[460px] sm:border sm:border-gray-200 sm:shadow-xl">
          {/* Phone-only header, mirroring a native contacts screen. */}
          <div className="sm:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 -ml-1 text-gray-600"><X size={20} /></button>
            <p className="font-sans text-sm font-medium text-black">Contacts</p>
            <button type="button" onClick={() => { setOpen(false); onAddNew() }} aria-label="Add new contact"
              className="w-9 h-9 rounded-full bg-gray-100 inline-flex items-center justify-center text-black"><Plus size={18} /></button>
          </div>

          <div className="shrink-0 flex gap-2 px-4 pt-3 overflow-x-auto">
            {chip('all', 'All Contacts', contacts.length)}
            {chip('invoiced', 'Invoiced', invoicedCount)}
          </div>

          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <Search size={18} className="text-gray-500 shrink-0" />
            <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${contacts.length.toLocaleString('en-ZA')} contacts`}
              className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none bg-transparent" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-gray-400"><X size={16} /></button>}
          </div>

          <div className="flex-1 overflow-y-auto" role="listbox">
            {results.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="font-sans text-sm text-gray-500">{query ? `No contacts match “${query}”.` : 'No contacts yet.'}</p>
                <button type="button" onClick={() => { setOpen(false); onAddNew() }}
                  className="mt-3 font-sans text-sm text-[#2d6a4f] underline underline-offset-2">Add a new contact</button>
              </div>
            ) : (
              <>
                {groups.map(g => (
                  <div key={g.letter}>
                    <p className="sticky top-0 bg-[#F7F5F2] px-4 py-1 font-sans text-xs font-medium text-gray-500">{g.letter}</p>
                    {g.contacts.map(c => {
                      const detail = contactDetail(c)
                      const isSelected = selected?.id === c.id
                      return (
                        <button type="button" key={c.id} role="option" aria-selected={isSelected} onClick={() => choose(c)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-50 hover:bg-[#F7F5F2] ${isSelected ? 'bg-[#2d6a4f]/5' : ''}`}>
                          <ContactAvatar contact={c} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-sans text-sm font-medium text-black truncate">{contactLabel(c)}</span>
                            {detail && <span className="block font-sans text-xs text-gray-400 truncate">{detail}</span>}
                          </span>
                          {c.invoiceCount > 0 && (
                            <span className="shrink-0 font-sans text-[10px] text-gray-400">
                              {c.invoiceCount} invoice{c.invoiceCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {c.userId && <span className="shrink-0 font-sans text-[10px] uppercase tracking-wider text-[#2d6a4f] bg-[#2d6a4f]/10 px-1.5 py-0.5">Account</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {results.length > limit && (
                  <button type="button" onClick={() => setLimit(l => l + PAGE)}
                    className="w-full py-3 font-sans text-xs text-gray-500 hover:text-black">
                    Showing {limit.toLocaleString('en-ZA')} of {results.length.toLocaleString('en-ZA')}. Show more, or keep typing to narrow it down.
                  </button>
                )}
              </>
            )}
          </div>

          <button type="button" onClick={() => { setOpen(false); onAddNew() }}
            className="shrink-0 flex items-center justify-center gap-3 border-t border-gray-200 px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] font-sans text-sm font-medium text-[#2d6a4f] hover:bg-[#F7F5F2]">
            <span className="w-6 h-6 rounded-full bg-[#2d6a4f] text-white inline-flex items-center justify-center"><Plus size={14} /></span>
            Add New Contact
          </button>
        </div>
      )}
    </div>
  )
}
