import { supabase } from './auth'

// Payment tracking against Master Orders. Supports deposits, installments,
// partial/split payments, offline & online payments, refunds, credits, gift
// cards, vouchers and payment plans. Every payment reconciles back to the
// Master Order via the vd_record_order_payment RPC, which maintains order,
// invoice and line balances, issues a receipt and writes a balanced journal.

export type OrderPayment = {
  id: string
  order_id: string
  invoice_id: string | null
  user_id: string
  direction: 'in' | 'out'
  type: string      // payment|deposit|installment|refund|credit|gift_card|voucher
  method: string    // card|eft|cash|offline|online|gift_card|voucher|payment_plan
  amount: number
  currency: string
  status: string
  reference: string
  notes: string
  created_at: string
}

export const PAYMENT_TYPES = ['payment', 'deposit', 'installment', 'refund', 'credit', 'gift_card', 'voucher'] as const
export const PAYMENT_METHODS = ['card', 'eft', 'cash', 'offline', 'online', 'gift_card', 'voucher', 'payment_plan'] as const

export async function recordOrderPayment(input: {
  orderId: string
  amount: number
  type?: string
  method?: string
  reference?: string
  notes?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('vd_record_order_payment', {
    p_order_id: input.orderId,
    p_amount: input.amount,
    p_type: input.type ?? 'payment',
    p_method: input.method ?? 'card',
    p_reference: input.reference ?? '',
    p_notes: input.notes ?? '',
  })
  if (error) throw new Error(error.message || 'Payment failed')
  return data as string
}

export async function getOrderPayments(orderId?: string): Promise<OrderPayment[]> {
  try {
    let q = supabase.from('vd_order_payments').select('*').order('created_at', { ascending: false })
    if (orderId) q = q.eq('order_id', orderId)
    const { data } = await q
    if (Array.isArray(data)) return data as OrderPayment[]
  } catch {}
  return []
}
