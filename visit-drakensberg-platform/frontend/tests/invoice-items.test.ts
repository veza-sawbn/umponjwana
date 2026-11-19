import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ supabase: {} }))

import {
  draftLineFromOrderLine, findSavedByName, lineToTemplate, linesFromSaved, quoteLinesFromSaved,
  rankSavedItems, savedItemProblem, savedItemTotal, type SavedItem,
} from '@/lib/invoice-items'
import type { DraftLine } from '@/lib/invoice-drafts'
import type { OrderLine } from '@/lib/orders'

const SUPPLIER = '11111111-1111-4111-8111-111111111111'
const GONE = '22222222-2222-4222-8222-222222222222'

function line(over: Partial<DraftLine> = {}): DraftLine {
  return {
    title: 'Shuttle', description: '', category: 'shuttle', quantity: '1', unitLabel: 'person',
    unitPrice: '300', supplierId: '', ...over,
  }
}

function saved(over: Partial<SavedItem> = {}): SavedItem {
  return {
    id: over.id ?? Math.random().toString(36).slice(2), kind: 'item', name: 'Shuttle', notes: '',
    lines: [line()], use_count: 0, last_used_at: null, archived: false, created_at: '', updated_at: '', ...over,
  }
}

const traverse = saved({
  kind: 'bundle', name: 'Northern Mini Traverse package',
  lines: [
    line({ title: 'Northern Mini Traverse', category: 'hike', unitPrice: '1500', quantity: '2', supplierId: SUPPLIER }),
    line({ title: 'Return shuttle', unitPrice: '300', quantity: '2', supplierId: GONE,
      discountType: 'percent', discountValue: '100', discountReason: 'Included', discountFundedBy: 'supplier' }),
  ],
})

describe('lineToTemplate', () => {
  it('trims text, normalises decimal commas and fills defaults', () => {
    expect(lineToTemplate(line({ title: '  Levy ', unitPrice: ' 45,50 ', quantity: '', unitLabel: '' }))).toEqual({
      title: 'Levy', description: '', category: 'shuttle', quantity: '1', unitLabel: 'unit', unitPrice: '45.50', supplierId: '',
    })
  })
  it('keeps a discount only when it has a value', () => {
    expect(lineToTemplate(line({ discountType: 'amount', discountValue: '' })).discountType).toBeUndefined()
    const t = lineToTemplate(line({ discountType: 'amount', discountValue: '50' }))
    expect(t).toMatchObject({ discountType: 'amount', discountValue: '50', discountReason: '', discountFundedBy: 'platform' })
  })
})

describe('linesFromSaved', () => {
  it('copies lines, so editing them never changes the saved entry', () => {
    const { lines } = linesFromSaved(traverse, new Set([SUPPLIER, GONE]))
    lines[0].unitPrice = '1'
    expect(traverse.lines[0].unitPrice).toBe('1500')
  })
  it('clears a supplier who is no longer listed, and moves their discount to the platform', () => {
    const { lines, clearedSupplier } = linesFromSaved(traverse, new Set([SUPPLIER]))
    expect(clearedSupplier).toBe(true)
    expect(lines[0].supplierId).toBe(SUPPLIER)
    expect(lines[1].supplierId).toBe('')
    expect(lines[1].discountFundedBy).toBe('platform')
  })
  it('keeps every supplier while the list has not loaded', () => {
    const { lines, clearedSupplier } = linesFromSaved(traverse, null)
    expect(clearedSupplier).toBe(false)
    expect(lines[1].supplierId).toBe(GONE)
  })
  it('shows a price of 0 as blank, to be entered on the invoice', () => {
    expect(linesFromSaved(saved({ lines: [line({ unitPrice: '0' })] }), null).lines[0].unitPrice).toBe('')
  })
  it('tolerates numbers stored as numbers', () => {
    const raw = saved({ lines: [{ ...line(), quantity: 2 as any, unitPrice: 300 as any }] })
    expect(linesFromSaved(raw, null).lines[0]).toMatchObject({ quantity: '2', unitPrice: '300' })
  })
})

describe('savedItemTotal', () => {
  it('adds the lines after their discounts', () => {
    expect(savedItemTotal(traverse)).toBe(3000)
  })
  it('is null when a price is left open', () => {
    expect(savedItemTotal(saved({ lines: [line({ unitPrice: '' })] }))).toBeNull()
  })
})

describe('savedItemProblem', () => {
  it('accepts a well-formed item and bundle', () => {
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line()] })).toBeNull()
    expect(savedItemProblem({ kind: 'bundle', name: 'Pkg', lines: traverse.lines })).toBeNull()
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line({ unitPrice: '' })] })).toBeNull()
  })
  it('flags what the database would refuse', () => {
    expect(savedItemProblem({ kind: 'bundle', name: '', lines: traverse.lines })).toMatch(/name/)
    expect(savedItemProblem({ kind: 'bundle', name: 'Pkg', lines: [line()] })).toMatch(/two lines/)
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line({ title: ' ' })] })).toMatch(/title/)
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line({ quantity: '0' })] })).toMatch(/quantity/)
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line({ unitPrice: '-5' })] })).toMatch(/negative/)
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line({ unitPrice: 'abc' })] })).toMatch(/number/)
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line({ discountType: 'percent', discountValue: '120' })] })).toMatch(/100%/)
    expect(savedItemProblem({ kind: 'item', name: '', lines: [line({ discountType: 'amount', discountValue: '301' })] })).toMatch(/more than/i)
  })
  it('ignores untouched blank lines in a bundle', () => {
    expect(savedItemProblem({ kind: 'bundle', name: 'Pkg', lines: [...traverse.lines, line({ title: '', unitPrice: '' })] })).toBeNull()
  })
})

describe('rankSavedItems', () => {
  const a = saved({ id: 'a', name: 'Conservation levy', use_count: 2, last_used_at: '2026-11-01',
    lines: [line({ title: 'Conservation levy', category: 'levy' })] })
  const b = saved({ id: 'b', name: 'Sentinel shuttle', use_count: 9 })
  const c = saved({ id: 'c', name: 'Cathedral Peak permit', use_count: 2, last_used_at: '2026-11-10',
    lines: [line({ title: 'Cathedral Peak permit', category: 'permit' })] })
  const d = saved({ id: 'd', name: 'Old shuttle', use_count: 50, archived: true })

  it('offers the most used first, then the most recent, and never archived ones', () => {
    expect(rankSavedItems([a, b, c, d], '').map(i => i.id)).toEqual(['b', 'c', 'a'])
  })
  it('searches names and lines, tolerating typos', () => {
    expect(rankSavedItems([a, b, c, d], 'shutle').map(i => i.id)).toEqual(['b'])
    expect(rankSavedItems([a, traverse], 'return').map(i => i.name)).toEqual(['Northern Mini Traverse package'])
  })
})

describe('findSavedByName', () => {
  it('matches a live entry of the same kind, ignoring case and spaces', () => {
    const items = [saved({ id: 'x', name: 'Sentinel Shuttle' }), saved({ id: 'y', name: 'Levy', archived: true })]
    expect(findSavedByName(items, 'item', ' sentinel shuttle ')?.id).toBe('x')
    expect(findSavedByName(items, 'bundle', 'Sentinel Shuttle')).toBeUndefined()
    expect(findSavedByName(items, 'item', 'Levy')).toBeUndefined()
  })
})

describe('draftLineFromOrderLine', () => {
  it('turns an issued line back into a form line, discount included', () => {
    const l = {
      title: 'Return shuttle', description: 'Back to Mahai', category: 'shuttle', quantity: 2, unit_label: 'person',
      unit_price: 300, supplier_id: SUPPLIER, discount_amount: 600, discount_reason: 'Included', discount_funded_by: 'platform',
    } as unknown as OrderLine
    expect(draftLineFromOrderLine(l)).toEqual({
      title: 'Return shuttle', description: 'Back to Mahai', category: 'shuttle', quantity: '2', unitLabel: 'person',
      unitPrice: '300', supplierId: SUPPLIER, discountType: 'amount', discountValue: '600',
      discountReason: 'Included', discountFundedBy: 'platform',
    })
  })
})

describe('quoteLinesFromSaved', () => {
  it('leaves out written-off lines and names them', () => {
    const { lines, included } = quoteLinesFromSaved(traverse)
    expect(lines.map(l => l.title)).toEqual(['Northern Mini Traverse'])
    expect(included).toEqual(['Return shuttle'])
  })
  it('puts a part discount in at the discounted unit price', () => {
    const { lines } = quoteLinesFromSaved(saved({ lines: [line({ quantity: '3', unitPrice: '100', discountType: 'amount', discountValue: '50' })] }))
    expect(lines[0].unitPrice).toBe('83.33')
  })
})
