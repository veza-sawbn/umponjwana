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

/** Marks a draft as sent (opens it up for the customer to view/accept) and emails the link. */
export async function sendQuote(id: string): Promise<void> {
  await updateQuote(id, { status: 'sent', sent_at: new Date().toISOString() } as Partial<Quote>)
  if (typeof fetch === 'function') {
    fetch('/api/quotes/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: id }),
    }).catch(err => console.error('Quote email failed:', err))
  }
}

/** Converts an accepted quote into a real Master Order + Invoice. Works for logged-in owners, admins, or an anonymous guest holding the link. */
export async function acceptQuote(id: string): Promise<{ orderId: string; invoiceId: string }> {
  const { data, error } = await supabase.rpc('vd_accept_quote', { p_quote_id: id })
  if (error) throw new Error(error.message || 'Could not accept quote')
  return { orderId: data.orderId, invoiceId: data.invoiceId }
}

export async function declineQuote(id: string): Promise<void> {
  const { error } = await supabase.rpc('vd_decline_quote', { p_quote_id: id })
  if (error) throw new Error(error.message || 'Could not decline quote')
}
