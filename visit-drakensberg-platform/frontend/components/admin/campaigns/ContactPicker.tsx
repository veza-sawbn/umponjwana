'use client'

import { useMemo, useState } from 'react'
import { Search, X, Check } from 'lucide-react'
import type { CampaignContact } from '@/lib/email-campaigns-admin'
import type { SegmentCount } from '@/lib/customers-admin'

const inputClass = 'w-full bg-white border border-gray-200 px-3 py-2 font-sans text-sm text-[#000000] placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] transition-colors'

/** Rows rendered at once. The list filters client-side, so this only caps
 *  DOM size; search narrows to anyone in the full list. */
const VISIBLE_LIMIT = 200

/**
 * Hand-pick campaign recipients from the marketing-consented customer list.
 * Selection lives with the parent (it's saved on the campaign); this only
 * owns the search/filter state.
 */
export default function ContactPicker({
  contacts, segments, selected, onChange, disabled,
}: {
  contacts: CampaignContact[]
  segments: SegmentCount[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const byId = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts.filter(c => {
      if (showSelectedOnly && !selectedSet.has(c.id)) return false
      if (segmentFilter && !c.segmentIds.includes(segmentFilter)) return false
      if (!q) return true
      return [c.fullName, c.email, c.city ?? '', c.country ?? '', ...c.favouriteDestinations, ...c.interests]
        .some(v => v.toLowerCase().includes(q))
    })
  }, [contacts, query, segmentFilter, showSelectedOnly, selectedSet])

  const visible = filtered.slice(0, VISIBLE_LIMIT)
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedSet.has(c.id))
  // Picks that are no longer in the consented list (consent withdrawn since
  // the campaign was saved). Kept visible so the admin understands the count.
  const missing = selected.filter(id => !byId.has(id))
  const known = selected.filter(id => byId.has(id))

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter(s => s !== id) : [...selected, id])
  }
  function selectFiltered() {
    const next = new Set(selected)
    filtered.forEach(c => next.add(c.id))
    onChange(Array.from(next))
  }
  function deselectFiltered() {
    const drop = new Set(filtered.map(c => c.id))
    onChange(selected.filter(id => !drop.has(id)))
  }

  return (
    <div className={`border border-gray-200 bg-white ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, city, interest…"
            className={`${inputClass} pl-8`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} className={`${inputClass} sm:w-auto flex-1`}>
            <option value="">All consented customers</option>
            {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 font-sans text-xs text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={showSelectedOnly} onChange={e => setShowSelectedOnly(e.target.checked)} />
            Selected only
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-sans text-xs text-gray-500">
            <strong className="text-[#2d6a4f]">{selected.length.toLocaleString()}</strong> selected
            {' · '}{filtered.length.toLocaleString()} shown of {contacts.length.toLocaleString()}
          </p>
          <div className="flex gap-3">
            {filtered.length > 0 && (
              allFilteredSelected ? (
                <button type="button" onClick={deselectFiltered} className="font-sans text-xs text-gray-500 hover:text-[#2d6a4f]">Deselect shown</button>
              ) : (
                <button type="button" onClick={selectFiltered} className="font-sans text-xs text-[#2d6a4f] hover:underline">Select all shown</button>
              )
            )}
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="font-sans text-xs text-red-400 hover:text-red-500">Clear</button>
            )}
          </div>
        </div>
      </div>

      <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50" role="listbox" aria-multiselectable="true" aria-label="Contacts">
        {visible.length === 0 && (
          <li className="px-4 py-6 font-sans text-sm text-gray-400 text-center">
            {contacts.length === 0 ? 'No marketing-consented customers yet.' : 'No contacts match.'}
          </li>
        )}
        {visible.map(c => {
          const on = selectedSet.has(c.id)
          const detail = [c.email, c.city || c.country, c.favouriteDestinations[0]].filter(Boolean).join(' · ')
          return (
            <li key={c.id} role="option" aria-selected={on}>
              <button type="button" onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${on ? 'bg-[#2d6a4f]/5' : 'hover:bg-gray-50'}`}>
                <span className={`w-4 h-4 shrink-0 border flex items-center justify-center ${on ? 'bg-[#2d6a4f] border-[#2d6a4f]' : 'border-gray-300 bg-white'}`}>
                  {on && <Check size={11} className="text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="font-sans text-sm text-[#000000] block truncate">{c.fullName}</span>
                  <span className="font-sans text-xs text-gray-400 block truncate">{detail}</span>
                </span>
              </button>
            </li>
          )
        })}
        {filtered.length > VISIBLE_LIMIT && (
          <li className="px-4 py-3 font-sans text-xs text-gray-400 text-center">
            Showing the first {VISIBLE_LIMIT}. Search or filter to narrow, or use &ldquo;Select all shown&rdquo; to pick all {filtered.length.toLocaleString()}.
          </li>
        )}
      </ul>

      {selected.length > 0 && (
        <div className="p-3 border-t border-gray-100 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {known.slice(0, 40).map(id => {
            const c = byId.get(id)!
            return (
              <span key={id} className="inline-flex items-center gap-1 bg-[#F7F5F2] border border-gray-200 px-2 py-0.5 font-sans text-xs text-gray-600">
                {c.fullName}
                <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${c.fullName}`} className="text-gray-400 hover:text-red-400"><X size={11} /></button>
              </span>
            )
          })}
          {known.length > 40 && <span className="font-sans text-xs text-gray-400 px-1 py-0.5">+{known.length - 40} more</span>}
          {missing.length > 0 && (
            <p className="w-full font-sans text-xs text-[#8B6914] mt-1">
              {missing.length} earlier pick{missing.length === 1 ? ' has' : 's have'} since withdrawn marketing consent and won&apos;t be sent to.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
