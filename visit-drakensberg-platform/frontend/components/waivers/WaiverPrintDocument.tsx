'use client'

/**
 * The printable copy of a signed waiver.
 *
 * WaiverSubmissionPanel portals this straight into <body> and marks the body
 * with `printing-waiver`; the print rules in globals.css then hide every other
 * child of <body>, so printing (from the panel's button or the browser menu)
 * produces this document alone instead of the dashboard behind the panel.
 * It is display:none on screen.
 *
 * Like the panel, it renders the template snapshot stored at signing time,
 * never the live template.
 */

import {
  WAIVER_FIELD_LABELS,
  type WaiverRequestDetails, type WaiverSubmission,
} from '@/lib/waivers'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const eyebrow = 'font-sans text-[9px] tracking-[0.16em] uppercase text-black/50'

export default function WaiverPrintDocument({
  request, submission, operatorName,
}: {
  request: WaiverRequestDetails
  submission: WaiverSubmission
  operatorName: string | null
}) {
  const snap = submission.template_snapshot
  const answers = Object.entries(submission.answers).filter(([, v]) => v)

  return (
    <article className="waiver-print-root font-sans text-black bg-white">
      <header className="border-b-2 border-black pb-4 mb-6">
        <p className={eyebrow}>Signed waiver{operatorName ? ` · ${operatorName}` : ''}</p>
        <h1 className="font-display italic text-3xl mt-1 leading-tight">{snap?.title || request.template_title}</h1>
      </header>

      <section className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6 break-inside-avoid">
        {([
          ['Participant', submission.signed_name || request.participant_name || '—'],
          ['Email', request.participant_email || '—'],
          ['Activity', request.activity_name || '—'],
          ['Date of activity', fmtDate(request.service_date)],
          ['Booking reference', request.booking_reference || '—'],
          ['Signed', fmtDateTime(submission.signed_at)],
        ] as const).map(([k, v]) => (
          <div key={k}>
            <p className={eyebrow}>{k}</p>
            <p className="text-[12px] mt-0.5">{v}</p>
          </div>
        ))}
      </section>

      {snap?.intro && (
        <section className="mb-6">
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{snap.intro}</p>
        </section>
      )}

      {answers.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className={`${eyebrow} mb-2`}>Participant details</h2>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {answers.map(([k, v]) => (
                <tr key={k} className="border-t border-black/20 last:border-b">
                  <th className="text-left font-normal text-black/60 py-1.5 pr-4 w-1/3 align-top">
                    {WAIVER_FIELD_LABELS.find(f => f.key === k)?.label ?? k}
                  </th>
                  <td className="py-1.5 align-top whitespace-pre-wrap">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {snap?.clauses?.length ? (
        <section className="mb-6">
          <h2 className={`${eyebrow} mb-2`}>Declarations</h2>
          <ol className="space-y-2">
            {snap.clauses.map(c => {
              const accepted = Boolean(submission.acknowledged[c.id])
              return (
                <li key={c.id} className="flex items-start gap-2.5 break-inside-avoid">
                  <span className="mt-[1px] shrink-0 w-3.5 h-3.5 border border-black flex items-center justify-center text-[10px] leading-none">
                    {accepted ? '✓' : ''}
                  </span>
                  <span className="text-[11px] leading-relaxed">
                    {c.text}
                    <span className="text-black/50">
                      {' '}— {accepted ? 'accepted' : c.required ? 'not accepted' : 'not accepted (optional)'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <section className="border border-black/40 p-4 break-inside-avoid">
        <h2 className={`${eyebrow} mb-3`}>Signature</h2>
        {submission.signature_data && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={submission.signature_data}
            alt={`Signature of ${submission.signed_name}`}
            className="max-h-24 w-auto mb-2"
          />
        )}
        <div className="border-t border-black/40 pt-1.5 grid grid-cols-2 gap-6">
          <div>
            <p className="font-display italic text-lg leading-tight">{submission.signed_name}</p>
            <p className={eyebrow}>Participant</p>
          </div>
          <div>
            <p className="text-[12px] leading-tight pt-1">{fmtDateTime(submission.signed_at)}</p>
            <p className={eyebrow}>Date signed</p>
          </div>
        </div>
        {submission.guardian_name && (
          <div className="mt-3">
            <p className="text-[12px]">{submission.guardian_name}</p>
            <p className={eyebrow}>Countersigned by parent or guardian</p>
          </div>
        )}
      </section>

      <footer className="mt-6 pt-3 border-t border-black/20 text-[9px] text-black/50 leading-relaxed">
        <p>
          Signed electronically through Visit Drakensberg
          {request.link_id ? ' using a shared group link' : ''}. Record {submission.id}.
        </p>
        <p>Printed {fmtDateTime(new Date().toISOString())}.</p>
      </footer>
    </article>
  )
}
