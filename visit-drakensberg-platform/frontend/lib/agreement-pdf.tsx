import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import {
  SUPPLIER_TERMS_SECTIONS, CODE_OF_CONDUCT_SECTIONS,
  AGREEMENT_LABEL, type AgreementDocument, type LegalSection,
} from './supplier-agreement-content'

// SERVER ONLY — rendered from app/api/*/route.ts handlers.
//
// Produces the countersigned-looking record of what a supplier accepted: the
// full text of the document at the version they accepted, preceded by an
// acceptance block naming who accepted it, when, and on what commercial terms.
//
// Imports only ./supplier-agreement-content, never ./supplier-agreement — the
// latter builds the browser Supabase client on import (lib/auth.ts), which
// must not happen inside a Node serverless function. Same constraint, and the
// same reason, as lib/invoice-pdf.tsx.

const COLORS = {
  forest: '#1d3d2f',
  green: '#2d6a4f',
  gold: '#C9A96E',
  text: '#22262b',
  muted: '#6b7280',
  line: '#e5e7eb',
}

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, fontSize: 9.5, color: COLORS.text, lineHeight: 1.55 },

  header: { borderBottomWidth: 2, borderBottomColor: COLORS.forest, paddingBottom: 12, marginBottom: 18 },
  brand: { fontSize: 14, color: COLORS.forest, fontWeight: 'bold', letterSpacing: 0.4 },
  brandSub: { fontSize: 7.5, color: COLORS.gold, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 3 },
  docTitle: { fontSize: 17, color: COLORS.forest, marginTop: 14, fontWeight: 'bold' },
  docMeta: { fontSize: 8, color: COLORS.muted, marginTop: 4 },

  acceptBox: { borderWidth: 1, borderColor: COLORS.green, backgroundColor: '#f2f7f4', padding: 12, marginBottom: 20 },
  acceptTitle: { fontSize: 8, color: COLORS.green, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, fontWeight: 'bold' },
  row: { flexDirection: 'row', marginBottom: 3 },
  rowKey: { width: 108, fontSize: 8.5, color: COLORS.muted },
  rowVal: { flex: 1, fontSize: 8.5, color: COLORS.text },

  notAccepted: { borderWidth: 1, borderColor: '#f0b100', backgroundColor: '#fffbeb', padding: 12, marginBottom: 20 },
  notAcceptedText: { fontSize: 8.5, color: '#854d0e', lineHeight: 1.5 },

  section: { marginBottom: 13 },
  heading: { fontSize: 10.5, color: COLORS.forest, fontWeight: 'bold', marginBottom: 5 },
  para: { fontSize: 9.5, marginBottom: 5, textAlign: 'justify' },
  bulletRow: { flexDirection: 'row', marginBottom: 3.5, paddingLeft: 4 },
  bulletMark: { width: 12, fontSize: 9.5, color: COLORS.gold },
  bulletText: { flex: 1, fontSize: 9.5, textAlign: 'justify' },

  footer: {
    position: 'absolute', bottom: 26, left: 48, right: 48,
    borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 7,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: COLORS.muted },
})

export type AgreementPdfAcceptance = {
  document: AgreementDocument
  version: string
  acceptedName: string
  acceptedEmail: string
  acceptedRole: string
  acceptedAt: string
  acceptedTerms: Record<string, unknown>
}

export type AgreementPdfData = {
  document: AgreementDocument
  /** The supplier this copy is for, as we hold them. */
  supplierName: string
  supplierEmail: string
  /** Absent when nothing was recorded — the PDF says so rather than implying acceptance. */
  acceptance: AgreementPdfAcceptance | null
  /** Version rendered, which is the accepted version when there is one. */
  version: string
  siteUrl: string
  generatedAt: string
}

function sectionsFor(document: AgreementDocument): LegalSection[] {
  return document === 'supplier_terms' ? SUPPLIER_TERMS_SECTIONS : CODE_OF_CONDUCT_SECTIONS
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} at ${
    d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })} (SAST)`
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={styles.rowVal}>{v || '—'}</Text>
    </View>
  )
}

function AcceptanceBlock({ data }: { data: AgreementPdfData }) {
  const a = data.acceptance
  if (!a) {
    return (
      <View style={styles.notAccepted}>
        <Text style={styles.notAcceptedText}>
          No acceptance of this document is recorded for {data.supplierName}. This copy is provided for reference
          only and is not evidence that these terms were agreed. An acceptance is recorded when a supplier submits
          the listing application, or accepts a re-issued document.
        </Text>
      </View>
    )
  }

  const rate = a.acceptedTerms?.commissionRate
  const tierName = a.acceptedTerms?.tierName
  const commission = typeof rate === 'number'
    ? `${tierName ? `${String(tierName)} — ` : ''}${rate}% total platform fee`
    : ''

  return (
    <View style={styles.acceptBox}>
      <Text style={styles.acceptTitle}>Record of acceptance</Text>
      <Row k="Supplier" v={data.supplierName} />
      <Row k="Accepted by" v={[a.acceptedName, a.acceptedRole].filter(Boolean).join(' · ')} />
      <Row k="Email" v={a.acceptedEmail || data.supplierEmail} />
      <Row k="Document" v={`${AGREEMENT_LABEL[a.document]}, version ${a.version}`} />
      <Row k="Accepted on" v={formatDateTime(a.acceptedAt)} />
      {commission ? <Row k="Commission" v={commission} /> : null}
    </View>
  )
}

function Section({ s }: { s: LegalSection }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.heading}>{s.heading}</Text>
      {s.body.map((p, i) => <Text key={i} style={styles.para}>{p}</Text>)}
      {s.list?.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletMark}>—</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

function AgreementDocumentPdf(data: AgreementPdfData) {
  const label = AGREEMENT_LABEL[data.document]
  return (
    <Document title={`${label} — ${data.supplierName}`} author="Visit Drakensberg">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Visit Drakensberg</Text>
          <Text style={styles.brandSub}>Supplier Documents</Text>
          <Text style={styles.docTitle}>{label}</Text>
          <Text style={styles.docMeta}>
            Version {data.version} · Issued to {data.supplierName} · Generated {formatDate(data.generatedAt)}
          </Text>
        </View>

        <AcceptanceBlock data={data} />

        {sectionsFor(data.document).map(s => <Section key={s.heading} s={s} />)}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {label} v{data.version} · {data.siteUrl.replace(/^https?:\/\//, '')}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function renderAgreementPdf(data: AgreementPdfData): Promise<Buffer> {
  return renderToBuffer(<AgreementDocumentPdf {...data} />)
}
