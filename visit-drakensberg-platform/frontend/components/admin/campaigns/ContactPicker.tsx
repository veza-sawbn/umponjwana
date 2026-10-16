'use client'

import { useMemo, useState } from 'react'
import { Search, X, Check, Loader2 } from 'lucide-react'
import { getConsentStatus, typedContact, type CampaignContact, type ContactConsent } from '@/lib/email-campaigns-admin'
import type { SegmentCount } from '@/lib/customers-admin'

const inputClass = 'w-full bg-white border border-gray-200 px-3 py-2 font-sans text-sm text-[#000000] placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] transition-colors'

/** Rows rendered at once. The list filters client-side, so this only caps
 *  DOM size; search narrows to anyone in the full list. */
const VISIBLE_LIMIT = 200

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CONSENT_BADGE: Record<ContactConsent, { label: string; className: string }> = {
  opted_in: { label: 'Opted in', className: 'bg-[#2d6a4f]/10 text-[#2d6a4f]' },
  unknown: { label: 'No consent on record', className: 'bg-[#C9A96E]/15 text-[#8B6914]' },
  opted_out: { label: 'Opted out', className: 'bg-gray-100 text-gray-400' },
}

/**
 * Hand-pick campaign recipients from every customer and supplier address-book
 * contact (e.g. the Wix import), or type addresses in. Selection is a list of
 * lower-cased email addresses and lives with the parent; this owns the
 * search/filter state. Opted-out people are shown but can't be picked.
 */
export default function ContactPicker({
  contacts, segments, selected, onChange, onAddTyped, disabled,
}: {
  contacts: CampaignContact[]
  segments: SegmentCount[]
  selected: string[]
  onChange: (emails: string[]) => void
  /** Typed addresses that weren't in the list, so the parent can keep them. */
  onAddTyped: (contacts: CampaignContact[]) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'' | 'customer' | 'address_book'>('')
  const [consentFilter, setConsentFilter] = useState<'' | ContactConsent>('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [typed, setTyped] = useState('')
  const [typedBusy, setTypedBusy] = useState(false)
  const [typedNote, setTypedNote] = useState('')

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const byId = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts.filter(c => {
      if (showSelectedOnly && !selectedSet.has(c.id)) return false
      if (segmentFilter && !c.segmentIds.includes(segmentFilter)) return false
      if (sourceFilter === 'customer' && c.kind !== 'customer') return false
      if (sourceFilter === 'address_book' && c.kind === 'customer') return false
      if (consentFilter && c.consent !== consentFilter) return false
      if (!q) return true
      return [c.fullName, c.email, c.city ?? '', c.country ?? '', ...c.addressBooks, ...c.favouriteDestinations, ...c.interests]
        .some(v => v.toLowerCase().includes(q))
    })
  }, [contacts, query, segmentFilter, sourceFilter, consentFilter, showSelectedOnly, selectedSet])

  const pickable = filtered.filter(c => c.consent !== 'opted_out')
  const visible = filtered.slice(0, VISIBLE_LIMIT)
  const allPickableSelected = pickable.length > 0 && pickable.every(c => selectedSet.has(c.id))
  const known = selected.filter(id => byId.has(id))
  // Picks no longer in the list, or now opted out — kept visible so the count makes sense.
  const blocked = selected.filter(id => !byId.has(id) || byId.get(id)!.consent === 'opted_out')

  function toggle(c: CampaignContact) {
    if (c.consent === 'opted_out' && !selectedSet.has(c.id)) return
    onChange(selectedSet.has(c.id) ? selected.filter(s => s !== c.id) : [...selected, c.id])
  }
  function selectFiltered() {
    const next = new Set(selected)
    pickable.forEach(c => next.add(c.id))
    onChange(Array.from(next))
  }
  function deselectFiltered() {
    const drop = new Set(filtered.map(c => c.id))
    onChange(selected.filter(id => !drop.has(id)))
  }

  async function addTyped() {
    const parts = typed.split(/[\s,;]+/).map(p => p.trim().toLowerCase()).filter(Boolean)
    const invalid = parts.filter(p => !EMAIL.test(p))
    const valid = Array.from(new Set(parts.filter(p => EMAIL.test(p))))
    if (valid.length === 0) { setTypedNote(invalid.length ? `Not an email address: ${invalid.join(', ')}` : ''); return }

    setTypedBusy(true)
    const unknownToList = valid.filter(e => !byId.has(e))
    const statuses = await getConsentStatus(unknownToList)
    setTypedBusy(false)
    const statusByEmail = new Map(statuses.map(s => [s.email, s]))

    const added: CampaignContact[] = []
    const refused: string[] = []
    for (const e of unknownToList) {
      const s = statusByEmail.get(e)
      if (s?.isStaff) { refused.push(`${e} (staff account)`); continue }
      added.push(typedContact(e, s?.consent ?? 'unknown'))
    }
    if (added.length) onAddTyped(added)

    const all = [...valid.filter(e => byId.has(e)).map(e => byId.get(e)!), ...added]
    const optedOut = all.filter(c => c.consent === 'opted_out').map(c => c.email)
    const toSelect = all.filter(c => c.consent !== 'opted_out').map(c => c.id)
    onChange(Array.from(new Set([...selected, ...toSelect])))

    const notes: string[] = []
    if (toSelect.length) notes.push(`Added ${toSelect.length}.`)
    if (optedOut.length) notes.push(`Opted out, not added: ${optedOut.join(', ')}.`)
    if (refused.length) notes.push(`Not added: ${refused.join(', ')}.`)
    if (invalid.length) notes.push(`Not an email address: ${invalid.join(', ')}.`)
    setTypedNote(notes.join(' '))
    setTyped('')
  }

  return (
    <div className={`border border-gray-200 bg-white ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, supplier, city…"
            className={`${inputClass} pl-8`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)} className={inputClass} aria-label="Source">
            <option value="">Customers and address books</option>
            <option value="customer">Customers (website accounts)</option>
            <option value="address_book">Address books (e.g. Wix import)</option>
          </select>
          <select value={consentFilter} onChange={e => setConsentFilter(e.target.value as typeof consentFilter)} className={inputClass} aria-label="Consent">
            <option value="">Any consent status</option>
            <option value="opted_in">Opted in</option>
            <option value="unknown">No consent on record</option>
            <option value="opted_out">Opted out</option>
          </select>
          <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} className={inputClass} aria-label="Segment">
            <option value="">Any segment</option>
            {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-sans text-xs text-gray-500">
            <strong className="text-[#2d6a4f]">{selected.length.toLocaleString()}</strong> selected
            {' · '}{filtered.length.toLocaleString()} shown of {contacts.length.toLocaleString()}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 font-sans text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={showSelectedOnly} onChange={e => setShowSelectedOnly(e.target.checked)} />
              Selected only
            </label>
            {pickable.length > 0 && (
              allPickableSelected ? (
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
            {contacts.length === 0 ? 'No contacts yet. Add addresses below.' : 'No contacts match.'}
          </li>
        )}
        {visible.map(c => {
          const on = selectedSet.has(c.id)
          const off = c.consent === 'opted_out'
          const where = c.kind === 'customer' ? 'Customer'
            : c.kind === 'typed' ? 'Typed in'
            : `Address book: ${c.addressBooks.join(', ')}`
          const detail = [c.fullName !== c.email ? c.email : null, where].filter(Boolean).join(' · ')
          const badge = CONSENT_BADGE[c.consent]
          return (
            <li key={c.id} role="option" aria-selected={on} aria-disabled={off && !on}>
              <button type="button" onClick={() => toggle(c)} disabled={off && !on}
                title={off ? 'This person opted out of marketing email.' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${on ? 'bg-[#2d6a4f]/5' : off ? 'cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                <span className={`w-4 h-4 shrink-0 border flex items-center justify-center ${on ? 'bg-[#2d6a4f] border-[#2d6a4f]' : off ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'}`}>
                  {on && <Check size={11} className="text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`font-sans text-sm block truncate ${off ? 'text-gray-400' : 'text-[#000000]'}`}>{c.fullName}</span>
                  <span className="font-sans text-xs text-gray-400 block truncate">{detail}</span>
                </span>
                <span className={`shrink-0 font-sans text-[10px] tracking-[0.04em] px-1.5 py-0.5 ${badge.className}`}>{badge.label}</span>
              </button>
            </li>
          )
        })}
        {filtered.length > VISIBLE_LIMIT && (
          <li className="px-4 py-3 font-sans text-xs text-gray-400 text-center">
            Showing the first {VISIBLE_LIMIT}. Search or filter to narrow, or use &ldquo;Select all shown&rdquo; to pick all {pickable.length.toLocaleString()}.
          </li>
        )}
      </ul>

      <div className="p-3 border-t border-gray-100 space-y-2">
        <label htmlFor="typed-recipients" className="font-sans text-xs text-gray-500 block">Add by email address</label>
        <div className="flex gap-2">
          <textarea id="typed-recipients" value={typed} onChange={e => setTyped(e.target.value)} rows={2}
            placeholder="name@example.com, another@example.com"
            className={`${inputClass} resize-y`} />
          <button type="button" onClick={addTyped} disabled={typedBusy || !typed.trim()}
            className="shrink-0 self-start inline-flex items-center gap-1.5 border border-gray-200 px-3 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50">
            {typedBusy && <Loader2 size={12} className="animate-spin" />} Add
          </button>
        </div>
        <p className="font-sans text-[11px] text-gray-400">Separate with commas, spaces or new lines. To check the email yourself first, use &ldquo;Send a test&rdquo; on the campaign page.</p>
        {typedNote && <p className="font-sans text-xs text-gray-600">{typedNote}</p>}
      </div>

      {selected.length > 0 && (
        <div className="p-3 border-t border-gray-100 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {known.slice(0, 40).map(id => {
            const c = byId.get(id)!
            return (
              <span key={id} className="inline-flex items-center gap-1 bg-[#F7F5F2] border border-gray-200 px-2 py-0.5 font-sans text-xs text-gray-600">
                {c.fullName}
                <button type="button" onClick={() => toggle(c)} aria-label={`Remove ${c.fullName}`} className="text-gray-400 hover:text-red-400"><X size={11} /></button>
              </span>
            )
          })}
          {known.length > 40 && <span className="font-sans text-xs text-gray-400 px-1 py-0.5">+{known.length - 40} more</span>}
          {blocked.length > 0 && (
            <p className="w-full font-sans text-xs text-[#8B6914] mt-1">
              {blocked.length} pick{blocked.length === 1 ? ' has' : 's have'} since opted out or left the contact list and won&apos;t be sent to.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
