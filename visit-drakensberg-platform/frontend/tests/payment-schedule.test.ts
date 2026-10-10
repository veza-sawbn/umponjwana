import { describe, it, expect } from 'vitest'
import {
  amountDueNow, draftForMode, draftFromSchedule, evenSplit, parseSchedule, resolveAmounts,
  resolveSchedule, scheduleFromDraft, validateSchedule, type PaymentSchedule,
} from '@/lib/payment-schedule'

const deposit: PaymentSchedule = {
  kind: 'deposit',
  instalments: [
    { label: 'Deposit', amount: 3000, percent: 30, dueDate: '2026-11-01' },
    { label: 'Balance', amount: 0, dueDate: '2026-12-01' },
  ],
}

const split: PaymentSchedule = {
  kind: 'split',
  instalments: [
    { label: 'Payment 1', amount: 2500, dueDate: null },
    { label: 'Payment 2', amount: 2500, dueDate: '2026-11-15' },
    { label: 'Payment 3', amount: 0, dueDate: '2026-12-15' },
  ],
}

describe('resolveAmounts', () => {
  it('gives the last instalment whatever is left', () => {
    expect(resolveAmounts(deposit, 10000)).toEqual([3000, 7000])
    expect(resolveAmounts(split, 10000)).toEqual([2500, 2500, 5000])
  })
  it('absorbs a later change to the total, such as a gratuity', () => {
    expect(resolveAmounts(deposit, 10250)).toEqual([3000, 7250])
  })
  it('caps earlier instalments if the total fell below them', () => {
    expect(resolveAmounts(split, 4000)).toEqual([2500, 1500, 0])
  })
})

describe('resolveSchedule and amountDueNow', () => {
  it('asks for the deposit first', () => {
    expect(amountDueNow(deposit, 10000, 0)).toEqual({ amount: 3000, label: 'Deposit', dueDate: '2026-11-01' })
  })
  it('then for the balance once the deposit is in', () => {
    expect(amountDueNow(deposit, 10000, 3000)).toEqual({ amount: 7000, label: 'Balance', dueDate: '2026-12-01' })
  })
  it('asks only for the rest of a part-paid instalment', () => {
    const r = resolveSchedule(split, 10000, 3000)
    expect(r.map(i => i.status)).toEqual(['paid', 'part-paid', 'upcoming'])
    expect(amountDueNow(split, 10000, 3000).amount).toBe(2000)
  })
  it('falls back to the whole balance with no schedule', () => {
    expect(amountDueNow(null, 10000, 1234)).toEqual({ amount: 8766, label: null, dueDate: null })
  })
  it('asks for nothing once paid', () => {
    expect(amountDueNow(split, 10000, 10000).amount).toBe(0)
    expect(resolveSchedule(split, 10000, 10000).every(i => i.status === 'paid')).toBe(true)
  })
})

describe('validateSchedule', () => {
  it('accepts a sensible schedule, and no schedule', () => {
    expect(validateSchedule(deposit, 10000)).toBeNull()
    expect(validateSchedule(null, 10000)).toBeNull()
  })
  it('refuses a deposit that is the whole total', () => {
    expect(validateSchedule(deposit, 3000)).toMatch(/less than the invoice total/)
  })
  it('refuses an empty earlier instalment', () => {
    const bad: PaymentSchedule = { kind: 'split', instalments: [{ label: 'A', amount: 0, dueDate: null }, { label: 'B', amount: 0, dueDate: null }] }
    expect(validateSchedule(bad, 1000)).toMatch(/Enter an amount/)
  })
  it('refuses due dates out of order', () => {
    const bad: PaymentSchedule = {
      kind: 'split',
      instalments: [{ label: 'A', amount: 100, dueDate: '2026-12-01' }, { label: 'B', amount: 0, dueDate: '2026-11-01' }],
    }
    expect(validateSchedule(bad, 1000)).toMatch(/in order/)
  })
})

describe('editor round trip', () => {
  it('turns a percentage deposit into an amount at the current total', () => {
    const draft = draftForMode('deposit')
    const s = scheduleFromDraft(draft, 12000)!
    expect(s.kind).toBe('deposit')
    expect(s.instalments[0]).toMatchObject({ label: 'Deposit', amount: 3600, percent: 30 })
  })
  it('splits evenly, the last instalment taking the rounding', () => {
    const s = scheduleFromDraft(evenSplit(3), 1000)!
    expect(resolveAmounts(s, 1000)).toEqual([333.3, 333.3, 333.4])
  })
  it('re-opens a stored schedule as it was entered', () => {
    const draft = draftFromSchedule(deposit)
    expect(draft.mode).toBe('deposit')
    expect(draft.rows[0]).toMatchObject({ value: '30', unit: 'percent', dueDate: '2026-11-01' })
    const fixed = draftFromSchedule(split)
    expect(fixed.rows[0]).toMatchObject({ value: '2500', unit: 'amount' })
  })
  it('pay in full stores nothing', () => {
    expect(scheduleFromDraft(draftForMode('full'), 1000)).toBeNull()
  })
  it('ignores junk from the database', () => {
    expect(parseSchedule({ kind: 'layaway', instalments: [] })).toBeNull()
    expect(parseSchedule(null)).toBeNull()
  })
})
