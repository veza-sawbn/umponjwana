'use client'

import { useState } from 'react'
import { X, Search } from 'lucide-react'
import { fuzzyFilter } from '@/lib/fuzzy'

export type RelatedItem = {
  id: string
  label: string
  sublabel?: string
}

type PickerProps = {
  label: string
  description?: string
  items: RelatedItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'

/**
 * Generic relationship picker — fuzzy search over a flat list, renders
 * selected items as dismissable chips. Used in entity editor forms to manage
 * `relatedPropertyIds`, `relatedActivityIds`, and `relatedTrailIds` stored
 * in each entity's GraphFields (no migration required — JSONB storage).
 */
export function RelationshipPicker({
  label,
  description,
  items,
  selectedIds,
  onChange,
  placeholder,
}: PickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = items.filter(it => selectedIds.includes(it.id))
  const unselected = items.filter(it => !selectedIds.includes(it.id))

  const results = query.trim().length >= 1
    ? fuzzyFilter(unselected, query, it => `${it.label} ${it.sublabel ?? ''}`)
    : unselected.slice(0, 6)

  function add(id: string) {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id])
    setQuery('')
    setOpen(false)
  }

  function remove(id: string) {
    onChange(selectedIds.filter(x => x !== id))
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      {description && (
        <p className="font-sans text-[11px] text-gray-400 mb-2">{description}</p>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(it => (
            <span
              key={it.id}
              className="inline-flex items-center gap-1.5 bg-[#2d6a4f]/10 text-[#2d6a4f] font-sans text-xs px-2.5 py-1"
            >
              {it.label}
              {it.sublabel && (
                <span className="text-[#2d6a4f]/50">· {it.sublabel}</span>
              )}
              <button
                type="button"
                onClick={() => remove(it.id)}
                className="text-[#2d6a4f]/60 hover:text-red-500 transition-colors ml-0.5"
                aria-label={`Remove ${it.label}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search box + dropdown */}
      <div className="relative">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder ?? 'Search to link…'}
            className={`${inputCls} pl-8`}
          />
        </div>

        {open && results.length > 0 && (
          <div className="absolute z-20 left-0 right-0 top-full bg-white border border-gray-200 shadow-md max-h-44 overflow-y-auto">
            {results.slice(0, 8).map(it => (
              <button
                key={it.id}
                type="button"
                onMouseDown={() => add(it.id)}
                className="w-full text-left px-3 py-2 font-sans text-sm hover:bg-[#F7F5F2] transition-colors border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-800">{it.label}</span>
                {it.sublabel && (
                  <span className="ml-2 font-sans text-[11px] text-gray-400">{it.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length === 0 && (
        <p className="font-sans text-[11px] text-gray-400 mt-1">
          No items linked — search above to add.
        </p>
      )}
    </div>
  )
}
