'use client'

import { Plus, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/allocation'
import {
  MAX_INSTALMENTS, draftForMode, evenSplit, resolveSchedule, scheduleFromDraft, validateSchedule,
  type ScheduleDraft, type ScheduleDraftRow, type ScheduleMode,
} from '@/lib/payment-schedule'

// Payment terms for one invoice: pay in full, a deposit then the balance, or
// a split into several instalments. Used in the invoice form (create / edit /
// draft) and in the Payments panel, where terms can still be changed after
// money has come in.

const MODES: [ScheduleMode, string][] = [
  ['full', 'Pay in full'],
  ['deposit', 'Deposit + balance'],
  ['split', 'Split payments'],
]

const label = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1'
const input = 'border border-gray-200 px-2 py-2 font-sans text-base sm:text-sm focus:outline-none'

export default function PaymentScheduleEditor({ value, onChange, total, currency = 'ZAR', amountPaid = 0 }: {
  value: ScheduleDraft
  onChange: (next: ScheduleDraft) => void
  /** The invoice total the schedule is measured against. */
  total: number
  currency?: string
  /** Shown against each instalment when terms are changed after payment. */
  amountPaid?: number
}) {
  const schedule = scheduleFromDraft(value, total)
  const error = total > 0 ? validateSchedule(schedule, total) : null
  const resolved = schedule ? resolveSchedule(schedule, total, amountPaid) : []

  function setRow(i: number, patch: Partial<ScheduleDraftRow>) {
    onChange({ ...value, rows: value.rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) })
  }

  function addRow() {
    if (value.rows.length >= MAX_INSTALMENTS) return
    const rows = [...value.rows]
    // New instalments go before the final "remainder" one.
    rows.splice(rows.length - 1, 0, { label: `Payment ${rows.length}`, value: '', unit: 'amount', dueDate: '' })
    onChange({ ...value, rows: rows.map((r, i) => /^Payment \d+$/.test(r.label) ? { ...r, label: `Payment ${i + 1}` } : r) })
  }

  function removeRow(i: number) {
    if (value.rows.length <= 2) return
    const rows = value.rows.filter((_, idx) => idx !== i)
    onChange({ ...value, rows: rows.map((r, idx) => /^Payment \d+$/.test(r.label) ? { ...r, label: `Payment ${idx + 1}` } : r) })
  }

  return (
    <div className="border border-gray-200 p-3">
      <p className={label}>Payment terms</p>
      <div className="grid grid-cols-3 sm:flex sm:w-fit border border-gray-200 bg-white overflow-hidden mb-3">
        {MODES.map(([mode, text]) => (
          <button key={mode} type="button" onClick={() => onChange(draftForMode(mode, value))}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 font-sans text-xs transition-colors border-r border-gray-100 last:border-0 ${value.mode === mode ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
            {text}
          </button>
        ))}
      </div>

      {value.mode === 'full' ? (
        <p className="font-sans text-xs text-gray-400">The customer pays the whole balance in one go.</p>
      ) : (
        <>
          {value.mode === 'split' && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-sans text-xs text-gray-500">Split evenly into</span>
              {[2, 3, 4, 6].map(n => (
                <button key={n} type="button" onClick={() => onChange(evenSplit(n, value))}
                  className={`px-3 py-1.5 border font-sans text-xs ${value.rows.length === n ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-gray-200 text-gray-500 hover:border-[#2d6a4f]'}`}>
                  {n}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {value.rows.map((r, i) => {
              const last = i === value.rows.length - 1
              const res = resolved[i]
              return (
                <div key={i} className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end bg-[#FCFBFA] border border-gray-100 p-2">
                  <div className="col-span-6 sm:col-span-3">
                    <label className={label}>{last ? 'Final payment' : `Payment ${i + 1}`}</label>
                    <input value={r.label} onChange={e => setRow(i, { label: e.target.value })} maxLength={80}
                      className={`${input} w-full`} placeholder={last ? 'Balance' : 'Deposit'} />
                  </div>
                  <div className="col-span-3 sm:col-span-4">
                    <label className={label}>Amount</label>
                    {last ? (
                      <p className="py-2 font-sans text-sm text-gray-600">Remainder</p>
                    ) : (
                      <div className="flex">
                        <input value={r.value} onChange={e => setRow(i, { value: e.target.value })} inputMode="decimal"
                          placeholder={r.unit === 'percent' ? '%' : 'R'}
                          className={`${input} w-full min-w-0 text-right border-r-0`} />
                        <select value={r.unit} onChange={e => setRow(i, { unit: e.target.value as ScheduleDraftRow['unit'] })}
                          aria-label="Amount or percentage" className="border border-gray-200 bg-white px-2 font-sans text-xs focus:outline-none">
                          <option value="percent">%</option>
                          <option value="amount">{currency === 'ZAR' ? 'R' : currency}</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="col-span-3 sm:col-span-3">
                    <label className={label}>Due</label>
                    <input type="date" value={r.dueDate} onChange={e => setRow(i, { dueDate: e.target.value })}
                      className={`${input} w-full`} />
                  </div>
                  <div className="col-span-5 sm:col-span-1 sm:text-right pb-2">
                    <p className="font-sans text-sm text-[#2d6a4f] whitespace-nowrap">{res ? formatMoney(res.amount, currency) : '—'}</p>
                    {res && amountPaid > 0 && (
                      <p className="font-sans text-[10px] text-gray-400 whitespace-nowrap">
                        {res.status === 'paid' ? 'paid' : res.paid > 0 ? `${formatMoney(res.paid, currency)} paid` : 'unpaid'}
                      </p>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-center pb-2">
                    {value.mode === 'split' && value.rows.length > 2 && !last && (
                      <button type="button" onClick={() => removeRow(i)} aria-label="Remove payment" className="text-gray-300 hover:text-red-400">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {value.mode === 'split' && value.rows.length < MAX_INSTALMENTS && (
            <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 py-2 mt-1 font-sans text-xs text-[#2d6a4f] hover:underline">
              <Plus size={13} /> Add payment
            </button>
          )}

          {error
            ? <p className="font-sans text-xs text-red-600 mt-2">{error}</p>
            : <p className="font-sans text-[10px] text-gray-400 mt-2">
                The final payment is always whatever is left, so it adjusts if the invoice total changes.
                The customer is asked for one payment at a time and can always settle the full balance instead.
              </p>}
        </>
      )}
    </div>
  )
}
