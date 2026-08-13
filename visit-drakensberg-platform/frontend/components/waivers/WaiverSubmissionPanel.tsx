'use client'

/**
 * Read-only view of a signed waiver.
 *
 * Renders the template snapshot stored at signing time rather than the live
 * template, so editing a form later never changes what a past participant is
 * shown to have agreed to.
 */

import { useEffect, useState } from 'react'
import { X, FileSignature, Printer } from 'lucide-react'
import {
  getWaiverSubmission, WAIVER_FIELD_LABELS,
  type WaiverRequestDetails, type WaiverSubmission,
} from '@/lib/waivers'

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function WaiverSubmissionPanel({
  request, onClose,
}: {
  request: WaiverRequestDetails
  onClose: () => void
}) {
  const [submission, setSubmission] = useState<WaiverSubmission | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWaiverSubmission(request.id).then(s => { setSubmission(s); setLoading(false) })
  }, [request.id])

  const snap = submission?.template_snapshot

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-xl h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/8 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-black/30">Signed waiver</p>
            <h2 className="font-display italic text-xl text-black/90 truncate">
              {request.participant_name || request.participant_email}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="p-2 text-black/30 hover:text-black/70 transition-colors"
              title="Print"
            >
              <Printer size={16} />
            </button>
            <button onClick={onClose} className="p-2 text-black/30 hover:text-black/70 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="p-6 font-sans text-sm text-black/30">Loading…</p>
        ) : !submission ? (
          <p className="p-6 font-sans text-sm text-black/30">This waiver has no submission on file.</p>
        ) : (
          <div className="p-6 space-y-6">
            {/* Context */}
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Activity', request.activity_name || '—'],
                ['Date of activity', request.service_date ?? '—'],
                ['Booking reference', request.booking_reference || '—'],
                ['Signed at', fmtDateTime(submission.signed_at)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-black/30 mb-1">{k}</p>
                  <p className="font-sans text-sm text-black/75">{v}</p>
                </div>
              ))}
            </div>

            {/* Participant answers */}
            {Object.keys(submission.answers).length > 0 && (
              <section>
                <h3 className="font-sans text-[10px] tracking-[0.12em] uppercase text-black/30 mb-2">
                  Participant details
                </h3>
                <div className="border border-black/8 rounded-lg divide-y divide-black/5">
                  {Object.entries(submission.answers).map(([k, v]) => {
                    const known = WAIVER_FIELD_LABELS.find(f => f.key === k)
                    return (
                      <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5">
                        <span className="font-sans text-xs text-black/40 shrink-0">
                          {known?.label ?? k}
                        </span>
                        <span className="font-sans text-sm text-black/75 text-right break-words">
                          {v || '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Clauses as presented at signing */}
            {snap?.clauses?.length ? (
              <section>
                <h3 className="font-sans text-[10px] tracking-[0.12em] uppercase text-black/30 mb-2">
                  Agreed to
                </h3>
                <ul className="space-y-2">
                  {snap.clauses.map(c => (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-sm flex items-center justify-center font-sans text-[10px] ${
                        submission.acknowledged[c.id]
                          ? 'bg-emerald-500 text-white'
                          : 'border border-black/15 text-transparent'
                      }`}>
                        ✓
                      </span>
                      <span className="font-sans text-xs text-black/60 leading-relaxed">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Signature */}
            <section className="border-t border-black/8 pt-5">
              <h3 className="font-sans text-[10px] tracking-[0.12em] uppercase text-black/30 mb-3">
                Signature
              </h3>
              {submission.signature_data ? (
                <div className="border border-black/10 rounded-lg bg-black/[0.02] p-3 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={submission.signature_data}
                    alt={`Signature of ${submission.signed_name}`}
                    className="max-h-28 w-auto"
                  />
                </div>
              ) : null}
              <p className="font-display italic text-lg text-black/80">{submission.signed_name}</p>
              {submission.guardian_name && (
                <p className="font-sans text-xs text-black/40 mt-1">
                  Countersigned by guardian: {submission.guardian_name}
                </p>
              )}
              <p className="font-sans text-[11px] text-black/30 mt-2 flex items-center gap-1.5">
                <FileSignature size={12} /> Recorded {fmtDateTime(submission.signed_at)}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
