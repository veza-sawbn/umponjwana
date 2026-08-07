import { supabase } from './auth'
import { DEFAULT_TIP_PRESETS } from './tips'

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
  user_id: string | null
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
  /**
   * Unguessable key that makes the invoice link openable by whoever holds it
   * — a customer with no account, or one reading mail on a device they've
   * never signed in on. Optional in the type because a database that hasn't
   * run 20260808_invoice_share_links.sql yet simply won't return it.
   */
  share_token?: string | null
  /** When the *current* link was minted — re-issuing moves this forward. */
  share_issued_at?: string | null
  /** Set while the link is withdrawn; cleared by re-issuing. */
  share_revoked_at?: string | null
  first_viewed_at?: string | null
  last_viewed_at?: string | null
  view_count?: number | null
}

/** The order header an invoice document prints — no allocation or payout data. */
export type InvoiceCustomerOrder = {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  trip_name: string
  travel_start: string | null
  travel_end: string | null
  currency: string
}

/** Everything the invoice page needs, fetched in one go with a share token. */
export type SharedInvoice = {
  invoice: Invoice
  order: InvoiceCustomerOrder | null
  receipts: Receipt[]
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

/**
 * Reads an invoice with its share token, through a SECURITY DEFINER function
 * rather than the table — so it works with no session at all, which is the
 * whole point: the customer we emailed usually has no account, and a guest
 * order has no user_id for RLS to match in the first place.
 *
 * Returns null for a token that matches nothing, and for a database that
 * hasn't run the share-link migration yet (the caller falls back to the
 * signed-in path).
 */
export async function getInvoiceByToken(token: string): Promise<SharedInvoice | null> {
  try {
    const { data } = await supabase.rpc('vd_invoice_by_token', { p_token: token })
    if (data && (data as { invoice?: Invoice }).invoice) {
      const bundle = data as { invoice: Invoice; order: InvoiceCustomerOrder | null; receipts: Receipt[] }
      return {
        invoice: bundle.invoice,
        order: bundle.order ?? null,
        receipts: Array.isArray(bundle.receipts) ? bundle.receipts : [],
      }
    }
  } catch {}
  return null
}

/**
 * Records that the customer opened their invoice. Staff opens are discarded
 * by the function itself, so "viewed" always means the customer.
 * Fire-and-forget: never let view tracking break the page it is tracking.
 */
export async function markInvoiceViewed(opts: { token?: string | null; invoiceId?: string | null }): Promise<void> {
  try {
    await supabase.rpc('vd_mark_invoice_viewed', {
      p_token: opts.token ?? null,
      p_invoice_id: opts.invoiceId ?? null,
    })
  } catch {}
}

/**
 * The link to hand a customer over any channel — email, WhatsApp, SMS.
 *
 * The token rides in the query string so the invoice opens without a login.
 * Without one (an old row, or a database still to be migrated) this is still
 * a valid link — it just needs the customer to be signed in as the account
 * that owns the invoice, which is the behaviour that prompted all this.
 */
export function invoiceShareUrl(
  invoice: Pick<Invoice, 'id' | 'share_token' | 'share_revoked_at'>,
  origin?: string,
): string {
  const base = origin
    ?? (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || ''))
  // A revoked invoice still holds a token — a rotated one nobody was given.
  // Never put it in a URL, so no path can hand out a link the database will
  // refuse anyway.
  const token = invoice.share_revoked_at ? null : invoice.share_token
  const path = `/invoices/${encodeURIComponent(invoice.id)}${token ? `?t=${token}` : ''}`
  return `${base}${path}`
}

/**
 * Withdraws the current link: a copy of it stops opening anything, for
 * everyone who has one. Staff only — the database refuses anyone else.
 */
export async function revokeInvoiceLink(invoiceId: string): Promise<void> {
  const { error } = await supabase.rpc('vd_revoke_invoice_link', { p_invoice_id: invoiceId })
  if (error) throw new Error(error.message || 'Could not revoke this invoice link')
}

/**
 * Mints a fresh link and returns its token. Any earlier link — revoked or
 * not — stops working, so this doubles as "replace the one that leaked".
 */
export async function reissueInvoiceLink(invoiceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('vd_reissue_invoice_link', { p_invoice_id: invoiceId })
  if (error) throw new Error(error.message || 'Could not re-issue this invoice link')
  if (typeof data !== 'string' || !data) throw new Error('The database returned no new link')
  return data
}

/** Human summary of the view tracking, for the staff console. */
export function invoiceViewedLabel(invoice: Invoice): string {
  if (!invoice.first_viewed_at) return 'Not opened yet'

  const last = invoice.last_viewed_at || invoice.first_viewed_at
  // Views of a link that has since been replaced say nothing about whether
  // the customer has seen the one they hold now.
  if (invoice.share_issued_at && new Date(last) < new Date(invoice.share_issued_at)) {
    return 'Not opened since re-issue'
  }

  const stamp = new Date(last).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const times = Number(invoice.view_count ?? 0)
  return times > 1 ? `${stamp} · ${times}×` : stamp
}

/**
 * A stored rate of 0 is a deliberate setting (zero-rated VAT, waived service
 * fee), not a missing one — so the fallback applies only when the row is
 * absent or unparseable. The previous `Number(value) || default` read a saved
 * 0 back as the 15%/12% default, which then got written back on the next save
 * and silently undid the change.
 */
function rate(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Tip presets are percentages: keep whole, sane, ascending values only. */
function tipPresets(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback
  const clean = value
    .map(v => Number(v))
    .filter(n => Number.isFinite(n) && n > 0 && n <= 100)
    .map(n => Math.round(n * 10) / 10)
    .sort((a, b) => a - b)
  return clean.length > 0 ? clean : fallback
}

export type FinanceSettings = {
  serviceFeeRate: number
  vatRate: number
  currency: string
  /** Whether guests may add a gratuity when paying an activity invoice online. */
  tippingEnabled: boolean
  /** Percentages offered on the invoice's tip selector. */
  tipPresets: number[]
}

/**
 * Editable finance defaults (vd_finance_settings) with sensible fallbacks.
 *
 * tippingEnabled defaults to false, unlike the rate fallbacks above: the
 * migration that adds the tipping machinery is also what seeds the
 * tipping_enabled row, so an absent row means this database can't record a
 * gratuity yet. Better to not offer one than to offer one that fails at the
 * payment step.
 */
export async function getFinanceSettings(): Promise<FinanceSettings> {
  const out: FinanceSettings = {
    serviceFeeRate: 0.12, vatRate: 0.15, currency: 'ZAR',
    tippingEnabled: false, tipPresets: [...DEFAULT_TIP_PRESETS],
  }
  try {
    const { data } = await supabase.from('vd_finance_settings').select('key, value')
    for (const row of data ?? []) {
      const r = row as { key: string; value: unknown }
      if (r.key === 'service_fee_rate') out.serviceFeeRate = rate(r.value, out.serviceFeeRate)
      if (r.key === 'vat_rate') out.vatRate = rate(r.value, out.vatRate)
      if (r.key === 'default_currency' && typeof r.value === 'string') out.currency = r.value
      if (r.key === 'tipping_enabled') out.tippingEnabled = r.value !== false
      if (r.key === 'tip_presets') out.tipPresets = tipPresets(r.value, out.tipPresets)
    }
  } catch {}
  return out
}

/** Admin-only write (RLS: vd_finance_settings is admin-managed). */
export async function setFinanceSettings(patch: Partial<FinanceSettings>): Promise<void> {
  const rows: { key: string; value: unknown }[] = []
  if (patch.serviceFeeRate !== undefined) rows.push({ key: 'service_fee_rate', value: patch.serviceFeeRate })
  if (patch.vatRate !== undefined) rows.push({ key: 'vat_rate', value: patch.vatRate })
  if (patch.currency !== undefined) rows.push({ key: 'default_currency', value: patch.currency })
  if (patch.tippingEnabled !== undefined) rows.push({ key: 'tipping_enabled', value: patch.tippingEnabled })
  if (patch.tipPresets !== undefined) rows.push({ key: 'tip_presets', value: patch.tipPresets })
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
