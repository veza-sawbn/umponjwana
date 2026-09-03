'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  AlertTriangle, Check, ExternalLink, FileText, Loader2, RefreshCw, ShieldCheck, X,
} from 'lucide-react'
import {
  getComplianceQueue, complianceDocumentUrl, reviewComplianceDocument,
  expiryState, daysUntilExpiry, isAccreditation, DOC_TYPES, REVIEW_STATUS_LABEL,
  EXPIRY_WARNING_DAYS,
  type ComplianceDocument, type ComplianceReviewStatus,
} from '@/lib/compliance'

// The verification office's standing worklist.
//
// Two kinds of work land here, and they are genuinely different jobs:
//   * Awaiting review — a certificate somebody sent that nobody has opened.
//   * Renewals — something already verified that has lapsed or is about to.
//
// Neither surfaces anywhere else. Per-applicant review happens inside
// /admin/listing-applications; this page is what stops a verified operator
// quietly ageing out of accreditation six months after approval.

type Bucket = 'pending' | 'expired' | 'expiring'

const BUCKET_LABEL: Record<Bucket, string> = {
  pending: 'Awaiting review',
  expired: 'Expired',
  expiring: `Expiring within ${EXPIRY_WARNING_DAYS} days`,
}

const BUCKET_STYLE: Record<Bucket, string> = {
  pending: 'border-[#C9A96E]/40 bg-[#C9A96E]/5',
  expired: 'border-red-200 bg-red-50/60',
  expiring: 'border-orange-200 bg-orange-50/60',
}

function bucketOf(doc: ComplianceDocument): Bucket | null {
  if (doc.reviewStatus === 'pending') return 'pending'
  if (doc.reviewStatus !== 'verified') return null
  const state = expiryState(doc.expiresOn)
  if (state === 'expired') return 'expired'
  if (state === 'expiring') return 'expiring'
  return null
}

function QueueRow({ doc, onReviewed }: { doc: ComplianceDocument; onReviewed: () => void }) {
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState(false)
  const [note, setNote] = useState(doc.reviewNote)
  const spec = DOC_TYPES[doc.docType]
  const days = daysUntilExpiry(doc.expiresOn)

  async function open() {
    setOpening(true)
    try {
      const url = await complianceDocumentUrl(doc.storagePath)
      if (!url) {
        toast.error('Could not open that document — it may have been removed from storage.')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setOpening(false)
    }
  }

  async function decide(status: ComplianceReviewStatus) {
    if (status === 'rejected' && !note.trim()) {
      toast.error('Say why it was rejected — the operator needs to know what to send instead.')
      return
    }
    setBusy(true)
    try {
      await reviewComplianceDocument(doc.id, status, note.trim())
      toast.success(status === 'verified' ? 'Document verified.' : 'Document rejected.')
      onReviewed()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save that decision.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-5 py-4 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText size={13} className="text-gray-400 shrink-0" />
            <span className="font-sans text-sm font-medium text-gray-800">{spec.label}</span>
            {isAccreditation(doc.docType) && (
              <span className="font-sans text-[10px] tracking-[0.08em] uppercase text-[#2d6a4f] border border-[#2d6a4f]/30 px-1.5 py-0.5">
                Accreditation
              </span>
            )}
            <span className="font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400">
              {REVIEW_STATUS_LABEL[doc.reviewStatus]}
            </span>
          </div>

          <p className="font-sans text-xs text-gray-500 mt-1.5">
            {[doc.issuer, doc.referenceNumber].filter(Boolean).join(' · ') || 'No issuer or number given'}
          </p>
          <p className="font-sans text-xs text-gray-400 mt-0.5">
            {doc.applicationRef
              ? <>Application <span className="text-gray-600">{doc.applicationRef}</span></>
              : <>Supplier account <span className="text-gray-600 font-mono text-[11px]">{doc.supplierId?.slice(0, 8)}…</span></>}
            {doc.expiresOn && (
              <>
                {' · '}
                {days !== null && days < 0
                  ? <span className="text-red-600">expired {Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} ago</span>
                  : <span className="text-orange-600">expires in {days} day{days === 1 ? '' : 's'}</span>}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <button onClick={open} disabled={opening}
            className="px-2.5 py-1 border border-gray-300 text-gray-600 font-sans text-xs hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors flex items-center gap-1 disabled:opacity-50">
            {opening ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />} Open
          </button>
          {doc.reviewStatus !== 'verified' && (
            <button onClick={() => decide('verified')} disabled={busy}
              className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors flex items-center gap-1 disabled:opacity-50">
              <Check size={11} /> Verify
            </button>
          )}
          <button onClick={() => decide('rejected')} disabled={busy}
            className="px-2.5 py-1 border border-red-200 text-red-500 font-sans text-xs hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50">
            <X size={11} /> Reject
          </button>
        </div>
      </div>

      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Reviewer note — what is wrong, or what to send instead"
        className="mt-3 w-full border border-gray-200 px-3 py-2 font-sans text-xs text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f]"
      />
    </div>
  )
}

export default function AdminCompliancePage() {
  const [docs, setDocs] = useState<ComplianceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setFailed('')
    try {
      setDocs(await getComplianceQueue())
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not load the compliance queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const buckets = useMemo(() => {
    const grouped: Record<Bucket, ComplianceDocument[]> = { expired: [], pending: [], expiring: [] }
    docs.forEach(d => {
      const b = bucketOf(d)
      if (b) grouped[b].push(d)
    })
    // Accreditation ahead of supporting evidence inside each bucket — it is
    // the one that decides whether a listing can stay up.
    ;(Object.keys(grouped) as Bucket[]).forEach(b => {
      grouped[b].sort((x, y) => Number(isAccreditation(y.docType)) - Number(isAccreditation(x.docType)))
    })
    return grouped
  }, [docs])

  // Expired first: a lapsed accreditation means a listing that should not be
  // live right now, which outranks a queue of unopened paperwork.
  const order: Bucket[] = ['expired', 'pending', 'expiring']
  const total = order.reduce((n, b) => n + buckets[b].length, 0)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Compliance</h1>
          <p className="font-sans text-sm text-gray-500 mt-1 max-w-2xl">
            Accreditation and supporting documents awaiting review, plus anything already verified that has lapsed or
            is about to. Per-applicant review happens in{' '}
            <Link href="/admin/listing-applications" className="text-[#2d6a4f] hover:underline">Applications</Link>.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {failed && (
        <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
          <p className="font-sans text-sm text-red-700">{failed}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 px-5 py-12 text-center font-sans text-sm text-gray-400">
          Loading compliance queue…
        </div>
      ) : total === 0 && !failed ? (
        <div className="bg-white border border-gray-200 px-5 py-16 text-center">
          <ShieldCheck size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="font-sans text-sm text-gray-400">
            Nothing waiting. Every document on file is verified and current.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {order.map(bucket => {
            const rows = buckets[bucket]
            if (rows.length === 0) return null
            return (
              <div key={bucket}>
                <div className={`border px-4 py-2.5 flex items-center justify-between ${BUCKET_STYLE[bucket]}`}>
                  <p className="font-sans text-xs font-semibold tracking-[0.06em] uppercase text-gray-700">
                    {BUCKET_LABEL[bucket]}
                  </p>
                  <span className="font-sans text-xs text-gray-500">{rows.length}</span>
                </div>
                <div className="bg-white border border-t-0 border-gray-200">
                  {rows.map(doc => <QueueRow key={doc.id} doc={doc} onReviewed={load} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
