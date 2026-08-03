import { supabase } from './auth'

// Customer invoices & receipts. One invoice per Master Order — the customer
// never receives multiple invoices because multiple suppliers are involved,
// and no supplier payout information ever appears on it.

export type InvoiceLine = {
  title: string
  /** Free-text detail shown beneath the title on the invoice document. */
  description?: string
  category: string
  quantity: number
  unitLabel: string
  unitPrice: number
  total: number
}

export type Invoice = {
  id: string
  invoice_number: string
  order_id: string
  user_id: string
  currency: string
  subtotal: number
  discount: number
  service_fee: number
  tax_amount: number
  total: number
  amount_paid: number
  balance: number
  status: string
  lines: InvoiceLine[]
  issued_at: string
}

export type Receipt = {
  id: string
  receipt_number: string
  payment_id: string
  invoice_id: string | null
  order_id: string
  user_id: string
  amount: number
  method: string
  currency: string
  created_at: string
}

export async function getInvoices(): Promise<Invoice[]> {
  try {
    const { data } = await supabase
      .from('vd_invoices').select('*').order('issued_at', { ascending: false })
    if (Array.isArray(data)) return data as Invoice[]
  } catch {}
  return []
}

export async function getInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  try {
    const { data } = await supabase
      .from('vd_invoices').select('*').eq('order_id', orderId).order('issued_at').limit(1).maybeSingle()
    if (data) return data as Invoice
  } catch {}
  return null
}

/** Look an invoice up by its id, invoice number, or its order's id. */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  try {
    const { data } = await supabase.from('vd_invoices').select('*').eq('id', id).maybeSingle()
    if (data) return data as Invoice
  } catch {}
  try {
    const { data } = await supabase.from('vd_invoices').select('*').eq('invoice_number', id).maybeSingle()
    if (data) return data as Invoice
  } catch {}
  return getInvoiceByOrder(id)
}

/** Editable finance defaults (vd_finance_settings) with sensible fallbacks. */
export async function getFinanceSettings(): Promise<{ serviceFeeRate: number; vatRate: number; currency: string }> {
  const out = { serviceFeeRate: 0.12, vatRate: 0.15, currency: 'ZAR' }
  try {
    const { data } = await supabase.from('vd_finance_settings').select('key, value')
    for (const row of data ?? []) {
      const r = row as { key: string; value: unknown }
      if (r.key === 'service_fee_rate') out.serviceFeeRate = Number(r.value) || out.serviceFeeRate
      if (r.key === 'vat_rate') out.vatRate = Number(r.value) || out.vatRate
      if (r.key === 'default_currency' && typeof r.value === 'string') out.currency = r.value
    }
  } catch {}
  return out
}

/** Admin-only write (RLS: vd_finance_settings is admin-managed). */
export async function setFinanceSettings(patch: Partial<{ serviceFeeRate: number; vatRate: number; currency: string }>): Promise<void> {
  const rows: { key: string; value: unknown }[] = []
  if (patch.serviceFeeRate !== undefined) rows.push({ key: 'service_fee_rate', value: patch.serviceFeeRate })
  if (patch.vatRate !== undefined) rows.push({ key: 'vat_rate', value: patch.vatRate })
  if (patch.currency !== undefined) rows.push({ key: 'default_currency', value: patch.currency })
  if (rows.length === 0) return
  const { error } = await supabase.from('vd_finance_settings').upsert(
    rows.map(r => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'key' },
  )
  if (error) throw new Error(error.message || 'Could not save finance settings')
}

/**
 * Emails the customer their invoice link. The endpoint reports delivery
 * failures in its body with a 200, so `sent` must be read from the payload —
 * `res.ok` alone is not enough.
 */
export async function sendInvoice(invoiceId: string): Promise<{ sent: boolean; error: string | null }> {
  try {
    const res = await fetch('/api/invoices/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId }),
    })
    const body = await res.json().catch(() => ({} as { sent?: boolean; error?: string }))
    if (!res.ok) return { sent: false, error: body.error || `Email service returned ${res.status}` }
    return { sent: !!body.sent, error: body.error ?? null }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Email request failed' }
  }
}

export async function getReceipts(orderId?: string): Promise<Receipt[]> {
  try {
    let q = supabase.from('vd_receipts').select('*').order('created_at', { ascending: false })
    if (orderId) q = q.eq('order_id', orderId)
    const { data } = await q
    if (Array.isArray(data)) return data as Receipt[]
  } catch {}
  return []
}
