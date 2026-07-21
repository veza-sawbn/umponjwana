import { supabase } from './auth'

/* ────────────────────────────────────────────────────────────────────────────
 * Communications Hub — reusable reply templates with placeholders.
 * Templates are staff content (no customer PII) stored in the CMS-scoped
 * `site_content` table under `admin_message_templates`. Placeholders like
 * {{CustomerName}} are filled from the active conversation + CRM profile.
 * ──────────────────────────────────────────────────────────────────────────── */

export type MessageTemplate = {
  id: string
  name: string
  category: string
  body: string
}

export const TEMPLATE_PLACEHOLDERS = [
  'CustomerName', 'FirstName', 'BookingReference', 'InvoiceNumber',
  'OrderNumber', 'ArrivalDate', 'DepartureDate', 'Destination',
  'OutstandingBalance', 'TotalValue', 'ConsultantName',
] as const

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  { id: 'tpl-greeting', name: 'Greeting', category: 'General',
    body: 'Hi {{FirstName}}, thank you for reaching out to Visit Drakensberg! I\'m {{ConsultantName}} and I\'ll be helping you plan your trip. What dates are you looking at?' },
  { id: 'tpl-quote-followup', name: 'Quotation Follow-up', category: 'Sales',
    body: 'Hi {{FirstName}}, just following up on the quote I sent through for your {{Destination}} trip. Do you have any questions, or shall I hold the dates for you?' },
  { id: 'tpl-payment-reminder', name: 'Payment Reminder', category: 'Finance',
    body: 'Hi {{FirstName}}, a friendly reminder that an outstanding balance of {{OutstandingBalance}} is due on booking {{BookingReference}}. You can pay securely via the link in your customer portal.' },
  { id: 'tpl-booking-confirmation', name: 'Booking Confirmation', category: 'Bookings',
    body: 'Great news {{FirstName}} — your booking {{BookingReference}} to {{Destination}} is confirmed! Arrival: {{ArrivalDate}}. Your full itinerary and invoice are attached.' },
  { id: 'tpl-permit-request', name: 'Permit Request', category: 'Operations',
    body: 'Hi {{FirstName}}, to arrange your hiking permits we\'ll need a copy of each hiker\'s ID/passport. Could you send those through when convenient?' },
  { id: 'tpl-thank-you', name: 'Thank You', category: 'Post-trip',
    body: 'Hi {{FirstName}}, thank you for travelling with Visit Drakensberg! We hope {{Destination}} was everything you hoped for. It was a pleasure arranging your trip.' },
  { id: 'tpl-review-request', name: 'Review Request', category: 'Post-trip',
    body: 'Hi {{FirstName}}, we\'d love to hear about your trip! If you have a moment, a quick review really helps other travellers — and helps us keep improving.' },
  { id: 'tpl-trip-reminder', name: 'Trip Reminder', category: 'Bookings',
    body: 'Hi {{FirstName}}, your Drakensberg trip is almost here! Arrival is {{ArrivalDate}}. A reminder to pack layers, sun protection and broken-in hiking boots. Shout if you need anything.' },
  { id: 'tpl-cancellation', name: 'Cancellation Notice', category: 'Bookings',
    body: 'Hi {{FirstName}}, we\'ve processed the cancellation of booking {{BookingReference}}. Any applicable refund will follow per our policy. We hope to welcome you another time.' },
]

export function applyTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (vars[key] ?? `{{${key}}}`))
}

export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  try {
    const { data } = await supabase.from('site_content').select('value').eq('key', 'admin_message_templates').maybeSingle()
    if (Array.isArray(data?.value?.items) && data.value.items.length > 0) return data.value.items as MessageTemplate[]
  } catch {}
  return DEFAULT_TEMPLATES
}

export async function saveMessageTemplates(items: MessageTemplate[]): Promise<void> {
  const { error } = await supabase.from('site_content').upsert(
    { key: 'admin_message_templates', value: { items }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw error
}
