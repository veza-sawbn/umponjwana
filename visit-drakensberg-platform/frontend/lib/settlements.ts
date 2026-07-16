import { supabase } from './auth'
import type { OrderLine } from './orders'

// Settlement engine + virtual supplier statements.
//
// Suppliers are paid via settlements (weekly / monthly / manual / partial /
// bulk / scheduled) with an approve → pay → (reverse) lifecycle. Suppliers
// never receive accounting invoices — they get virtual STATEMENTS composed
// from their own order lines and settlements, scoped by RLS so Supplier A
// can never see Supplier B's data.

export type Settlement = {
  id: string
  reference: string
  supplier_id: string
  supplier_name: string
  method: string
  status: 'pending' | 'approved' | 'paid' | 'reversed'
  period_start: string | null
  period_end: string | null
  scheduled_for: string | null
  gross_amount: number
  commission: number
  fees: number
  tax_amount: number
  net_amount: number
  line_count: number
  currency: string
  payout_reference: string | null
  notes: string
  approved_at: string | null
  paid_at: string | null
  reversed_at: string | null
  created_at: string
}

export type SupplierBalance = {
  supplierId: string
  supplierName: string
  unsettledLines: OrderLine[]
  gross: number
  commission: number
  fees: number
  net: number
}

export type StatementRow = {
  bookingReference: string
  service: string
  category: string
  customerName: string      // '' when not operationally shared
  travelDates: string
  gross: number
  commission: number
  platformFees: number
  tax: number
  net: number
  paymentStatus: string
  settlementStatus: string
  settlementReference: string
}

export type SupplierStatement = {
  period: string            // e.g. '2026-07'
  rows: StatementRow[]
  gross: number
  commission: number
  fees: number
  tax: number
  net: number
  settled: number
  outstanding: number
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getSettlements(): Promise<Settlement[]> {
  try {
    const { data } = await supabase
      .from('vd_settlements').select('*').order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as Settlement[]
  } catch {}
  return []
}

export async function getMySettlements(): Promise<Settlement[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('vd_settlements').select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as Settlement[]
  } catch {}
  return []
}

/** Admin/finance: outstanding supplier balances from unsettled, paid lines. */
export async function getSupplierBalances(): Promise<SupplierBalance[]> {
  try {
    const { data } = await supabase
      .from('vd_order_lines').select('*')
      .not('supplier_id', 'is', null)
      .eq('settlement_status', 'unsettled')
      .neq('fulfilment_status', 'cancelled')
      .order('created_at')
    const lines = Array.isArray(data) ? data as OrderLine[] : []
    const bySupplier = new Map<string, SupplierBalance>()
    for (const l of lines) {
      if (!l.supplier_id) continue
      const b = bySupplier.get(l.supplier_id) ?? {
        supplierId: l.supplier_id,
        supplierName: l.supplier_name,
        unsettledLines: [],
        gross: 0, commission: 0, fees: 0, net: 0,
      }
      b.unsettledLines.push(l)
      b.gross += Number(l.gross_amount) - Number(l.discount_amount)
      b.commission += Number(l.commission_amount)
      b.fees += Number(l.platform_fee)
      b.net += Number(l.supplier_share)
      bySupplier.set(l.supplier_id, b)
    }
    return [...bySupplier.values()].sort((a, b) => b.net - a.net)
  } catch {}
  return []
}

// ── Lifecycle (finance staff) ────────────────────────────────────────────────

export async function createSettlement(input: {
  supplierId: string
  lineIds: string[]
  method?: string           // weekly|monthly|manual|partial|bulk|scheduled
  scheduledFor?: string
  notes?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('vd_create_settlement', {
    p_supplier: input.supplierId,
    p_line_ids: input.lineIds,
    p_method: input.method ?? 'manual',
    p_scheduled_for: input.scheduledFor ?? null,
    p_notes: input.notes ?? '',
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function approveSettlement(id: string): Promise<void> {
  const { error } = await supabase.rpc('vd_approve_settlement', { p_id: id })
  if (error) throw new Error(error.message)
}

export async function paySettlement(id: string, payoutReference = ''): Promise<void> {
  const { error } = await supabase.rpc('vd_pay_settlement', { p_id: id, p_payout_reference: payoutReference })
  if (error) throw new Error(error.message)
}

export async function reverseSettlement(id: string, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('vd_reverse_settlement', { p_id: id, p_reason: reason })
  if (error) throw new Error(error.message)
}

// ── Virtual supplier statements ──────────────────────────────────────────────

function fmtDates(from?: string | null, to?: string | null): string {
  if (!from) return '—'
  return to && to !== from ? `${from} → ${to}` : from
}

/**
 * Compose monthly virtual statements from a supplier's own order lines and
 * settlements. Used by the supplier portal (their own lines via RLS) and by
 * admins previewing a supplier's statement.
 */
export function buildStatements(lines: OrderLine[], settlements: Settlement[]): SupplierStatement[] {
  const settlementById = new Map(settlements.map(s => [s.id, s]))

  const byPeriod = new Map<string, StatementRow[]>()
  for (const l of lines) {
    if (l.fulfilment_status === 'cancelled') continue
    const period = (l.service_date || l.created_at).slice(0, 7)
    const settlement = l.settlement_id ? settlementById.get(l.settlement_id) : undefined
    const row: StatementRow = {
      bookingReference: l.order_number,
      service: l.title,
      category: l.category,
      customerName: l.share_customer_name ? l.customer_name : '',
      travelDates: fmtDates(l.service_date, l.end_date),
      gross: Number(l.gross_amount) - Number(l.discount_amount),
      commission: Number(l.commission_amount),
      platformFees: Number(l.platform_fee),
      tax: Number(l.tax_amount),
      net: Number(l.supplier_share),
      paymentStatus: l.payment_status,
      settlementStatus: l.settlement_status,
      settlementReference: settlement?.reference ?? l.payout_reference ?? '',
    }
    byPeriod.set(period, [...(byPeriod.get(period) ?? []), row])
  }

  return [...byPeriod.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, rows]) => {
      const sum = (f: (r: StatementRow) => number) => rows.reduce((s, r) => s + f(r), 0)
      const settled = rows.filter(r => r.settlementStatus === 'settled').reduce((s, r) => s + r.net, 0)
      return {
        period,
        rows,
        gross: sum(r => r.gross),
        commission: sum(r => r.commission),
        fees: sum(r => r.platformFees),
        tax: sum(r => r.tax),
        net: sum(r => r.net),
        settled,
        outstanding: sum(r => r.net) - settled,
      }
    })
}
