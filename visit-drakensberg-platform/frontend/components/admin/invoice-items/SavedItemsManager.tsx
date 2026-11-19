'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, Archive, Bookmark, Layers, Pencil, Plus, RotateCcw, Search, Tag, Trash2, X } from 'lucide-react'
import { formatMoney } from '@/lib/allocation'
import { DEFAULT_DISCOUNT_REASON } from '@/lib/line-discount'
import type { DraftLine } from '@/lib/invoice-drafts'
import {
  INVOICE_LINE_CATEGORIES, deleteSavedItem, findSavedByName, rankSavedItems, saveSavedItem,
  savedItemProblem, savedItemTotal, setSavedItemArchived, templateLineAmounts,
  type SavedItem, type SavedItemKind,
} from '@/lib/invoice-items'

// The shared library of saved invoice items and bundles: browse, add, edit,
// archive. Also opened straight into its editor from an invoice line's
// "Save as item" (or the form's "Save lines as bundle"), prefilled.

export type SupplierOption = { id: string; label: string }

export type EditorStart = {
  id?: string
  kind: SavedItemKind
  name: string
  notes?: string
  lines: DraftLine[]
}

const blankLine = (): DraftLine => ({
  title: '', description: '', category: 'extra', quantity: '1', unitLabel: 'unit', unitPrice: '', supplierId: '',
})

const label = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1'
const field = 'w-full border border-gray-200 bg-white px-2.5 py-2 font-sans text-base sm:text-sm focus:outline-none focus:border-[#2d6a4f]'

function TemplateLineFields({ line, suppliers, onChange }: {
  line: DraftLine
  suppliers: SupplierOption[]
  onChange: (patch: Partial<DraftLine>) => void
}) {
  const { gross, net } = templateLineAmounts(line)
  const seg = (on: boolean) => `px-2.5 py-1.5 font-sans text-xs ${on ? 'bg-[#2d6a4f] text-white' : 'text-gray-500'}`
  return (
    <div className="grid grid-cols-6 gap-2">
      <div className="col-span-6 md:col-span-3">
        <label className={label}>Title</label>
        <input value={line.title} onChange={e => onChange({ title: e.target.value })} maxLength={200}
          placeholder="e.g. Shuttle: Sentinel car park to Mahai" className={field} />
      </div>
      <div className="col-span-3 md:col-span-1">
        <label className={label}>Category</label>
        <select value={line.category} onChange={e => onChange({ category: e.target.value })} className={`${field} capitalize`}>
          {INVOICE_LINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="col-span-3 md:col-span-2">
        <label className={label}>Default supplier</label>
        <select value={line.supplierId} onChange={e => onChange({ supplierId: e.target.value })} className={field}>
          <option value="">Visit Drakensberg (platform)</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          {line.supplierId && !suppliers.some(s => s.id === line.supplierId) && (
            <option value={line.supplierId}>Supplier no longer listed</option>
          )}
        </select>
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className={label}>Qty</label>
        <input value={line.quantity} onChange={e => onChange({ quantity: e.target.value })} inputMode="decimal" className={`${field} text-right`} />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className={label}>Per</label>
        <input value={line.unitLabel} onChange={e => onChange({ unitLabel: e.target.value })} placeholder="unit"
          maxLength={30} className={field} />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className={label}>Unit price R</label>
        <input value={line.unitPrice} onChange={e => onChange({ unitPrice: e.target.value })} inputMode="decimal"
          placeholder="Each time" className={`${field} text-right`} />
      </div>
      <div className="col-span-6 md:col-span-3">
        <label className={label}>Description</label>
        <input value={line.description} onChange={e => onChange({ description: e.target.value })} maxLength={2000}
          placeholder="Appears beneath the title on the invoice (optional)" className={field} />
      </div>

      <div className="col-span-6">
        {!line.discountType ? (
          <button type="button" onClick={() => onChange({ discountType: 'percent', discountValue: '100', discountReason: DEFAULT_DISCOUNT_REASON, discountFundedBy: line.supplierId ? 'supplier' : 'platform' })}
            className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
            <Tag size={12} /> Add a discount or write-off
          </button>
        ) : (
          <div className="border border-[#C9A96E]/40 bg-[#C9A96E]/5 p-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-[0.12em] uppercase text-[#8B6914]"><Tag size={11} /> Discount</span>
              <div className="inline-flex border border-gray-200 bg-white overflow-hidden">
                <button type="button" onClick={() => onChange({ discountType: 'amount' })} className={seg(line.discountType === 'amount')}>R</button>
                <button type="button" onClick={() => onChange({ discountType: 'percent' })} className={seg(line.discountType === 'percent')}>%</button>
              </div>
              <input value={line.discountValue ?? ''} onChange={e => onChange({ discountValue: e.target.value })} inputMode="decimal"
                className="w-24 border border-gray-200 bg-white px-2 py-1.5 font-sans text-base sm:text-sm text-right focus:outline-none" />
              {gross > 0 && <span className="font-sans text-xs text-gray-500">Customer pays {formatMoney(net)} of {formatMoney(gross)}</span>}
              <button type="button" onClick={() => onChange({ discountType: undefined, discountValue: undefined, discountReason: undefined, discountFundedBy: undefined })}
                className="ml-auto font-sans text-xs text-gray-400 hover:text-red-500">Remove</button>
            </div>
            <input value={line.discountReason ?? ''} onChange={e => onChange({ discountReason: e.target.value })} maxLength={200}
              placeholder={`Reason shown to the customer, e.g. "${DEFAULT_DISCOUNT_REASON}"`}
              className="w-full border border-gray-200 bg-white px-2.5 py-1.5 font-sans text-base sm:text-xs focus:outline-none" />
            {line.supplierId && (
              <div className="flex flex-wrap gap-3 font-sans text-xs text-gray-600">
                <span className="text-gray-400">Covered by</span>
                {(['supplier', 'platform'] as const).map(f => (
                  <label key={f} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={(line.discountFundedBy ?? 'supplier') === f} onChange={() => onChange({ discountFundedBy: f })} />
                    {f === 'supplier' ? 'The supplier (paid on the discounted price)' : 'Visit Drakensberg (supplier paid in full)'}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SavedItemEditor({ start, items, suppliers, onSaved, onCancel }: {
  start: EditorStart
  items: SavedItem[]
  suppliers: SupplierOption[]
  onSaved: (item: SavedItem) => void
  onCancel: () => void
}) {
  const [kind] = useState<SavedItemKind>(start.kind)
  const [name, setName] = useState(start.name)
  const [notes, setNotes] = useState(start.notes ?? '')
  const [lines, setLines] = useState<DraftLine[]>(start.lines.length ? start.lines : [blankLine(), ...(start.kind === 'bundle' ? [blankLine()] : [])])
  const [busy, setBusy] = useState(false)

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const move = (i: number, by: number) => setLines(ls => {
    const j = i + by
    if (j < 0 || j >= ls.length) return ls
    const next = [...ls]; [next[i], next[j]] = [next[j], next[i]]
    return next
  })

  const effectiveName = kind === 'item' ? (lines[0]?.title ?? '') : name
  // Saving something new under a name that's already taken updates that entry.
  const existing = !start.id ? findSavedByName(items, kind, effectiveName) : undefined
  const targetId = start.id ?? existing?.id
  const total = savedItemTotal({ lines })

  async function save() {
    const input = { kind, name: effectiveName, notes, lines }
    const problem = savedItemProblem(input)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try {
      const saved = await saveSavedItem(input, targetId)
      toast.success(targetId
        ? `Updated "${saved.name}".`
        : kind === 'bundle' ? `Bundle "${saved.name}" saved.` : `"${saved.name}" saved. Find it in the search box on any invoice.`)
      onSaved(saved)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {kind === 'bundle' ? <Layers size={16} className="text-[#8B6914]" /> : <Bookmark size={16} className="text-[#2d6a4f]" />}
        <h3 className="font-display italic text-lg">
          {start.id ? `Edit ${kind}` : kind === 'bundle' ? 'New bundle' : 'New saved item'}
        </h3>
      </div>

      {existing && (
        <p className="mb-4 bg-[#C9A96E]/10 border border-[#C9A96E]/40 px-3 py-2 font-sans text-xs text-[#8B6914]">
          A saved {kind} called &ldquo;{existing.name}&rdquo; already exists. Saving will update it with what&rsquo;s below.
        </p>
      )}

      {kind === 'bundle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={label}>Bundle name</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={200}
              placeholder="e.g. Northern Mini Traverse package" className={field} />
          </div>
          <div>
            <label className={label}>Internal note</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500}
              placeholder="Only staff see this" className={field} />
          </div>
        </div>
      )}

      <div className="space-y-3 mb-3">
        {lines.map((l, i) => (
          <div key={i} className="border border-gray-100 bg-[#FCFBFA] p-3">
            {kind === 'bundle' && (
              <div className="flex items-center justify-between mb-2">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Line {i + 1}</p>
                <div className="flex items-center gap-1 text-gray-400">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move line up" className="p-1 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === lines.length - 1} aria-label="Move line down" className="p-1 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls)}
                    disabled={lines.length <= 2} aria-label="Remove line" className="p-1 hover:text-red-500 disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
            <TemplateLineFields line={l} suppliers={suppliers} onChange={patch => setLine(i, patch)} />
          </div>
        ))}
      </div>
      {kind === 'bundle' && (
        <button type="button" onClick={() => setLines(ls => [...ls, blankLine()])}
          className="inline-flex items-center gap-1.5 py-1 font-sans text-xs text-[#2d6a4f] hover:underline mb-3">
          <Plus size={13} /> Add line
        </button>
      )}
      {kind === 'item' && (
        <div className="mb-3">
          <label className={label}>Internal note</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} placeholder="Only staff see this" className={field} />
        </div>
      )}

      <p className="font-sans text-xs text-gray-500 mb-4">
        {total === null
          ? 'One or more prices are left blank, to be entered on each invoice.'
          : <>Adds <strong className="text-gray-800">{formatMoney(total)}</strong> before service fee and VAT.</>}
        {' '}Everything, including the supplier, can still be changed on each invoice.
      </p>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="border border-gray-200 px-4 py-2.5 sm:py-2 font-sans text-sm text-gray-600 hover:border-gray-300">Cancel</button>
        <button type="button" onClick={save} disabled={busy}
          className="bg-[#2d6a4f] text-white px-5 py-2.5 sm:py-2 font-sans text-sm hover:bg-[#245741] disabled:opacity-60">
          {busy ? 'Saving…' : targetId ? 'Save changes' : 'Save'}
        </button>
      </div>
    </div>
  )
}

type Tab = 'all' | 'item' | 'bundle' | 'archived'

export default function SavedItemsManager({ items, suppliers, startWith, onChange, onClose }: {
  items: SavedItem[]
  suppliers: SupplierOption[]
  /** Open straight into the editor (from "Save as item"); the manager closes once it's saved. */
  startWith?: EditorStart
  onChange: (items: SavedItem[]) => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState<EditorStart | null>(startWith ?? null)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState('')

  const supplierLabel = (id: string) => id ? (suppliers.find(s => s.id === id)?.label ?? 'Supplier no longer listed') : 'Visit Drakensberg'

  const shown = useMemo(() => {
    if (tab === 'archived') {
      const archived = items.filter(i => i.archived)
      return rankSavedItems(archived.map(i => ({ ...i, archived: false })), query)
        .map(i => archived.find(a => a.id === i.id)!)
    }
    return rankSavedItems(items, query).filter(i => tab === 'all' || i.kind === tab)
  }, [items, tab, query])

  function upsert(saved: SavedItem) {
    onChange(items.some(i => i.id === saved.id) ? items.map(i => i.id === saved.id ? saved : i) : [...items, saved])
  }

  async function archive(item: SavedItem, archived: boolean) {
    setBusyId(item.id)
    try {
      await setSavedItemArchived(item.id, archived)
      upsert({ ...item, archived })
      toast.success(archived ? `"${item.name}" archived. It no longer shows on invoices.` : `"${item.name}" restored.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update')
    } finally { setBusyId('') }
  }

  async function remove(item: SavedItem) {
    if (!window.confirm(`Delete "${item.name}" for good? Invoices that used it are not affected.`)) return
    setBusyId(item.id)
    try {
      await deleteSavedItem(item.id)
      onChange(items.filter(i => i.id !== item.id))
      toast.success('Deleted.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete')
    } finally { setBusyId('') }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: items.filter(i => !i.archived).length },
    { id: 'item', label: 'Items', count: items.filter(i => !i.archived && i.kind === 'item').length },
    { id: 'bundle', label: 'Bundles', count: items.filter(i => !i.archived && i.kind === 'bundle').length },
    { id: 'archived', label: 'Archived', count: items.filter(i => i.archived).length },
  ]

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-stretch sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Invoice Module</p>
            <h2 className="font-display italic text-xl sm:text-2xl">Saved items &amp; bundles</h2>
            <p className="hidden sm:block font-sans text-xs text-gray-400 mt-1">
              Shared by everyone who raises invoices. Picking one copies it into the invoice, so changes here never alter an invoice already issued.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5">
          {editing ? (
            <SavedItemEditor
              start={editing}
              items={items}
              suppliers={suppliers}
              onCancel={() => startWith ? onClose() : setEditing(null)}
              onSaved={saved => { upsert(saved); if (startWith) onClose(); else setEditing(null) }}
            />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="flex-1 flex items-center border border-gray-200 focus-within:border-[#2d6a4f]">
                  <Search size={14} className="ml-3 text-gray-400" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search saved items"
                    className="flex-1 px-2 py-2.5 sm:py-2 font-sans text-base sm:text-sm focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing({ kind: 'item', name: '', lines: [] })}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 border border-gray-200 px-3 py-2.5 sm:py-2 font-sans text-sm text-[#2d6a4f] hover:border-[#2d6a4f]">
                    <Plus size={14} /> Item
                  </button>
                  <button onClick={() => setEditing({ kind: 'bundle', name: '', lines: [] })}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 border border-gray-200 px-3 py-2.5 sm:py-2 font-sans text-sm text-[#2d6a4f] hover:border-[#2d6a4f]">
                    <Plus size={14} /> Bundle
                  </button>
                </div>
              </div>

              <div className="flex gap-4 border-b border-gray-100 mb-2 overflow-x-auto">
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`pb-2 font-sans text-xs whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    {t.label} <span className="text-gray-300">{t.count}</span>
                  </button>
                ))}
              </div>

              <div className="divide-y divide-gray-100">
                {shown.map(item => {
                  const total = savedItemTotal(item)
                  return (
                    <div key={item.id} className="py-3 flex items-start gap-3">
                      {item.kind === 'bundle'
                        ? <Layers size={15} className="mt-0.5 text-[#8B6914] shrink-0" />
                        : <Bookmark size={15} className="mt-0.5 text-[#2d6a4f] shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm text-gray-800">{item.name}</p>
                        <p className="font-sans text-[11px] text-gray-400">
                          {item.kind === 'bundle'
                            ? item.lines.map(l => l.title).join(' · ')
                            : `${item.lines[0]?.category ?? ''} · ${supplierLabel(item.lines[0]?.supplierId ?? '')}`}
                        </p>
                        <p className="font-sans text-[11px] text-gray-400">
                          {item.use_count === 0 ? 'Not used yet' : `Used ${item.use_count} ${item.use_count === 1 ? 'time' : 'times'}`}
                          {item.notes && <> · {item.notes}</>}
                        </p>
                      </div>
                      <p className="shrink-0 font-sans text-sm text-gray-700">{total === null ? <span className="text-xs text-gray-400">price on invoice</span> : formatMoney(total)}</p>
                      <div className="shrink-0 flex items-center gap-1 text-gray-400">
                        {!item.archived && (
                          <button onClick={() => setEditing({ id: item.id, kind: item.kind, name: item.name, notes: item.notes, lines: item.lines })}
                            aria-label={`Edit ${item.name}`} className="p-1.5 hover:text-[#2d6a4f]"><Pencil size={14} /></button>
                        )}
                        <button onClick={() => archive(item, !item.archived)} disabled={busyId === item.id}
                          aria-label={item.archived ? `Restore ${item.name}` : `Archive ${item.name}`} title={item.archived ? 'Restore' : 'Archive'}
                          className="p-1.5 hover:text-gray-700 disabled:opacity-40">
                          {item.archived ? <RotateCcw size={14} /> : <Archive size={14} />}
                        </button>
                        {item.archived && (
                          <button onClick={() => remove(item)} disabled={busyId === item.id} aria-label={`Delete ${item.name}`}
                            className="p-1.5 hover:text-red-500 disabled:opacity-40"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {shown.length === 0 && (
                  <p className="py-10 text-center font-sans text-sm text-gray-400">
                    {query.trim() ? 'Nothing matches that search.'
                      : tab === 'archived' ? 'Nothing archived.'
                      : 'Nothing saved yet. Add an item or bundle here, or use the bookmark on any invoice line.'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
