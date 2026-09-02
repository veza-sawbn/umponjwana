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
}

// A real, server-rendered PDF document — not a browser print of the on-screen
// page. @react-pdf/renderer lays this out itself (a Yoga flexbox engine, not
// Chrome), so there is no site chrome to bleed in, no address-bar/date/
// page-count footer a browser might add, and no per-visitor print-dialog
// setting that changes the result. Sticking to the built-in Helvetica family
// means no font file has to be fetched at render time — nothing for a cold
// serverless invocation to wait on or fail to reach.

const GREEN = '#2d6a4f'
const GOLD = '#8B6914'
const GOLD_BG = '#F6F1E7'
const GRAY_900 = '#1a1a1a'
const GRAY_600 = '#525252'
const GRAY_400 = '#9ca3af'
const GRAY_200 = '#e5e7eb'
const RED = '#dc2626'
const RED_BG = '#fef2f2'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: GRAY_900,
  },
  label: { fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', color: GRAY_400, marginBottom: 4 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: GRAY_200, borderBottomStyle: 'solid' },
  businessName: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: GRAY_900, marginBottom: 6 },
  businessLine: { fontSize: 8.5, color: GRAY_400, lineHeight: 1.5 },
  invoiceEyebrow: { fontSize: 8, letterSpacing: 1.6, textTransform: 'uppercase', color: GOLD, marginBottom: 3, textAlign: 'right' },
  invoiceNumber: { fontFamily: 'Helvetica-BoldOblique', fontSize: 20, color: GRAY_900, textAlign: 'right' },
  issued: { fontSize: 8.5, color: GRAY_400, marginTop: 4, textAlign: 'right' },
  statusPill: { fontSize: 7.5, letterSpacing: 0.8, textTransform: 'uppercase', paddingVertical: 3, paddingHorizontal: 7, marginTop: 6, alignSelf: 'flex-end' },

  // Bill to / trip
  billTrip: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: GRAY_200, borderBottomStyle: 'solid' },
  billCol: { width: '48%' },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: GRAY_900, marginBottom: 2 },
  muted: { fontSize: 8.5, color: GRAY_600 },
  mutedSmall: { fontSize: 8, color: GRAY_400, marginTop: 2 },

  // Table
  table: { marginTop: 18, marginBottom: 4 },
  thead: { flexDirection: 'row', borderBottomWidth: 1.4, borderBottomColor: GRAY_900, borderBottomStyle: 'solid', paddingBottom: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: GRAY_200, borderBottomStyle: 'solid', paddingVertical: 8 },
  th: { fontSize: 7.5, letterSpacing: 0.8, textTransform: 'uppercase', color: GRAY_600 },
  colService: { flex: 1, paddingRight: 10 },
  colQty: { width: 70, textAlign: 'right' },
  colPrice: { width: 80, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },
  lineTitle: { fontSize: 9.5, color: GRAY_900 },
  lineDesc: { fontSize: 8, color: GRAY_600, marginTop: 2 },
  lineCategory: { fontSize: 7.5, color: GRAY_400, marginTop: 2, textTransform: 'capitalize' },
  cellText: { fontSize: 9, color: GRAY_600 },
  cellTextStrong: { fontSize: 9, color: GRAY_900 },

  // Totals
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  totalsBox: { width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsMuted: { fontSize: 9, color: GRAY_600 },
  totalsFinal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.4, borderTopColor: GRAY_900, borderTopStyle: 'solid', marginTop: 4, paddingTop: 6 },
  totalsFinalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: GRAY_900 },
  totalsFinalValue: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: GRAY_900 },
  totalsPaid: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsPaidText: { fontSize: 9, color: GREEN },
  totalsDue: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsDueText: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: GRAY_900 },

  // Sections below totals
  section: { marginTop: 24, paddingTop: 14, borderTopWidth: 1, borderTopColor: GRAY_200, borderTopStyle: 'solid' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  receiptText: { fontSize: 8, color: GRAY_600 },
  eftGrid: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: 320 },
  eftPair: { flexDirection: 'row', width: '100%', paddingVertical: 1.5 },
  eftLabel: { width: 110, fontSize: 8, color: GRAY_400 },
  eftValue: { fontSize: 8, color: GRAY_600 },
  footerNote: { fontSize: 8, color: GRAY_400, lineHeight: 1.5, marginTop: 14 },
  closingNote: { fontSize: 8, color: GRAY_400, lineHeight: 1.5, marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: GRAY_200, borderTopStyle: 'solid' },
})

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

function statusStyle(status: string) {
  if (status === 'paid') return { backgroundColor: '#E8F1EC', color: GREEN }
  if (status === 'void' || status === 'refunded') return { backgroundColor: RED_BG, color: RED }
  return { backgroundColor: GOLD_BG, color: GOLD }
}

function InvoiceDocument({ invoice, order, receipts, business }: InvoicePdfData) {
  const addressLine = [business.address_line1, business.address_line2, business.city, business.country]
    .filter(Boolean).join(', ') || 'KwaZulu-Natal, South Africa'
  const hasDiscount = Number(invoice.discount) > 0
  const hasEft = Number(invoice.balance) > 0 && !!business.bank_account_number
  const st = statusStyle(invoice.status)

  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ maxWidth: 260 }}>
            <Text style={styles.businessName}>{business.business_name}</Text>
            <Text style={styles.businessLine}>{addressLine}</Text>
            <Text style={styles.businessLine}>{business.email}</Text>
            {business.phone && <Text style={styles.businessLine}>{business.phone}</Text>}
            {business.registration_number && <Text style={styles.businessLine}>Reg. {business.registration_number}</Text>}
            {business.vat_number && <Text style={styles.businessLine}>VAT {business.vat_number}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceEyebrow}>{invoice.status === 'void' ? 'Void Invoice' : 'Tax Invoice'}</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.issued}>Issued {fmtDate(invoice.issued_at)}</Text>
            <Text style={[styles.statusPill, { backgroundColor: st.backgroundColor, color: st.color }]}>
              {invoice.status}
            </Text>
          </View>
        </View>

        {/* Billed to / trip */}
        <View style={styles.billTrip}>
          <View style={styles.billCol}>
            <Text style={styles.label}>Billed To</Text>
            <Text style={styles.name}>{order?.customer_name || '—'}</Text>
            <Text style={styles.muted}>{order?.customer_email}</Text>
          </View>
          <View style={[styles.billCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.label}>Trip</Text>
            <Text style={[styles.muted, { color: GRAY_900 }]}>{order?.trip_name || '—'}</Text>
            <Text style={styles.mutedSmall}>
              Order {order?.order_number}
              {order?.travel_start
                ? ` · ${fmtDate(order.travel_start)}${order.travel_end && order.travel_end !== order.travel_start ? ` — ${fmtDate(order.travel_end)}` : ''}`
                : ''}
            </Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colService]}>Service</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          {invoice.lines.map((l, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <View style={styles.colService}>
                <Text style={styles.lineTitle}>{l.title}</Text>
                {l.description && <Text style={styles.lineDesc}>{l.description}</Text>}
                <Text style={styles.lineCategory}>{l.category}</Text>
              </View>
              <Text style={[styles.cellText, styles.colQty]}>
                {Number(l.quantity)} {l.unitLabel}{Number(l.quantity) !== 1 ? 's' : ''}
              </Text>
              <Text style={[styles.cellText, styles.colPrice]}>{formatMoney(Number(l.unitPrice), invoice.currency)}</Text>
              <Text style={[styles.cellTextStrong, styles.colAmount]}>{formatMoney(Number(l.total), invoice.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totalsBox}>
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
              <Text style={styles.totalsMuted}>VAT</Text>
              <Text style={styles.totalsMuted}>{formatMoney(Number(invoice.tax_amount), invoice.currency)}</Text>
            </View>
            <View style={styles.totalsFinal}>
              <Text style={styles.totalsFinalLabel}>Total</Text>
              <Text style={styles.totalsFinalValue}>{formatMoney(Number(invoice.total), invoice.currency)}</Text>
            </View>
            <View style={styles.totalsPaid}>
              <Text style={styles.totalsPaidText}>Amount paid</Text>
              <Text style={styles.totalsPaidText}>{formatMoney(Number(invoice.amount_paid), invoice.currency)}</Text>
            </View>
            <View style={styles.totalsDue}>
              <Text style={styles.totalsDueText}>Balance due</Text>
              <Text style={styles.totalsDueText}>{formatMoney(Number(invoice.balance), invoice.currency)}</Text>
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
            <View style={styles.eftGrid}>
              {business.bank_name && (
                <View style={styles.eftPair}><Text style={styles.eftLabel}>Bank</Text><Text style={styles.eftValue}>{business.bank_name}</Text></View>
              )}
              {business.bank_account_holder && (
                <View style={styles.eftPair}><Text style={styles.eftLabel}>Account holder</Text><Text style={styles.eftValue}>{business.bank_account_holder}</Text></View>
              )}
              <View style={styles.eftPair}><Text style={styles.eftLabel}>Account number</Text><Text style={styles.eftValue}>{business.bank_account_number}</Text></View>
              {business.bank_branch_code && (
                <View style={styles.eftPair}><Text style={styles.eftLabel}>Branch code</Text><Text style={styles.eftValue}>{business.bank_branch_code}</Text></View>
              )}
              <View style={styles.eftPair}><Text style={styles.eftLabel}>Reference</Text><Text style={styles.eftValue}>{invoice.invoice_number}</Text></View>
            </View>
          </View>
        )}

        {business.invoice_footer_note && <Text style={styles.footerNote}>{business.invoice_footer_note}</Text>}

        <Text style={styles.closingNote}>
          This invoice covers all services in your trip, arranged through {business.business_name}.
          Payments reconcile against order {order?.order_number}. Thank you for exploring the Drakensberg with us.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...data} />)
}
