// Deposit and split (instalment) payment schedules for customer invoices.
//
// A schedule is set by staff when an invoice is created or edited, and can be
// changed afterwards — even once money has come in, since it only says *when*
// the total is due, never how much the total is. No schedule (null) means the
// invoice is payable in full, which is how every invoice behaved before.
//
// The last instalment is always "whatever is left": its stored amount is
// ignored and recomputed as total minus the earlier instalments. That keeps a
// schedule valid when the total moves after it was set — an edit that
// re-prices the invoice, or a gratuity the webhook adds on payment — without
// anyone having to re-balance it by hand.
//
// Pure functions only, so the admin console, the invoice page, the PDF and the
// payment route all agree on what is due now.

export type InstalmentInput = {
  label: string
  /** Fixed amount for this instalment. Ignored on the last instalment. */
  amount: number
  /**
   * When the amount was entered as a percentage of the total, the percentage —
   * kept so the editor can show it again. `amount` is still the source of truth.
   */
  percent?: number | null
  /** YYYY-MM-DD, or null for "on receipt". */
  dueDate: string | null
}

export type PaymentSchedule = {
  kind: 'deposit' | 'split'
  instalments: InstalmentInput[]
}

export type InstalmentStatus = 'paid' | 'part-paid' | 'due' | 'upcoming'

export type ResolvedInstalment = {
  label: string
  amount: number
  dueDate: string | null
  /** How much of this instalment the payments to date have covered. */
  paid: number
  /** What is still owed on this instalment. */
  outstanding: number
  status: InstalmentStatus
}

export const MAX_INSTALMENTS = 12

const round2 = (n: number) => Math.round(n * 100) / 100

/** Coerces whatever came back from the database into a schedule, or null. */
export function parseSchedule(raw: unknown): PaymentSchedule | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { kind?: unknown; instalments?: unknown }
  if (r.kind !== 'deposit' && r.kind !== 'split') return null
  if (!Array.isArray(r.instalments) || r.instalments.length < 2) return null
  const instalments = r.instalments.map((i, idx): InstalmentInput => {
    const x = (i ?? {}) as Record<string, unknown>
    const amount = Number(x.amount)
    const percent = x.percent === null || x.percent === undefined ? null : Number(x.percent)
    return {
      label: typeof x.label === 'string' && x.label.trim() ? x.label.trim() : `Payment ${idx + 1}`,
      amount: Number.isFinite(amount) ? amount : 0,
      percent: percent !== null && Number.isFinite(percent) ? percent : null,
      dueDate: typeof x.dueDate === 'string' && x.dueDate ? x.dueDate : null,
    }
  })
  return { kind: r.kind, instalments }
}

/**
 * The schedule's instalments as amounts against `total`, the last one taking
 * the remainder. Earlier instalments are capped so the running sum never
 * passes the total (only possible if the total dropped after the schedule was
 * set), so the amounts always add up to exactly `total`.
 */
export function resolveAmounts(schedule: PaymentSchedule, total: number): number[] {
  const t = Math.max(round2(total), 0)
  const out: number[] = []
  let running = 0
  schedule.instalments.forEach((inst, idx) => {
    const last = idx === schedule.instalments.length - 1
    const want = last ? t - running : Math.max(round2(inst.amount), 0)
    const amount = round2(Math.min(want, t - running))
    out.push(Math.max(amount, 0))
    running = round2(running + Math.max(amount, 0))
  })
  return out
}

/**
 * Lays the payments received to date over the schedule, oldest instalment
 * first, and marks each one paid / part-paid / due / upcoming.
 *
 * "Due" is the first instalment not yet fully covered — the one a customer is
 * asked to pay now — regardless of its date: an instalment due next month is
 * still the next thing to pay, it just isn't late yet.
 */
export function resolveSchedule(
  schedule: PaymentSchedule,
  total: number,
  amountPaid: number,
): ResolvedInstalment[] {
  const amounts = resolveAmounts(schedule, total)
  let remainingPaid = Math.max(round2(amountPaid), 0)
  let foundDue = false
  return schedule.instalments.map((inst, idx) => {
    const amount = amounts[idx]
    const paid = round2(Math.min(remainingPaid, amount))
    remainingPaid = round2(remainingPaid - paid)
    const outstanding = round2(amount - paid)
    let status: InstalmentStatus
    if (outstanding <= 0) status = 'paid'
    else if (!foundDue) { status = paid > 0 ? 'part-paid' : 'due'; foundDue = true }
    else status = 'upcoming'
    return { label: inst.label, amount, dueDate: inst.dueDate, paid, outstanding, status }
  })
}

/**
 * What the customer should pay now: the outstanding part of the first
 * instalment not yet covered, or the whole balance when there is no schedule.
 * Never more than the balance, never negative.
 */
export function amountDueNow(
  schedule: PaymentSchedule | null,
  total: number,
  amountPaid: number,
): { amount: number; label: string | null; dueDate: string | null } {
  const balance = Math.max(round2(total - amountPaid), 0)
  if (!schedule) return { amount: balance, label: null, dueDate: null }
  const next = resolveSchedule(schedule, total, amountPaid).find(i => i.outstanding > 0)
  if (!next) return { amount: balance, label: null, dueDate: null }
  return { amount: Math.min(next.outstanding, balance), label: next.label, dueDate: next.dueDate }
}

/**
 * Checks a schedule against the invoice total. Returns a message for staff,
 * or null when it is fine. The database repeats these checks.
 */
export function validateSchedule(schedule: PaymentSchedule | null, total: number): string | null {
  if (!schedule) return null
  const n = schedule.instalments.length
  if (n < 2) return 'A deposit or split needs at least two payments.'
  if (n > MAX_INSTALMENTS) return `A schedule can have at most ${MAX_INSTALMENTS} payments.`
  let running = 0
  for (let i = 0; i < n - 1; i++) {
    const inst = schedule.instalments[i]
    if (!(inst.amount > 0)) return `Enter an amount for "${inst.label || `Payment ${i + 1}`}".`
    running = round2(running + round2(inst.amount))
  }
  if (!(running < round2(total))) {
    return schedule.kind === 'deposit'
      ? 'The deposit must be less than the invoice total.'
      : 'The earlier payments add up to the whole total, which leaves nothing for the final one.'
  }
  for (let i = 1; i < n; i++) {
    const prev = schedule.instalments[i - 1].dueDate
    const cur = schedule.instalments[i].dueDate
    if (prev && cur && cur < prev) return 'Due dates must run in order, earliest first.'
  }
  return null
}

/** A one-line summary for lists and emails, e.g. "30% deposit, then balance". */
export function scheduleSummary(schedule: PaymentSchedule | null): string {
  if (!schedule) return 'Pay in full'
  if (schedule.kind === 'deposit') {
    const d = schedule.instalments[0]
    return d.percent ? `${d.percent}% deposit, then balance` : 'Deposit, then balance'
  }
  return `${schedule.instalments.length} split payments`
}

// ── Editor state ────────────────────────────────────────────────────────────
// The admin form edits a schedule as strings (what is in the inputs), with
// each earlier instalment entered either as an amount or as a percentage of
// the total. These convert between that and the stored shape.

export type ScheduleMode = 'full' | 'deposit' | 'split'

export type ScheduleDraftRow = {
  label: string
  value: string
  unit: 'amount' | 'percent'
  dueDate: string
}

export type ScheduleDraft = {
  mode: ScheduleMode
  rows: ScheduleDraftRow[]
}

const row = (label: string, value = '', unit: ScheduleDraftRow['unit'] = 'percent', dueDate = ''): ScheduleDraftRow =>
  ({ label, value, unit, dueDate })

/** Fresh rows for a mode, keeping any due dates already entered. */
export function draftForMode(mode: ScheduleMode, current?: ScheduleDraft, splitCount = 3): ScheduleDraft {
  if (mode === 'full') return { mode, rows: [] }
  if (mode === 'deposit') {
    const prev = current?.mode === 'deposit' ? current.rows : []
    return {
      mode,
      rows: [
        prev[0] ?? row('Deposit', '30', 'percent', current?.rows[0]?.dueDate ?? ''),
        prev[1] ?? row('Balance', '', 'amount', current?.rows[current.rows.length - 1]?.dueDate ?? ''),
      ],
    }
  }
  return evenSplit(Math.min(Math.max(splitCount, 2), MAX_INSTALMENTS), current)
}

/**
 * N equal instalments, as percentages so they stay equal if the lines are
 * re-priced. The last one takes the rounding remainder.
 */
export function evenSplit(count: number, current?: ScheduleDraft): ScheduleDraft {
  const share = Math.floor((10000 / count)) / 100
  const rows = Array.from({ length: count }, (_, i) => row(
    current?.mode === 'split' && current.rows[i]?.label ? current.rows[i].label : `Payment ${i + 1}`,
    i === count - 1 ? '' : String(share),
    'percent',
    current?.mode === 'split' ? current.rows[i]?.dueDate ?? '' : '',
  ))
  return { mode: 'split', rows }
}

export function draftFromSchedule(schedule: PaymentSchedule | null | undefined): ScheduleDraft {
  const parsed = parseSchedule(schedule)
  if (!parsed) return { mode: 'full', rows: [] }
  return {
    mode: parsed.kind,
    rows: parsed.instalments.map((i, idx) => {
      const last = idx === parsed.instalments.length - 1
      const usePercent = !last && i.percent != null && i.percent > 0
      return row(
        i.label,
        last ? '' : usePercent ? String(i.percent) : String(i.amount),
        usePercent ? 'percent' : 'amount',
        i.dueDate ?? '',
      )
    }),
  }
}

/** The stored schedule for this draft at `total`, or null for pay in full. */
export function scheduleFromDraft(draft: ScheduleDraft, total: number): PaymentSchedule | null {
  if (draft.mode === 'full' || draft.rows.length < 2) return null
  const instalments = draft.rows.map((r, idx): InstalmentInput => {
    const last = idx === draft.rows.length - 1
    const n = parseFloat(r.value)
    const value = Number.isFinite(n) ? n : 0
    const percent = !last && r.unit === 'percent' ? value : null
    const amount = last ? 0 : percent !== null ? round2(total * percent / 100) : round2(value)
    return {
      label: r.label.trim() || (last && draft.mode === 'deposit' ? 'Balance' : `Payment ${idx + 1}`),
      amount,
      percent,
      dueDate: r.dueDate || null,
    }
  })
  return { kind: draft.mode, instalments }
}
