import type { MasterOrder } from './orders'

// ─────────────────────────────────────────────────────────────────────────────
// "Next step" — turns the several independent status columns every journey
// object already carries (payment, supplier, fulfilment…) into the single
// question a staff member actually has: what do I do about this one, now?
//
// This is deliberately a pure function over data the console already loads —
// no new tables, no new fetches. Each admin list/detail view that shows a
// journey object (orders today; quotes and custom-trip requests are natural
// next callers — see HANDOFF.md) asks it "what's next" and renders the
// answer instead of making staff cross-reference three badges themselves.
// ─────────────────────────────────────────────────────────────────────────────

export type StepUrgency = 'urgent' | 'attention' | 'info' | 'done'

export type NextStep = {
  label: string
  detail: string
  urgency: StepUrgency
}

const URGENCY_ORDER: Record<StepUrgency, string> = {
  urgent: 'bg-red-50 text-red-600 border-red-200',
  attention: 'bg-[#C9A96E]/15 text-[#8B6914] border-[#C9A96E]/30',
  info: 'bg-blue-50 text-blue-600 border-blue-100',
  done: 'bg-[#2d6a4f]/8 text-[#2d6a4f] border-[#2d6a4f]/15',
}

/** Tailwind classes for a NextStep badge — kept alongside the type so every caller renders it the same way. */
export function nextStepBadgeClass(urgency: StepUrgency): string {
  return URGENCY_ORDER[urgency]
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

/** Escalate to 'urgent' when travel is imminent and the step isn't already resolved. */
function withUrgency(step: NextStep, travelStart: string | null): NextStep {
  if (step.urgency === 'done' || step.urgency === 'urgent') return step
  const days = daysUntil(travelStart)
  if (days !== null && days >= 0 && days <= 3) {
    return { ...step, urgency: 'urgent', detail: `${step.detail} Travel starts in ${days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`}.` }
  }
  return step
}

/** What should staff do about this Master Order right now? */
export function getOrderNextStep(order: MasterOrder): NextStep {
  if (order.booking_status === 'cancelled') {
    return { label: 'Cancelled', detail: 'No action needed.', urgency: 'done' }
  }
  if (order.financial_status === 'written_off') {
    return { label: 'Written off', detail: 'Closed out of the collections cycle.', urgency: 'done' }
  }

  const balance = Number(order.outstanding_balance)

  if (order.payment_status === 'unpaid' && balance > 0) {
    return withUrgency({
      label: 'Collect payment',
      detail: 'No payment received yet — send or re-send the invoice, or follow up with the customer.',
      urgency: 'attention',
    }, order.travel_start)
  }

  if ((order.payment_status === 'deposit' || order.payment_status === 'partial') && balance > 0) {
    return withUrgency({
      label: 'Follow up for balance',
      detail: `A balance is still outstanding on this order.`,
      urgency: 'attention',
    }, order.travel_start)
  }

  if (order.supplier_status === 'pending') {
    return withUrgency({
      label: 'Confirm with supplier',
      detail: 'Payment is in — the allocated supplier(s) still need to confirm they can deliver.',
      urgency: 'attention',
    }, order.travel_start)
  }

  if (order.supplier_status === 'partially_confirmed') {
    return withUrgency({
      label: 'Chase remaining suppliers',
      detail: 'Some but not all suppliers on this order have confirmed.',
      urgency: 'attention',
    }, order.travel_start)
  }

  if (order.trip_status === 'completed' && order.financial_status === 'open') {
    return { label: 'Close out', detail: 'Trip is done — settle supplier payouts and close the order.', urgency: 'info' }
  }

  if (order.trip_status === 'in_progress') {
    return { label: 'Trip underway', detail: 'Monitor fulfilment until the trip completes.', urgency: 'info' }
  }

  return { label: 'On track', detail: 'Paid and confirmed — nothing needs staff action right now.', urgency: 'done' }
}

/** What should staff do about a sales quote right now? Mirrors getOrderNextStep's shape for a consistent console feel. */
export function getQuoteNextStep(quote: { status: string; valid_until: string | null; sent_at: string | null }): NextStep {
  switch (quote.status) {
    case 'draft':
      return { label: 'Send it', detail: 'Still a draft — the customer has not seen this quote yet.', urgency: 'attention' }
    case 'sent': {
      const days = daysUntil(quote.valid_until)
      if (days !== null && days < 0) return { label: 'Expired', detail: 'Past its valid-until date — reissue or follow up.', urgency: 'attention' }
      if (days !== null && days <= 2) return { label: 'Follow up', detail: 'Sent and about to expire with no response.', urgency: 'urgent' }
      return { label: 'Awaiting response', detail: 'Sent — waiting on the customer to accept or decline.', urgency: 'info' }
    }
    case 'converted':
      return { label: 'Now an order', detail: 'Accepted — track it from here on in Orders.', urgency: 'done' }
    case 'declined':
      return { label: 'Declined', detail: 'Customer declined this quote.', urgency: 'done' }
    case 'expired':
      return { label: 'Expired', detail: 'Never accepted — reissue if the customer is still interested.', urgency: 'info' }
    default:
      return { label: 'Review', detail: '', urgency: 'info' }
  }
}
