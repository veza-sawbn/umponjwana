import { supabase } from './auth'
import { newEntityId } from './entities'

// Saved-but-not-issued manual invoices.
//
// Drafts deliberately live outside the money path: nothing is written to
// vd_orders, vd_invoices or the ledger until a draft is issued, at which point
// the normal createOrder flow runs. A draft is therefore never a receivable,
// never counted in finance or analytics totals, and has no invoice number
// until it becomes real. Staff-only (RLS: is_admin() or is_finance()).

export type DraftLine = {
  title: string
  description: string
  category: string
  quantity: string
  unitLabel: string
  unitPrice: string
  supplierId: string   // '' = platform-owned
}

export type InvoiceDraft = {
  id: string
  created_by: string | null
  user_id: string | null
  guest: boolean
  customer_name: string
  customer_email: string
  customer_phone: string
  trip_name: string
  travel_start: string | null
  travel_end: string | null
  currency: string
  lines: DraftLine[]
  fee_override: string
  tax_override: string
  notes: string
  created_at: string
  updated_at: string
}

export type InvoiceDraftInput = Omit<InvoiceDraft, 'id' | 'created_by' | 'created_at' | 'updated_at'>

export async function getInvoiceDrafts(): Promise<InvoiceDraft[]> {
  try {
    const { data } = await supabase
      .from('vd_invoice_drafts').select('*').order('updated_at', { ascending: false })
    if (Array.isArray(data)) return data as InvoiceDraft[]
  } catch {}
  return []
}

/** Creates a new draft, or overwrites an existing one when `id` is supplied. */
export async function saveInvoiceDraft(input: InvoiceDraftInput, id?: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    id: id ?? newEntityId('idr'),
    created_by: user?.id ?? null,
    ...input,
    travel_start: input.travel_start || null,
    travel_end: input.travel_end || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('vd_invoice_drafts').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(error.message || 'Could not save draft')
  return row.id
}

export async function deleteInvoiceDraft(id: string): Promise<void> {
  const { error } = await supabase.from('vd_invoice_drafts').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Could not delete draft')
}
