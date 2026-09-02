import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { formatMoney } from './allocation'
// Type-only: pulls in no runtime code, so this stays safe to import from a
// server route — lib/invoices.ts constructs a browser-oriented Supabase
// client (lib/auth.ts) as a module-level side effect, which has no business
// running inside a Node serverless function.
import type { Invoice, InvoiceCustomerOrder, Receipt } from './invoices'

// Mirrors SITE_CONTENT_DEFAULTS.business_details (lib/site-content.ts) —
// duplicated rather than imported so this file, and the PDF route that uses
// it, never has to load lib/site-content.ts's own lib/auth.ts import.
export const BUSINESS_DETAILS_DEFAULTS = {
  business_name: 'Visit Drakensberg',
  registration_number: '',
  vat_number: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postal_code: '',
  country: 'South Africa',
  email: 'bookings@visitdrakensberg.co.za',
  phone: '',
  bank_name: '',
  bank_account_holder: '',
  bank_account_number: '',
  bank_branch_code: '',
  invoice_footer_note: '',
}

type BusinessDetails = typeof BUSINESS_DETAILS_DEFAULTS

export type InvoicePdfData = {
  invoice: Invoice
  order: InvoiceCustomerOrder | null
  receipts: Receipt[]
  business: BusinessDetails
  /** Shown as the "Website" line on the letterhead — the request's own origin, not stored data. */
  siteUrl?: string
}

// A real, server-rendered PDF document — not a browser print of the on-screen
// page. @react-pdf/renderer lays this out itself (a Yoga flexbox engine, not
// Chrome), so there is no site chrome to bleed in, no address-bar/date/
// page-count footer a browser might add, and no per-visitor print-dialog
// setting that changes the result. Sticking to the built-in Helvetica family
// means no font file has to be fetched at render time — nothing for a cold
// serverless invocation to wait on or fail to reach.
//
// Laid out to match the plain, businesslike invoice format the operator
// already sends customers from their invoicing tool — same section
// headings, same table columns, same overall shape — but kept in Visit
// Drakensberg's own green/gold brand colours rather than adopting that
// tool's neutral palette, so this still reads as *our* document.

const INK = '#1a1a1a'
const MUTED = '#4b5563'
const FAINT = '#9ca3af'
const LINE = '#e2e2e2'
const GREEN = '#2d6a4f'
const GOLD = '#8B6914'
const HEAD_BG = '#EAF3EE'
const RED = '#c0392b'

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: INK,
  },
  label: { fontSize: 8, color: FAINT, marginBottom: 4 },
  heading: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: INK, marginBottom: 10 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  businessName: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: INK, marginBottom: 4 },
  businessLine: { fontSize: 9, color: INK, lineHeight: 1.5 },
  website: { fontSize: 9, color: INK, marginTop: 8 },
  invoiceEyebrow: { fontSize: 8, letterSpacing: 1.4, textTransform: 'uppercase', color: GOLD, marginBottom: 3, textAlign: 'right' },
  invoiceNumber: { fontFamily: 'Helvetica-BoldOblique', fontSize: 17, color: INK, textAlign: 'right' },
  issued: { fontSize: 9, color: INK, marginTop: 6, textAlign: 'right' },
  statusPill: { fontSize: 7.5, letterSpacing: 0.6, textTransform: 'uppercase', paddingVertical: 3, paddingHorizontal: 7, marginTop: 6, alignSelf: 'flex-end' },
  divider: { borderBottomWidth: 1, borderBottomColor: LINE, borderBottomStyle: 'solid', marginVertical: 18 },

  // Customer info
  customerBlock: { marginBottom: 20 },
  customerName: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: INK, marginTop: 2 },
  customerLine: { fontSize: 9, color: INK, marginTop: 2 },
  tripLine: { fontSize: 8.5, color: FAINT, marginTop: 6 },

  // Table
  thead: { flexDirection: 'row', backgroundColor: HEAD_BG, paddingVertical: 7, paddingHorizontal: 8 },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: LINE, borderBottomStyle: 'solid', paddingVertical: 10, paddingHorizontal: 8 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: INK },
  colService: { flex: 1, paddingRight: 10 },
  colQty: { width: 60, textAlign: 'right' },
  colPrice: { width: 80, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },
  lineTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: INK },
  lineDesc: { fontSize: 8.5, color: MUTED, marginTop: 3, lineHeight: 1.5 },
  cellText: { fontSize: 9, color: INK },

  // Totals
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  totalsBox: { width: 230 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsMuted: { fontSize: 9, color: MUTED },
  totalsFinal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, borderTopStyle: 'solid', marginTop: 4, paddingTop: 7 },
  totalsFinalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: INK },
  totalsFinalValue: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: INK },
  totalsPaid: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsPaidText: { fontSize: 9, color: GREEN },
  totalsDue: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, borderTopStyle: 'solid', marginTop: 4, paddingTop: 7 },
  totalsDueLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: INK },
  totalsDueValue: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: INK },

  // Sections below totals
  section: { marginTop: 26 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  receiptText: { fontSize: 8.5, color: MUTED },
  eftRow: { flexDirection: 'row', paddingVertical: 2 },
  eftLabel: { width: 110, fontSize: 9, color: FAINT },
  eftValue: { fontSize: 9, color: INK },
  note: { fontSize: 8.5, color: MUTED, lineHeight: 1.6, marginTop: 20 },
  legalHeading: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: INK, marginTop: 22, marginBottom: 8 },
  legalBody: { fontSize: 8, color: MUTED, lineHeight: 1.6 },
})

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

function statusStyle(status: string) {
  if (status === 'paid') return { backgroundColor: '#E6F1EC', color: GREEN }
  if (status === 'void' || status === 'refunded') return { backgroundColor: '#FBEAEA', color: RED }
  return { backgroundColor: '#F6F1E4', color: GOLD }
}

function InvoiceDocument({ invoice, order, receipts, business, siteUrl }: InvoicePdfData) {
  const addressLine = [business.address_line1, business.address_line2, business.city, business.country]
    .filter(Boolean).join(', ') || 'KwaZulu-Natal, South Africa'
  const hasDiscount = Number(invoice.discount) > 0
  const hasEft = Number(invoice.balance) > 0 && !!business.bank_account_number
  const st = statusStyle(invoice.status)
  const website = siteUrl ? siteUrl.replace(/^https?:\/\//, '') : ''

  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>
      <Page size="A4" style={styles.page}>
        {/* Header: business letterhead left, invoice number right */}
        <View style={styles.header}>
          <View style={{ maxWidth: 280 }}>
            <Text style={styles.businessName}>{business.business_name}</Text>
            <Text style={styles.businessLine}>{addressLine}</Text>
            <Text style={styles.businessLine}>{business.email}</Text>
            {!!business.phone && <Text style={styles.businessLine}>Phone: {business.phone}</Text>}
            {!!business.registration_number && <Text style={styles.businessLine}>Company ID: {business.registration_number}</Text>}
            {!!business.vat_number && <Text style={styles.businessLine}>VAT: {business.vat_number}</Text>}
            {!!website && <Text style={styles.website}>Website: {website}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceEyebrow}>{invoice.status === 'void' ? 'Void Invoice' : 'Tax Invoice'}</Text>
            <Text style={styles.invoiceNumber}>Invoice #{invoice.invoice_number}</Text>
            <Text style={styles.issued}>Issue Date: {fmtDate(invoice.issued_at)}</Text>
            <Text style={[styles.statusPill, { backgroundColor: st.backgroundColor, color: st.color }]}>
              {invoice.status === 'void' ? 'Void' : invoice.status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Customer info */}
        <View style={styles.customerBlock}>
          <Text style={styles.label}>Customer Info:</Text>
          <Text style={styles.customerName}>{order?.customer_name || '—'}</Text>
          {!!order?.customer_email && <Text style={styles.customerLine}>{order.customer_email}</Text>}
          <Text style={styles.tripLine}>
            {order?.trip_name ? `${order.trip_name} · ` : ''}Order {order?.order_number}
            {order?.travel_start
              ? ` · ${fmtDate(order.travel_start)}${order.travel_end && order.travel_end !== order.travel_start ? ` — ${fmtDate(order.travel_end)}` : ''}`
              : ''}
          </Text>
        </View>

        {/* Line items */}
        <View>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colService]}>Product or Service</Text>
            <Text style={[styles.th, styles.colQty]}>Quantity</Text>
            <Text style={[styles.th, styles.colPrice]}>Price</Text>
            <Text style={[styles.th, styles.colTotal]}>Line Total</Text>
          </View>
          {invoice.lines.map((l, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <View style={styles.colService}>
                <Text style={styles.lineTitle}>{l.title}</Text>
                {!!l.description && <Text style={styles.lineDesc}>{l.description}</Text>}
              </View>
              <Text style={[styles.cellText, styles.colQty]}>{Number(l.quantity)}</Text>
              <Text style={[styles.cellText, styles.colPrice]}>{formatMoney(Number(l.unitPrice), invoice.currency)}</Text>
              <Text style={[styles.cellText, styles.colTotal]}>{formatMoney(Number(l.total), invoice.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totalsBox}>
            <Text style={styles.heading}>Summary</Text>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsMuted}>Subtotal</Text>
              <Text style={styles.totalsMuted}>{formatMoney(Number(invoice.subtotal), invoice.currency)}</Text>
            </View>
            {hasDiscount && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsMuted}>Discount</Text>
                <Text style={styles.totalsMuted}>−{formatMoney(Number(invoice.discount), invoice.currency)}</Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsMuted}>Service fee</Text>
              <Text style={styles.totalsMuted}>{formatMoney(Number(invoice.service_fee), invoice.currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsMuted}>Tax total</Text>
              <Text style={styles.totalsMuted}>{formatMoney(Number(invoice.tax_amount), invoice.currency)}</Text>
            </View>
            <View style={styles.totalsFinal}>
              <Text style={styles.totalsFinalLabel}>Invoice Total</Text>
              <Text style={styles.totalsFinalValue}>{formatMoney(Number(invoice.total), invoice.currency)}</Text>
            </View>
            <View style={styles.totalsPaid}>
              <Text style={styles.totalsPaidText}>Amount paid</Text>
              <Text style={styles.totalsPaidText}>{formatMoney(Number(invoice.amount_paid), invoice.currency)}</Text>
            </View>
            <View style={styles.totalsDue}>
              <Text style={styles.totalsDueLabel}>Balance Due</Text>
              <Text style={styles.totalsDueValue}>{formatMoney(Number(invoice.balance), invoice.currency)}</Text>
            </View>
          </View>
        </View>

        {/* Receipts */}
        {receipts.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>Payments Received</Text>
            {receipts.map(r => (
              <View style={styles.receiptRow} key={r.id}>
                <Text style={styles.receiptText}>{r.receipt_number} · {fmtDate(r.created_at)} · {r.method}</Text>
                <Text style={styles.receiptText}>
                  {Number(r.amount) < 0
                    ? `−${formatMoney(Math.abs(Number(r.amount)), r.currency)} (refund)`
                    : formatMoney(Number(r.amount), r.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* EFT details */}
        {hasEft && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>Pay by EFT</Text>
            {!!business.bank_name && (
              <View style={styles.eftRow}><Text style={styles.eftLabel}>Bank</Text><Text style={styles.eftValue}>{business.bank_name}</Text></View>
            )}
            {!!business.bank_account_holder && (
              <View style={styles.eftRow}><Text style={styles.eftLabel}>Account holder</Text><Text style={styles.eftValue}>{business.bank_account_holder}</Text></View>
            )}
            <View style={styles.eftRow}><Text style={styles.eftLabel}>Account number</Text><Text style={styles.eftValue}>{business.bank_account_number}</Text></View>
            {!!business.bank_branch_code && (
              <View style={styles.eftRow}><Text style={styles.eftLabel}>Branch code</Text><Text style={styles.eftValue}>{business.bank_branch_code}</Text></View>
            )}
            <View style={styles.eftRow}><Text style={styles.eftLabel}>Reference</Text><Text style={styles.eftValue}>{invoice.invoice_number}</Text></View>
          </View>
        )}

        <Text style={styles.note}>
          This invoice covers all services in your trip, arranged through {business.business_name}.
          Payments reconcile against order {order?.order_number}. Thank you for exploring the Drakensberg with us.
        </Text>

        {/* Legal terms — free text, edited from Admin → Settings → Invoice footer note */}
        {!!business.invoice_footer_note && (
          <View wrap={false}>
            <Text style={styles.legalHeading}>Legal Terms</Text>
            <Text style={styles.legalBody}>{business.invoice_footer_note}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...data} />)
}
