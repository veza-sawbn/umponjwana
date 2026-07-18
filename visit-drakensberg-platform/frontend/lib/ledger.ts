import { supabase } from './auth'

// Internal financial ledger — double-entry journals written automatically by
// the order/payment/settlement RPCs. The chart of accounts lives in
// vd_ledger_accounts (seeded, admin-editable, external_ref column ready for
// accounting integrations). Finance staff read; nobody writes directly.

export type LedgerAccount = {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  active: boolean
  external_ref: string | null
}

export type LedgerEntry = {
  id: string
  journal_id: string
  entry_date: string
  account_code: string
  order_id: string | null
  supplier_id: string | null
  debit: number
  credit: number
  memo: string
  created_at: string
}

export type AccountBalance = LedgerAccount & {
  debit: number
  credit: number
  balance: number   // debit-normal for assets/expenses, credit-normal otherwise
}

export async function getLedgerAccounts(): Promise<LedgerAccount[]> {
  try {
    const { data } = await supabase.from('vd_ledger_accounts').select('*').order('code')
    if (Array.isArray(data)) return data as LedgerAccount[]
  } catch {}
  return []
}

export async function getLedgerEntries(opts?: { orderId?: string; accountCode?: string; limit?: number }): Promise<LedgerEntry[]> {
  try {
    let q = supabase.from('vd_ledger_entries').select('*').order('created_at', { ascending: false })
    if (opts?.orderId) q = q.eq('order_id', opts.orderId)
    if (opts?.accountCode) q = q.eq('account_code', opts.accountCode)
    q = q.limit(opts?.limit ?? 500)
    const { data } = await q
    if (Array.isArray(data)) return data as LedgerEntry[]
  } catch {}
  return []
}

/** Trial balance: per-account debit/credit totals and normalised balance. */
export async function getAccountBalances(): Promise<AccountBalance[]> {
  const [accounts, entries] = await Promise.all([
    getLedgerAccounts(),
    (async () => {
      try {
        const { data } = await supabase
          .from('vd_ledger_entries')
          .select('account_code, debit, credit')
          .limit(100000)
        return Array.isArray(data) ? data as Array<{ account_code: string; debit: number; credit: number }> : []
      } catch { return [] }
    })(),
  ])

  const sums = new Map<string, { debit: number; credit: number }>()
  for (const e of entries) {
    const s = sums.get(e.account_code) ?? { debit: 0, credit: 0 }
    s.debit += Number(e.debit) || 0
    s.credit += Number(e.credit) || 0
    sums.set(e.account_code, s)
  }

  return accounts.map(a => {
    const s = sums.get(a.code) ?? { debit: 0, credit: 0 }
    const debitNormal = a.type === 'asset' || a.type === 'expense'
    return {
      ...a,
      debit: s.debit,
      credit: s.credit,
      balance: debitNormal ? s.debit - s.credit : s.credit - s.debit,
    }
  })
}
