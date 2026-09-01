import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { publicSupabase } from '@/lib/supabase-public'
import { renderInvoicePdf, BUSINESS_DETAILS_DEFAULTS } from '@/lib/invoice-pdf'
import type { Invoice, InvoiceCustomerOrder, Receipt } from '@/lib/invoices'

export const dynamic = 'force-dynamic'

// Serves the invoice as an actual generated PDF — @react-pdf/renderer lays
// it out itself, so there's no browser print pipeline in the way: no site
// nav bar or trip-cart bar to bleed in, no address-bar/date/page-count
// footer a browser might add on top, no per-visitor print-dialog setting
// that changes the result page to page.
//
// Mirrors the invoice page's own access chain (app/invoices/[id]/page.tsx):
// the public RPC first — this is the path every customer takes, most of
// whom have no account — then a share token, then the signed-in RLS path
// for staff pulling an invoice up by its number.

type Shared = { invoice: Invoice; order: InvoiceCustomerOrder | null; receipts: Receipt[] }

function asShared(data: unknown): Shared | null {
  if (!data || !(data as { invoice?: Invoice }).invoice) return null
  const bundle = data as { invoice: Invoice; order: InvoiceCustomerOrder | null; receipts: Receipt[] }
  return { invoice: bundle.invoice, order: bundle.order ?? null, receipts: Array.isArray(bundle.receipts) ? bundle.receipts : [] }
}

async function loadShared(id: string, token: string | null): Promise<Shared | null> {
  const { data } = await publicSupabase.rpc('vd_invoice_public', { p_ref: id })
  const shared = asShared(data)
  if (shared) return shared
  if (!token) return null
  const { data: byToken } = await publicSupabase.rpc('vd_invoice_by_token', { p_token: token })
  return asShared(byToken)
}

/** Staff fallback: signed-in RLS path, looked up by id, invoice number, or order id. */
async function loadAuthed(id: string): Promise<Shared | null> {
  const supabase = createRouteHandlerClient({ cookies })
  let invoice: Invoice | null = null
  for (const filter of [{ id }, { invoice_number: id }, { order_id: id }] as const) {
    const { data } = await supabase.from('vd_invoices').select('*').match(filter).maybeSingle()
    if (data) { invoice = data as Invoice; break }
  }
  if (!invoice) return null

  const [{ data: order }, { data: receipts }] = await Promise.all([
    supabase.from('vd_orders')
      .select('order_number, customer_name, customer_email, trip_name, travel_start, travel_end, currency')
      .eq('id', invoice.order_id).maybeSingle(),
    supabase.from('vd_receipts').select('*').eq('order_id', invoice.order_id).order('created_at', { ascending: false }),
  ])
  return { invoice, order: (order as InvoiceCustomerOrder) ?? null, receipts: Array.isArray(receipts) ? (receipts as Receipt[]) : [] }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id)
  const token = new URL(req.url).searchParams.get('t')

  const shared = (await loadShared(id, token)) ?? (await loadAuthed(id))
  if (!shared) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data: contentRow } = await publicSupabase.from('site_content').select('value').eq('key', 'business_details').maybeSingle()
  const business = { ...BUSINESS_DETAILS_DEFAULTS, ...(contentRow?.value as object | undefined) }

  const pdf = await renderInvoicePdf({ invoice: shared.invoice, order: shared.order, receipts: shared.receipts, business })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Invoice-${shared.invoice.invoice_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
