import { supabase } from './auth'
import { notify } from './notifications'
import { formatMoney } from './allocation'

// Closing out a cancelled booking that had already been paid for. Cancelling
// (vd_cancel_order) moves what the guest paid into the order's refund
// balance; finance then settles that balance one of two ways — a refund back
// to the guest, or credit on the guest's account for a future trip — through
// vd_settle_cancelled_order (supabase/migrations/20261009_cancelled_booking_refund_or_credit.sql).

export type SettlementMode = 'refund' | 'credit'

export type SettleInput = {
  mode: SettlementMode
  /** How the refund went back — refunds only. */
  method?: string
  /** Gateway or bank reference for a refund; optional note for a credit. */
  reference?: string
  notes?: string
}

/**
 * Settle every outstanding refund balance on the booking's order(s) in full.
 * Returns the total settled. Throws if the database refuses (e.g. the caller
 * is not finance staff).
 */
export async function settleCancelledBooking(
  booking: { id: string; userId: string; reference: string },
  input: SettleInput,
): Promise<number> {
  const { data, error } = await supabase
    .from('vd_orders')
    .select('id, refund_balance, currency')
    .eq('booking_id', booking.id)
  if (error) throw error

  let settled = 0
  for (const row of (data ?? []) as { id: string; refund_balance: number }[]) {
    const amount = Number(row.refund_balance) || 0
    if (amount <= 0) continue
    const { error: rpcError } = await supabase.rpc('vd_settle_cancelled_order', {
      p_order_id: row.id,
      p_mode: input.mode,
      p_amount: amount,
      p_method: input.method ?? 'card',
      p_reference: input.reference ?? '',
      p_notes: input.notes ?? '',
    })
    if (rpcError) throw rpcError
    settled += amount
  }

  if (settled > 0 && booking.userId) {
    const body = input.mode === 'credit'
      ? `${formatMoney(settled)} has been added to your account as credit towards a future booking.`
      : `Your refund of ${formatMoney(settled)} has been processed. It can take up to 5 business days to reach your account.`
    await notify(booking.userId, 'payment',
      input.mode === 'credit' ? `Credit issued for ${booking.reference}` : `Refund issued for ${booking.reference}`,
      body, '/account').catch(err => console.error('[guest-credit] notify failed:', err))
  }
  return settled
}

/** The signed-in guest's account credit balance. 0 when there is none. */
export async function getMyCreditBalance(): Promise<number> {
  try {
    const { data } = await supabase.rpc('vd_my_credit_balance')
    return Number(data) || 0
  } catch {
    return 0
  }
}
