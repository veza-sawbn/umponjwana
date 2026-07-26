import { supabase } from './auth'
import type { SavedBooking } from './bookings'
import { getPropertyById } from './properties'
import { sendReceiptEmail } from './order-payments'

// ─────────────────────────────────────────────────────────────────────────────
// Master Orders — the single source of truth for a trip's finances.
//
//   Customer → Trip → Master Order → Order Line Items → Supplier Allocation
//   → Invoice → Payments → Supplier Settlements → Receipts → Reporting
//
// The Master Order belongs to Visit Drakensberg, never to a supplier.
// Suppliers only ever see their own order lines (enforced by RLS on
// vd_order_lines); customers see their order + single invoice; internal
// staff see everything. All writes go through SECURITY DEFINER RPCs so
// allocation math and ledger entries are computed server-side.
// ─────────────────────────────────────────────────────────────────────────────

export type OrderLineInput = {
  supplierId?: string | null
  supplierName?: string
  category: string        // accommodation|activity|tour|hike|event|shuttle|equipment|permit|levy|donation|meal|package|extra
  productId?: string
  title: string
  serviceDate?: string
  endDate?: string
  guests?: number
  quantity: number
  unitLabel?: string
  unitPrice: number
  grossAmount?: number
  discountAmount?: number
  commissionRate?: number   // suggestion only — supplier terms win server-side
  shareCustomerName?: boolean
  value?: Record<string, unknown>
}

export type MasterOrder = {
  id: string
  order_number: string
  user_id: string
  booking_id: string | null
  customer_name: string
  customer_email: string
  trip_name: string
  destination: string
  trip_status: string
  booking_status: string
  payment_status: string
  supplier_status: string
  financial_status: string
  currency: string
  tax_rate: number
  travel_start: string | null
  travel_end: string | null
  total_value: number
  subtotal: number
  service_fee: number
  tax_amount: number
  deposit_amount: number
  amount_paid: number
  outstanding_balance: number
  refund_balance: number
  value: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type OrderLine = {
  id: string
  order_id: string
  order_number: string
  user_id: string
  supplier_id: string | null
  supplier_name: string
  category: string
  product_id: string | null
  title: string
  service_date: string | null
  end_date: string | null
  guests: number | null
  quantity: number
  unit_label: string
  unit_price: number
  gross_amount: number
  discount_amount: number
  tax_amount: number
  commission_rate: number
  commission_amount: number
  service_fee: number
  platform_fee: number
  supplier_share: number
  platform_share: number
  payment_status: string
  fulfilment_status: string
  settlement_id: string | null
  settlement_status: string
  settled_at: string | null
  payout_reference: string | null
  share_customer_name: boolean
  customer_name: string
  currency: string
  destination: string
  value: Record<string, unknown>
  created_at: string
}

export type OrderNote = {
  id: string
  order_id: string
  author: string
  note: string
  created_at: string
}

export type CreateOrderInput = {
  bookingId?: string
  /** Staff-only: order for a walk-in/phone customer with no account. */
  guest?: boolean
  customerName: string
  customerEmail: string
  tripName: string
  destination?: string
  currency?: string
  travelStart?: string
  travelEnd?: string
  subtotal: number
  serviceFee: number
  taxAmount: number
  total: number
  depositAmount?: number
  value?: Record<string, unknown>
}

export type CreateOrderResult = {
  orderId: string
  orderNumber: string
  invoiceId: string
  invoiceNumber: string
}

/** Create a Master Order (+ lines, invoice, ledger and optional payment) atomically. */
export async function createOrder(
  order: CreateOrderInput,
  lines: OrderLineInput[],
  opts?: {
    invoiceLines?: Array<{ title: string; category?: string; quantity: number; unitLabel?: string; unitPrice: number; total: number }>
    payment?: { amount: number; type?: string; method?: string; reference?: string }
    userId?: string
  },
): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc('vd_create_order', {
    p_order: order,
    p_lines: lines,
    p_invoice_lines: opts?.invoiceLines ?? null,
    p_payment: opts?.payment ?? null,
    p_user_id: opts?.userId ?? null,
  })
  if (error) throw new Error(error.message || 'Order creation failed')
  const result = data as CreateOrderResult
  // Orders created with an initial payment (checkout, packages) get their
  // receipt emailed straight away.
  if (opts?.payment && opts.payment.amount > 0) sendReceiptEmail(result.orderId)
  return result
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Translate a checkout booking into Master Order line items. Every trip
 * component — stay, activities, tours, event tickets, shuttle — becomes an
 * independent financial object allocated to one supplier.
 */
export async function buildOrderLinesFromBooking(booking: SavedBooking): Promise<OrderLineInput[]> {
  const lines: OrderLineInput[] = []

  if (booking.stay) {
    let supplierId: string | null = null
    let supplierName = booking.stay.title
    if (booking.stay.id?.startsWith('prop-')) {
      try {
        const prop = await getPropertyById(booking.stay.id)
        if (prop?.supplierId && UUID_RE.test(prop.supplierId)) supplierId = prop.supplierId
      } catch {}
    }
    lines.push({
      supplierId,
      supplierName,
      category: 'accommodation',
      productId: booking.stay.id,
      title: booking.stay.roomName ? `${booking.stay.title} — ${booking.stay.roomName}` : booking.stay.title,
      serviceDate: booking.checkIn,
      endDate: booking.checkOut,
      guests: booking.guests,
      quantity: booking.nights || 1,
      unitLabel: 'night',
      unitPrice: booking.stay.price_per_night,
      grossAmount: booking.stay.price_per_night * booking.nights,
    })
  }

  for (const a of booking.addons) {
    lines.push({
      supplierId: a.supplierId && UUID_RE.test(a.supplierId) ? a.supplierId : null,
      supplierName: a.operator || 'Visit Drakensberg',
      category: a.type, // activity | hike | tour | event
      productId: a.id,
      title: a.title,
      serviceDate: a.date,
      guests: a.guests,
      quantity: a.guests || 1,
      unitLabel: 'guest',
      unitPrice: a.price_per_person,
      grossAmount: a.price_per_person * a.guests,
    })
  }

  for (const shuttle of booking.shuttles) {
    lines.push({
      supplierName: 'Visit Drakensberg',
      category: 'shuttle',
      productId: shuttle.id,
      title: shuttle.label,
      serviceDate: shuttle.date || booking.checkIn,
      quantity: 1,
      unitLabel: 'trip',
      unitPrice: shuttle.price,
      grossAmount: shuttle.price,
      value: {
        pickup: shuttle.pickup,
        destination: shuttle.destination,
        passengers: shuttle.passengers,
      },
    })
  }

  return lines
}

/**
 * Checkout hook: create the Master Order for a just-saved booking, including
 * the customer's single invoice and the payment taken at checkout.
 */
export async function createOrderForBooking(booking: SavedBooking): Promise<CreateOrderResult> {
  const lines = await buildOrderLinesFromBooking(booking)
  return createOrder(
    {
      bookingId: booking.id,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      tripName: `${booking.region || 'Drakensberg'} trip — ${booking.reference}`,
      travelStart: booking.checkIn || undefined,
      travelEnd: booking.checkOut || undefined,
      subtotal: booking.subtotal,
      serviceFee: booking.serviceFee,
      taxAmount: booking.vat,
      total: booking.total,
      value: { reference: booking.reference, guests: booking.guests },
    },
    lines,
    {
      payment: booking.status === 'confirmed' && booking.total > 0
        ? { amount: booking.total, type: 'payment', method: 'card', reference: booking.reference }
        : undefined,
    },
  )
}

/** Cancel the financial side of an order when its booking is cancelled. */
export async function cancelOrderForBooking(bookingId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('vd_orders').select('id').eq('booking_id', bookingId)
    for (const row of data ?? []) {
      await supabase.rpc('vd_cancel_order', { p_order_id: (row as { id: string }).id })
    }
  } catch (err) {
    console.error('Order cancellation failed:', err)
  }
}

// ── Queries (RLS scopes rows: customers see their own, staff see all) ───────

export async function getOrders(): Promise<MasterOrder[]> {
  try {
    const { data } = await supabase
      .from('vd_orders').select('*').order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as MasterOrder[]
  } catch {}
  return []
}

export async function getOrderById(id: string): Promise<MasterOrder | null> {
  try {
    const { data } = await supabase.from('vd_orders').select('*').eq('id', id).maybeSingle()
    if (data) return data as MasterOrder
  } catch {}
  return null
}

export async function getOrderLines(orderId: string): Promise<OrderLine[]> {
  try {
    const { data } = await supabase
      .from('vd_order_lines').select('*').eq('order_id', orderId).order('created_at')
    if (Array.isArray(data)) return data as OrderLine[]
  } catch {}
  return []
}

export async function getAllOrderLines(): Promise<OrderLine[]> {
  try {
    const { data } = await supabase
      .from('vd_order_lines').select('*').order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as OrderLine[]
  } catch {}
  return []
}

/** Supplier portal: only the lines allocated to the signed-in supplier. */
export async function getMyOrderLines(): Promise<OrderLine[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('vd_order_lines').select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as OrderLine[]
  } catch {}
  return []
}

/** Admin: update operational status fields directly (RLS admin policy). */
export async function updateOrderStatus(
  id: string,
  patch: Partial<Pick<MasterOrder, 'trip_status' | 'booking_status' | 'supplier_status' | 'financial_status'>>,
): Promise<void> {
  const { error } = await supabase
    .from('vd_orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Admin: recompute a line's supplier/platform allocation server-side. */
export async function updateLineAllocation(
  lineId: string,
  patch: { commissionRate?: number; platformFee?: number; discount?: number },
): Promise<void> {
  const { error } = await supabase.rpc('vd_update_line_allocation', {
    p_line_id: lineId,
    p_commission_rate: patch.commissionRate ?? null,
    p_platform_fee: patch.platformFee ?? null,
    p_discount: patch.discount ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Supplier or ops: progress a line's fulfilment. */
export async function setLineFulfilment(lineId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('vd_set_line_fulfilment', {
    p_line_id: lineId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}

// ── Internal notes (staff only — customers and suppliers can never read) ────

export async function getOrderNotes(orderId: string): Promise<OrderNote[]> {
  try {
    const { data } = await supabase
      .from('vd_order_notes').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as OrderNote[]
  } catch {}
  return []
}

export async function addOrderNote(orderId: string, note: string, author: string): Promise<void> {
  const { error } = await supabase.from('vd_order_notes').insert({
    id: `note-${crypto.randomUUID()}`,
    order_id: orderId,
    author,
    note,
  })
  if (error) throw error
}
