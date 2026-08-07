import { supabase } from './auth'
import { newEntityId } from './entities'

// Sales quotes: staff build one for a customer (who may not have an account
// yet), the customer accepts or declines it, and acceptance converts it into
// a real Master Order + Invoice via the vd_accept_quote RPC (which calls the
// same vd_create_order path a normal booking uses) — so the resulting
// invoice is payable online immediately.

export type QuoteLine = {
  title: string
  category: string
  quantity: number
  unitLabel: string
  unitPrice: number
  total: number
}

export type Quote = {
  id: string
  quote_number: string
  user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  trip_name: string
  destination: string
  currency: string
  subtotal: number
  discount: number
  service_fee: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'converted' | 'declined' | 'expired'
  lines: QuoteLine[]
  notes: string
  valid_until: string | null
  order_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
  accepted_at: string | null
}

export type QuoteDraft = {
  customerName: string
  customerEmail: string
  customerPhone?: string
  tripName?: string
  destination?: string
  currency?: string
  discount?: number
  serviceFee?: number
  taxAmount?: number
  notes?: string
  validUntil?: string | null
  lines: QuoteLine[]
}

function quoteNumber(): string {
  const now = new Date()
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `QTE-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

/** Admin-only listing — RLS restricts non-admins to their own quotes. */
export async function getQuotes(): Promise<Quote[]> {
  try {
    const { data } = await supabase.from('vd_quotes').select('*').order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as Quote[]
  } catch {}
  return []
}

/** Customer/admin/guest-with-link read of one quote. */
export async function getQuoteById(id: string): Promise<Quote | null> {
  try {
    const { data } = await supabase.from('vd_quotes').select('*').eq('id', id).maybeSingle()
    if (data) return data as Quote
  } catch {}
  return null
}

export async function createQuote(draft: QuoteDraft, existingUserId?: string | null): Promise<Quote> {
  const subtotal = draft.lines.reduce((sum, l) => sum + Number(l.total || 0), 0)
  const discount = draft.discount ?? 0
  const serviceFee = draft.serviceFee ?? 0
  const taxAmount = draft.taxAmount ?? 0
  const total = Math.max(subtotal - discount + serviceFee + taxAmount, 0)

  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    id: newEntityId('qte'),
    quote_number: quoteNumber(),
    user_id: existingUserId ?? null,
    customer_name: draft.customerName,
    customer_email: draft.customerEmail,
    customer_phone: draft.customerPhone ?? '',
    trip_name: draft.tripName ?? '',
    destination: draft.destination ?? 'drakensberg',
    currency: draft.currency ?? 'ZAR',
    subtotal, discount, service_fee: serviceFee, tax_amount: taxAmount, total,
    status: 'draft' as const,
    lines: draft.lines,
    notes: draft.notes ?? '',
    valid_until: draft.validUntil ?? null,
    created_by: user?.id ?? null,
  }
  const { data, error } = await supabase.from('vd_quotes').insert(row).select().single()
  if (error) throw new Error(error.message || 'Could not create quote')
  return data as Quote
}

export async function updateQuote(id: string, patch: Partial<Quote>): Promise<void> {
  const { error } = await supabase.from('vd_quotes').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message || 'Could not update quote')
}

export async function deleteQuote(id: string): Promise<void> {
  await supabase.from('vd_quotes').delete().eq('id', id)
}

/**
 * Marks a draft as sent (opens it up for the customer to view/accept) and
 * emails the link.
 *
 * The status update and the email are separate outcomes: the quote is opened
 * up either way, but the caller needs to know whether the customer actually
 * received anything, so the email result is returned rather than swallowed.
 * The send endpoint reports delivery failures in its body with a 200, so
 * `sent` must be read from the payload — `res.ok` alone is not enough.
 */
export async function sendQuote(id: string): Promise<{ sent: boolean; error: string | null }> {
  await updateQuote(id, { status: 'sent', sent_at: new Date().toISOString() } as Partial<Quote>)
  try {
    const res = await fetch('/api/quotes/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: id }),
    })
    const body = await res.json().catch(() => ({} as { sent?: boolean; error?: string }))
    if (!res.ok) return { sent: false, error: body.error || `Email service returned ${res.status}` }
    return { sent: !!body.sent, error: body.error ?? null }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Email request failed' }
  }
}

/** Converts an accepted quote into a real Master Order + Invoice. Works for logged-in owners, admins, or an anonymous guest holding the link. */
export async function acceptQuote(id: string): Promise<{ orderId: string; invoiceId: string }> {
  const { data, error } = await supabase.rpc('vd_accept_quote', { p_quote_id: id })
  if (error) throw new Error(error.message || 'Could not accept quote')
  return { orderId: data.orderId, invoiceId: data.invoiceId }
}

/**
 * The share token for the invoice a quote turned into.
 *
 * A guest accepting a quote has no account, so the invoice they were just
 * redirected to would be unopenable to them — the quote link they already
 * hold is traded for the invoice's own link instead. Returns null on a
 * database that predates 20260808_invoice_share_links.sql.
 */
export async function getQuoteInvoiceLink(
  id: string,
): Promise<{ invoiceId: string; shareToken: string } | null> {
  try {
    const { data } = await supabase.rpc('vd_quote_invoice_link', { p_quote_id: id })
    const link = data as { invoiceId?: string; shareToken?: string } | null
    if (link?.invoiceId && link.shareToken) {
      return { invoiceId: link.invoiceId, shareToken: link.shareToken }
    }
  } catch {}
  return null
}

export async function declineQuote(id: string): Promise<void> {
  const { error } = await supabase.rpc('vd_decline_quote', { p_quote_id: id })
  if (error) throw new Error(error.message || 'Could not decline quote')
}
