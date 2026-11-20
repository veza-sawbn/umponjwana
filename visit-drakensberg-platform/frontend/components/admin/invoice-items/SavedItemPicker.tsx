'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Layers, Search } from 'lucide-react'
import { formatMoney } from '@/lib/allocation'
import { rankSavedItems, savedItemTotal, type SavedItem } from '@/lib/invoice-items'

// Search box that adds a saved item or bundle to an invoice in one pick.
// With nothing typed it offers the most-used entries; typing searches names,
// line titles and descriptions, tolerating typos.

const SHOWN = 8

export default function SavedItemPicker({ items, supplierName, onPick, onManage }: {
  items: SavedItem[]
  /** A supplier's display name by id ('' = the platform). */
  supplierName: (id: string) => string
  onPick: (item: SavedItem) => void
  onManage?: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => rankSavedItems(items, query).slice(0, SHOWN), [items, query])
  useEffect(() => { setActive(0) }, [query])

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(item: SavedItem) {
    onPick(item)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const live = items.filter(i => !i.archived).length

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0">
      <div className="flex items-center border border-gray-200 bg-white focus-within:border-[#2d6a4f]">
        <Search size={14} className="ml-3 text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls="saved-item-options"
          aria-label="Add a saved item or bundle"
          placeholder={live ? 'Add a saved item or bundle…' : 'No saved items yet. Save a line to reuse it'}
          className="flex-1 min-w-0 px-2 py-2.5 md:py-2 font-sans text-base sm:text-sm focus:outline-none bg-transparent"
        />
      </div>

      {open && (
        <div id="saved-item-options" role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg max-h-80 overflow-y-auto">
          {!query.trim() && matches.length > 0 && (
            <p className="px-3 pt-2 pb-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Most used</p>
          )}
          {matches.map((item, idx) => {
            const total = savedItemTotal(item)
            const first = item.lines[0]
            const suppliers = Array.from(new Set(item.lines.map(l => supplierName(l.supplierId))))
            return (
              <button key={item.id} type="button" role="option" aria-selected={idx === active}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(item)}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-3 ${idx === active ? 'bg-[#F7F5F2]' : 'bg-white'}`}>
                {item.kind === 'bundle'
                  ? <Layers size={14} className="mt-0.5 text-[#8B6914] shrink-0" />
                  : <Bookmark size={14} className="mt-0.5 text-[#2d6a4f] shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block font-sans text-sm text-gray-800 truncate">{item.name}</span>
                  <span className="block font-sans text-[11px] text-gray-400 truncate">
                    {item.kind === 'bundle'
                      ? `Bundle · ${item.lines.length} lines · ${item.lines.map(l => l.title).join(', ')}`
                      : `${first?.category ?? ''} · ${suppliers.join(', ')}${first?.description ? ` · ${first.description}` : ''}`}
                  </span>
                </span>
                <span className="shrink-0 font-sans text-xs text-gray-600 text-right">
                  {total === null ? <span className="text-gray-400">price on invoice</span> : formatMoney(total)}
                  {item.kind === 'item' && first && first.unitLabel && first.unitLabel !== 'unit' && total !== null && Number(first.quantity) === 1 && (
                    <span className="block text-[10px] text-gray-400">per {first.unitLabel}</span>
                  )}
                </span>
              </button>
            )
          })}
          {matches.length === 0 && (
            <p className="px-3 py-3 font-sans text-sm text-gray-400">
              {query.trim() ? `Nothing saved matches "${query.trim()}".` : 'No saved items yet. Use the bookmark on a line to save it.'}
            </p>
          )}
          {onManage && (
            <button type="button" onClick={() => { setOpen(false); onManage() }}
              className="w-full text-left px-3 py-2 border-t border-gray-100 font-sans text-xs text-[#2d6a4f] hover:underline">
              Manage saved items and bundles
            </button>
          )}
        </div>
      )}
    </div>
  )
}
