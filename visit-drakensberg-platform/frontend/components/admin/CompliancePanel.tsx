'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  AlertTriangle, Check, ExternalLink, FileText, Loader2, ShieldCheck, ShieldAlert, Upload, X,
} from 'lucide-react'
import {
  getDocumentsForApplication, getSupplierDocuments, complianceDocumentUrl,
  reviewComplianceDocument, uploadComplianceDocument, accreditationOk,
  expiryState, daysUntilExpiry,
  isAccreditation, DOC_TYPES, REVIEW_STATUS_LABEL,
  type ComplianceDocument, type ComplianceDocType, type ComplianceReviewStatus, type ExpiryState,
} from '@/lib/compliance'
import {
  getApplicationAcceptances, getSupplierAcceptances,
  AGREEMENT_LABEL, type AgreementAcceptance,
} from '@/lib/supplier-agreement'

/**
 * The verification office's working panel for one applicant or supplier.
 *
 * Two things it deliberately does NOT do: show a document inline, or hand out
 * a durable URL. The `compliance` bucket is private, so opening a certificate
 * mints a short-lived signed URL on demand (lib/compliance.ts) — a reviewer
 * who copies the link out of the address bar gets something that stops
 * working, rather than a permanent handle on somebody's registration papers.
 */

const EXPIRY_STYLE: Record<ExpiryState, string> = {
  none: 'text-gray-400',
  valid: 'text-[#2d6a4f]',
  expiring: 'text-orange-600',
  expired: 'text-red-600',
}

const REVIEW_STYLE: Record<ComplianceReviewStatus, string> = {
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  verified: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  rejected: 'bg-red-50 text-red-500',
}

function expiryLabel(doc: ComplianceDocument): string {
  const state = expiryState(doc.expiresOn)
  if (state === 'none') return 'No expiry given'
  const days = daysUntilExpiry(doc.expiresOn)
  if (state === 'expired') return `Expired ${Math.abs(days ?? 0)} day${Math.abs(days ?? 0) === 1 ? '' : 's'} ago`
  if (state === 'expiring') return `Expires in ${days} day${days === 1 ? '' : 's'}`
  return `Valid to ${doc.expiresOn}`
}

function DocumentRow({ doc, onReviewed }: { doc: ComplianceDocument; onReviewed: () => void }) {
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState(false)
  const [note, setNote] = useState(doc.reviewNote)
  const [noteOpen, setNoteOpen] = useState(false)
  const spec = DOC_TYPES[doc.docType]

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
      setNoteOpen(true)
      toast.error('Say why it was rejected — the applicant needs to know what to send instead.')
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

  const state = expiryState(doc.expiresOn)

  return (
    <div className={`border p-3.5 ${isAccreditation(doc.docType) ? 'border-[#2d6a4f]/30 bg-[#2d6a4f]/[0.03]' : 'border-gray-200'}`}>
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
            <span className={`font-sans text-[10px] tracking-[0.08em] uppercase px-2 py-0.5 ${REVIEW_STYLE[doc.reviewStatus]}`}>
              {REVIEW_STATUS_LABEL[doc.reviewStatus]}
            </span>
          </div>

          <p className="font-sans text-xs text-gray-500 mt-1.5">
            {[doc.issuer, doc.referenceNumber].filter(Boolean).join(' · ') || 'No issuer or number given'}
          </p>
          <p className={`font-sans text-xs mt-0.5 ${EXPIRY_STYLE[state]}`}>
            {(state === 'expired' || state === 'expiring') && (
              <AlertTriangle size={11} className="inline-block mr-1 -mt-px" />
            )}
            {expiryLabel(doc)}
          </p>
          {doc.reviewNote && (
            <p className="font-sans text-xs text-gray-500 mt-1.5 italic">Note: {doc.reviewNote}</p>
          )}
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
          {doc.reviewStatus !== 'rejected' && (
            <button onClick={() => decide('rejected')} disabled={busy}
              className="px-2.5 py-1 border border-red-200 text-red-500 font-sans text-xs hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50">
              <X size={11} /> Reject
            </button>
          )}
        </div>
      </div>

      {(noteOpen || doc.reviewNote) && (
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Reviewer note — what is wrong, or what to send instead"
          className="mt-3 w-full border border-gray-200 px-3 py-2 font-sans text-xs text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f]"
        />
      )}
    </div>
  )
}

/**
 * Lodge a certificate on the operator's behalf.
 *
 * Not a convenience — the workflow does not work without it. Applications
 * submitted before accreditation was required carry no documents at all and
 * could otherwise never be approved, and in practice plenty of operators will
 * email a PDF rather than go back through the form. This is the path that
 * turns either of those into a reviewable record instead of an override.
 *
 * The document still lands as `pending`: uploading is not verifying, and the
 * same person can do both steps deliberately rather than by accident.
 */
function AddDocument({
  applicationRef, supplierId, onAdded,
}: {
  applicationRef?: string
  supplierId?: string
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [docType, setDocType] = useState<ComplianceDocType>('edtea_registration')
  const [issuer, setIssuer] = useState('')
  const [reference, setReference] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const spec = DOC_TYPES[docType]

  async function submit(file: File) {
    setBusy(true)
    try {
      // A document belongs to exactly one owner. Once an application has been
      // approved the panel carries both ids, and the account is the right
      // home — that is where the renewal queue looks.
      await uploadComplianceDocument({
        file, docType,
        ...(supplierId ? { supplierId } : { applicationRef }),
        issuer: issuer.trim(),
        referenceNumber: reference.trim(),
        expiresOn: expiresOn || null,
      })
      toast.success('Document added — it is on file as awaiting review.')
      setIssuer(''); setReference(''); setExpiresOn(''); setOpen(false)
      onAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add that document.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="font-sans text-xs text-[#2d6a4f] hover:underline flex items-center gap-1.5">
        <Upload size={12} /> Add a document on their behalf
      </button>
    )
  }

  return (
    <div className="border border-gray-200 bg-white p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-xs font-semibold text-gray-700">Add a document</p>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Cancel">
          <X size={13} />
        </button>
      </div>

      <select value={docType} onChange={e => setDocType(e.target.value as ComplianceDocType)}
        className="w-full border border-gray-200 px-3 py-2 font-sans text-xs text-black focus:outline-none focus:border-[#2d6a4f] bg-white">
        {(Object.keys(DOC_TYPES) as ComplianceDocType[]).map(t => (
          <option key={t} value={t}>{DOC_TYPES[t].label}</option>
        ))}
      </select>
      <p className="font-sans text-[11px] text-gray-400 leading-relaxed">{spec.hint}</p>

      <div className="grid sm:grid-cols-3 gap-2">
        <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder={spec.issuerLabel}
          className="border border-gray-200 px-3 py-2 font-sans text-xs text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f]" />
        <input value={reference} onChange={e => setReference(e.target.value)} placeholder={spec.referenceLabel}
          className="border border-gray-200 px-3 py-2 font-sans text-xs text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f]" />
        <input type="date" value={expiresOn} onChange={e => setExpiresOn(e.target.value)}
          title={spec.expectsExpiry ? 'Expiry date' : 'Expiry date (this type usually has none)'}
          className="border border-gray-200 px-3 py-2 font-sans text-xs text-black focus:outline-none focus:border-[#2d6a4f]" />
      </div>

      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="flex items-center gap-2 border border-gray-300 px-4 py-2 font-sans text-xs text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-40">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {busy ? 'Uploading…' : 'Choose file and upload'}
      </button>

      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) submit(file)
        }} />
    </div>
  )
}

export default function CompliancePanel({
  applicationRef,
  supplierId,
  onAccreditationChange,
}: {
  applicationRef?: string
  /**
   * The supplier account. On an application panel, pass the account it was
   * approved into — approval moves the certificates off the application
   * reference and onto the account, so without this an approved application
   * shows an empty panel and reports accreditation unsatisfied.
   */
  supplierId?: string
  /** Lets the parent gate an Approve button on the accreditation verdict. */
  onAccreditationChange?: (ok: boolean) => void
}) {
  const [docs, setDocs] = useState<ComplianceDocument[]>([])
  const [acceptances, setAcceptances] = useState<AgreementAcceptance[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setFailed('')
    try {
      // An application panel looks in both places (see
      // getDocumentsForApplication); a supplier panel only needs the account.
      const [d, a] = await Promise.all([
        applicationRef
          ? getDocumentsForApplication(applicationRef, supplierId)
          : getSupplierDocuments(supplierId ?? ''),
        applicationRef
          ? getApplicationAcceptances(applicationRef, supplierId)
          : getSupplierAcceptances(supplierId ?? ''),
      ])
      setDocs(d)
      setAcceptances(a)
    } catch (e) {
      // Never fall through to an empty list: "no documents on file" and
      // "could not load them" look identical on screen and mean opposite
      // things to a reviewer deciding whether to approve.
      setFailed(e instanceof Error ? e.message : 'Could not load compliance documents.')
      setDocs([])
      setAcceptances([])
    } finally {
      setLoading(false)
    }
  }, [applicationRef, supplierId])

  useEffect(() => { load() }, [load])

  const ok = accreditationOk(docs)

  // Through a ref rather than depending on the callback itself: callers pass
  // an inline arrow, so a callback dependency would re-run this on every
  // parent render. The parent's setState happens to bail out on an unchanged
  // value today, which is the only reason that wouldn't loop — too thin a
  // thread to hang a render cycle on.
  const notifyRef = useRef(onAccreditationChange)
  notifyRef.current = onAccreditationChange
  useEffect(() => { notifyRef.current?.(ok) }, [ok])

  if (loading) {
    return (
      <div className="flex items-center gap-2 font-sans text-xs text-gray-400 py-3">
        <Loader2 size={13} className="animate-spin" /> Loading compliance documents…
      </div>
    )
  }

  const accreditationDocs = docs.filter(d => isAccreditation(d.docType))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-sans text-xs font-semibold text-gray-700">Verification</p>
        <button onClick={load} className="font-sans text-[11px] text-gray-400 hover:text-[#2d6a4f] transition-colors">
          Refresh
        </button>
      </div>

      {failed && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="font-sans text-xs text-red-700 leading-relaxed">
            {failed} Nothing below is a reliable picture of this operator — do not approve on it.
          </p>
        </div>
      )}

      {/* The gate, stated plainly. Everything below is evidence for it. */}
      <div className={`border px-4 py-3 flex items-start gap-2.5 ${
        ok ? 'border-[#2d6a4f]/30 bg-[#2d6a4f]/5' : 'border-orange-200 bg-orange-50'
      }`}>
        {ok
          ? <ShieldCheck size={15} className="text-[#2d6a4f] mt-0.5 shrink-0" />
          : <ShieldAlert size={15} className="text-orange-600 mt-0.5 shrink-0" />}
        <div>
          <p className={`font-sans text-sm ${ok ? 'text-[#2d6a4f]' : 'text-orange-800'}`}>
            {ok ? 'Accreditation verified' : 'Accreditation not yet satisfied'}
          </p>
          <p className="font-sans text-xs text-gray-600 mt-0.5 leading-relaxed">
            {ok
              ? 'A current EDTEA registration or CTO membership is on file and verified.'
              : accreditationDocs.length === 0
                ? 'Nothing submitted. This operator needs either an EDTEA operator registration or CTO membership before the listing can go live.'
                : 'A certificate is on file but has not been verified, or has expired. Open it, check it, then verify or reject.'}
          </p>
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="font-sans text-xs text-gray-400 py-2">
          No documents on file. If they emailed a certificate, add it below rather than approving without one.
        </p>
      ) : (
        <div className="space-y-2">
          {/* Accreditation first — it is the one that decides the outcome. */}
          {[...docs].sort((a, b) => Number(isAccreditation(b.docType)) - Number(isAccreditation(a.docType)))
            .map(doc => <DocumentRow key={doc.id} doc={doc} onReviewed={load} />)}
        </div>
      )}

      <AddDocument applicationRef={applicationRef} supplierId={supplierId} onAdded={load} />

      <div className="border-t border-gray-100 pt-3">
        <p className="font-sans text-xs font-semibold text-gray-700 mb-1.5">Documents accepted</p>
        {acceptances.length === 0 ? (
          <p className="font-sans text-xs text-orange-600">
            No acceptance on file — this application predates the supplier documents, or the record failed to write.
          </p>
        ) : (
          <ul className="space-y-1">
            {acceptances.map(a => (
              <li key={a.id} className="font-sans text-xs text-gray-500">
                {AGREEMENT_LABEL[a.document]} v{a.version} — accepted by {a.acceptedName || a.acceptedEmail || 'unknown'}
                {a.acceptedAt ? ` on ${new Date(a.acceptedAt).toLocaleDateString('en-ZA')}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
