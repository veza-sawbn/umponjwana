import { supabase } from './auth'

// Customer invoices & receipts. One invoice per Master Order — the customer
// never receives multiple invoices because multiple suppliers are involved,
// and no supplier payout information ever appears on it.

export type InvoiceLine = {
  title: string
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

export async function getReceipts(orderId?: string): Promise<Receipt[]> {
  try {
    let q = supabase.from('vd_receipts').select('*').order('created_at', { ascending: false })
    if (orderId) q = q.eq('order_id', orderId)
    const { data } = await q
    if (Array.isArray(data)) return data as Receipt[]
  } catch {}
  return []
}
