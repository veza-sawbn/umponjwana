import { supabase } from './auth'
import { newEntityId } from './entities'
import { fuzzyFilter } from './fuzzy'
import { discountProblem, lineDiscountAmount } from './line-discount'
import type { DraftLine } from './invoice-drafts'
import type { OrderLine } from './orders'

// Saved invoice items and bundles: a shared library of the lines staff keep
// typing into manual invoices (20261119_invoice_saved_items.sql).
//
// An item is one saved line; a bundle is several lines added together, such
// as a package plus the components it includes, written off. Picking one
// COPIES its lines into the invoice form, where every field, supplier
// included, can still be changed for that invoice. Nothing on the money path
// reads this table, so editing or archiving an item never changes an invoice
// or draft that already used it.

export type SavedItemKind = 'item' | 'bundle'

/** The categories a manual invoice line (and so a saved one) can take. */
export const INVOICE_LINE_CATEGORIES = [
  'accommodation', 'activity', 'tour', 'hike', 'event', 'shuttle', 'equipment', 'permit', 'levy',
  'donation', 'meal', 'package', 'extra',
]

export type SavedItem = {
  id: string
  kind: SavedItemKind
  name: string
  notes: string
  /** Same shape as an invoice draft's lines. An item has one, a bundle two or more. */
  lines: DraftLine[]
  use_count: number
  last_used_at: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export type SavedItemInput = {
  kind: SavedItemKind
  name: string
  notes?: string
  lines: DraftLine[]
}

// ── Pure helpers (no I/O) ───────────────────────────────────────────────────

/** A typed number as the database will read it: "1,5" → "1.5", junk kept as typed. */
function cleanNumber(v: string | undefined): string {
  return String(v ?? '').trim().replace(',', '.')
}

/**
 * A form line as it should be stored in the library: trimmed, numbers
 * normalised, and discount fields only when the line has a discount.
 */
export function lineToTemplate(l: DraftLine): DraftLine {
  const out: DraftLine = {
    title: l.title.trim(),
    description: (l.description ?? '').trim(),
    category: l.category || 'extra',
    quantity: cleanNumber(l.quantity) || '1',
    unitLabel: (l.unitLabel ?? '').trim() || 'unit',
    unitPrice: cleanNumber(l.unitPrice),
    supplierId: l.supplierId ?? '',
  }
  if (l.discountType && cleanNumber(l.discountValue) !== '') {
    out.discountType = l.discountType
    out.discountValue = cleanNumber(l.discountValue)
    out.discountReason = (l.discountReason ?? '').trim()
    out.discountFundedBy = l.discountFundedBy ?? (l.supplierId ? 'supplier' : 'platform')
  }
  return out
}

/**
 * Fresh form lines from a saved entry. A supplier who is no longer in
 * `knownSuppliers` (removed, or no longer a supplier) is cleared so the line
 * cannot be billed to someone who isn't there; `clearedSupplier` says so, so
 * the form can ask the person to choose one. Pass `null` while the supplier
 * list hasn't loaded, to keep every supplier as saved.
 */
export function linesFromSaved(
  item: Pick<SavedItem, 'lines'>,
  knownSuppliers: ReadonlySet<string> | null,
): { lines: DraftLine[]; clearedSupplier: boolean } {
  let clearedSupplier = false
  const lines = (item.lines ?? []).map(raw => {
    const l = lineToTemplate({
      title: String(raw.title ?? ''),
      description: String(raw.description ?? ''),
      category: String(raw.category ?? 'extra'),
      quantity: String(raw.quantity ?? '1'),
      unitLabel: String(raw.unitLabel ?? 'unit'),
      unitPrice: String(raw.unitPrice ?? ''),
      supplierId: String(raw.supplierId ?? ''),
      discountType: raw.discountType,
      discountValue: raw.discountValue === undefined ? undefined : String(raw.discountValue),
      discountReason: raw.discountReason,
      discountFundedBy: raw.discountFundedBy,
    })
    // 0 means "price entered on each invoice": show it as blank.
    if (parseFloat(l.unitPrice) === 0) l.unitPrice = ''
    if (l.supplierId && knownSuppliers && !knownSuppliers.has(l.supplierId)) {
      l.supplierId = ''
      if (l.discountType) l.discountFundedBy = 'platform'
      clearedSupplier = true
    }
    return l
  })
  return { lines, clearedSupplier }
}

/** A line's price before and after its discount. */
export function templateLineAmounts(l: DraftLine): { gross: number; net: number } {
  const gross = (parseFloat(cleanNumber(l.unitPrice)) || 0) * (parseFloat(cleanNumber(l.quantity)) || 1)
  const discount = l.discountType ? lineDiscountAmount(gross, l.discountType, l.discountValue) : 0
  return { gross, net: gross - discount }
}

/** What a saved entry adds to an invoice before fees, or null when a price is left open. */
export function savedItemTotal(item: Pick<SavedItem, 'lines'>): number | null {
  let total = 0
  for (const l of item.lines ?? []) {
    const { gross, net } = templateLineAmounts(l)
    if (gross <= 0) return null
    total += net
  }
  return total
}

/** What's wrong with an entry before saving it, or null. Mirrors vd_invoice_items_check. */
export function savedItemProblem(input: SavedItemInput): string | null {
  const lines = input.lines.filter(l => l.title.trim() || l.unitPrice.trim() || (l.description ?? '').trim())
  if (input.kind === 'item' && lines.length !== 1) return 'A saved item has exactly one line.'
  if (input.kind === 'bundle') {
    if (!input.name.trim()) return 'Give the bundle a name.'
    if (lines.length < 2) return 'A bundle needs at least two lines.'
    if (lines.length > 50) return 'A bundle can hold at most 50 lines.'
  }
  for (const l of lines) {
    const t = lineToTemplate(l)
    if (!t.title) return 'Every line needs a title.'
    const qty = Number(t.quantity)
    if (!Number.isFinite(qty) || qty <= 0) return `The quantity on "${t.title}" must be more than 0.`
    if (t.unitPrice !== '') {
      const price = Number(t.unitPrice)
      if (!Number.isFinite(price)) return `The price on "${t.title}" is not a number.`
      if (price < 0) return `The price on "${t.title}" cannot be negative.`
    }
    if (t.discountType) {
      const { gross } = templateLineAmounts(t)
      // An open price can't be checked against an amount; a percentage still can.
      const problem = discountProblem(gross > 0 || t.discountType === 'percent' ? gross : Infinity, t.discountType, t.discountValue)
      if (problem) return `Discount on "${t.title}": ${problem.toLowerCase()}.`
    }
  }
  return null
}

/** The live entry of this kind with this name (case-insensitive), if any. */
export function findSavedByName(items: SavedItem[], kind: SavedItemKind, name: string): SavedItem | undefined {
  const n = name.trim().toLowerCase()
  return items.find(i => !i.archived && i.kind === kind && i.name.trim().toLowerCase() === n)
}

/**
 * The entries to offer for `query`: with no query, the most used first (then
 * the most recently used, then by name); with one, the best fuzzy matches
 * across the name and every line's title and description.
 */
export function rankSavedItems(items: SavedItem[], query: string): SavedItem[] {
  const live = items.filter(i => !i.archived)
  if (!query.trim()) {
    return [...live].sort((a, b) =>
      (b.use_count - a.use_count)
      || ((b.last_used_at ?? '') > (a.last_used_at ?? '') ? 1 : (b.last_used_at ?? '') < (a.last_used_at ?? '') ? -1 : 0)
      || a.name.localeCompare(b.name))
  }
  return fuzzyFilter(live, query, i =>
    [i.name, ...i.lines.flatMap(l => [l.title, l.description ?? '', l.category])].join(' '))
}

/** A form line from an issued invoice's order line, discount included. */
export function draftLineFromOrderLine(l: OrderLine): DraftLine {
  return {
    title: l.title,
    description: l.description ?? '',
    category: l.category,
    quantity: String(l.quantity),
    unitLabel: l.unit_label,
    unitPrice: String(l.unit_price),
    supplierId: l.supplier_id ?? '',
    ...(Number(l.discount_amount) > 0 ? {
      discountType: 'amount' as const,
      discountValue: String(Number(l.discount_amount)),
      discountReason: l.discount_reason ?? '',
      discountFundedBy: l.discount_funded_by ?? 'supplier',
    } : {}),
  }
}

// ── Database ────────────────────────────────────────────────────────────────

function rowToItem(row: any): SavedItem {
  return {
    id: row.id,
    kind: row.kind === 'bundle' ? 'bundle' : 'item',
    name: row.name ?? '',
    notes: row.notes ?? '',
    lines: Array.isArray(row.lines) ? row.lines : [],
    use_count: Number(row.use_count) || 0,
    last_used_at: row.last_used_at ?? null,
    archived: !!row.archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Every saved item and bundle, archived ones included. `null` when the
 * library isn't there (migration not applied yet), so the form can hide it.
 */
export async function getSavedItems(): Promise<SavedItem[] | null> {
  const { data, error } = await supabase
    .from('vd_invoice_items').select('*').order('name').limit(2000)
  if (error) {
    console.error('[invoice-items] vd_invoice_items unavailable:', error.message)
    return null
  }
  return (data ?? []).map(rowToItem)
}

function friendlyError(message: string | undefined, fallback: string): Error {
  if (message?.includes('vd_invoice_items_live_name_idx')) {
    return new Error('There is already a saved entry with that name.')
  }
  return new Error(message || fallback)
}

/** Saves a new entry, or overwrites the one with `id`. Returns the saved row. */
export async function saveSavedItem(input: SavedItemInput, id?: string): Promise<SavedItem> {
  const lines = input.lines
    .filter(l => l.title.trim() || l.unitPrice.trim() || (l.description ?? '').trim())
    .map(lineToTemplate)
  const row = {
    kind: input.kind,
    name: input.kind === 'item' ? (lines[0]?.title ?? '') : input.name.trim(),
    notes: (input.notes ?? '').trim(),
    lines,
  }
  const query = id
    ? supabase.from('vd_invoice_items').update(row).eq('id', id).select('*').maybeSingle()
    : supabase.from('vd_invoice_items').insert({ id: newEntityId('iti'), ...row }).select('*').maybeSingle()
  const { data, error } = await query
  if (error) throw friendlyError(error.message, 'Could not save the item')
  if (!data) throw new Error('You do not have permission to change saved items.')
  return rowToItem(data)
}

export async function setSavedItemArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('vd_invoice_items').update({ archived }).eq('id', id)
  if (error) throw friendlyError(error.message, archived ? 'Could not archive the item' : 'Could not restore the item')
}

export async function deleteSavedItem(id: string): Promise<void> {
  const { error } = await supabase.from('vd_invoice_items').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Could not delete the item')
}

/** Counts a use so common items rise to the top. Best effort: never blocks the form. */
export async function recordSavedItemUse(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  try {
    await supabase.rpc('vd_record_invoice_item_use', { p_ids: ids })
  } catch {}
}

/** A line on a sales quote, which has no supplier or discount of its own. */
export type QuoteDraftLine = { title: string; category: string; quantity: string; unitLabel: string; unitPrice: string }

/**
 * Quote lines from a saved entry. A discounted line goes in at its discounted
 * unit price; a line written off in full is left out (a quote has no way to
 * show "included"), and `included` lists those titles so the form can say so.
 */
export function quoteLinesFromSaved(item: Pick<SavedItem, 'lines'>): { lines: QuoteDraftLine[]; included: string[] } {
  const included: string[] = []
  const lines: QuoteDraftLine[] = []
  for (const l of linesFromSaved(item, null).lines) {
    const qty = parseFloat(l.quantity) || 1
    let unitPrice = l.unitPrice
    if (l.discountType) {
      const { gross, net } = templateLineAmounts(l)
      if (gross > 0 && net <= 0) { included.push(l.title); continue }
      if (gross > 0) unitPrice = String(Math.round((net / qty) * 100) / 100)
    }
    lines.push({ title: l.title, category: l.category, quantity: l.quantity, unitLabel: l.unitLabel, unitPrice })
  }
  return { lines, included }
}
