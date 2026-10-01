'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, UserRound } from 'lucide-react'
import type { CampaignContact, EmailTemplate } from '@/lib/email-campaigns-admin'
import { buildMergeValues, findMergeTagIssues, renderMergeTags } from '@/lib/email-merge-tags'

const labelClass = 'font-sans text-xs tracking-[0.1em] uppercase text-gray-400 block mb-2'

/**
 * The campaign's email as one recipient would read it: the template's
 * subject, preheader and body with every {{tag}} filled from that person's
 * profile and the campaign's own details, rendered through the branded shell.
 * Re-renders whenever the template, the campaign details or the previewed
 * recipient changes, so edits show up without saving.
 */
export default function PersonalisedPreview({
  template, recipients, mergeValues, height = 640,
}: {
  template: EmailTemplate | null
  /** Who can be picked in "Preview as". Empty = sample data. */
  recipients: CampaignContact[]
  mergeValues: Record<string, string>
  height?: number
}) {
  const [previewAsId, setPreviewAsId] = useState('')
  const [html, setHtml] = useState('')

  // Keep the pick valid as the recipient list changes underneath it.
  useEffect(() => {
    if (recipients.length === 0) { setPreviewAsId(''); return }
    if (!recipients.some(r => r.id === previewAsId)) setPreviewAsId(recipients[0].id)
  }, [recipients, previewAsId])

  const contact = recipients.find(r => r.id === previewAsId) ?? null
  const values = useMemo(() => buildMergeValues(contact, mergeValues), [contact, mergeValues])

  const rendered = useMemo(() => template ? {
    subject: renderMergeTags(template.subject, values, { html: false }),
    preheader: renderMergeTags(template.preheader, values, { html: false }),
    htmlBody: renderMergeTags(template.htmlBody, values, { html: true }),
    heroImageAlt: renderMergeTags(template.heroImageAlt, values, { html: false }),
  } : null, [template, values])

  const issues = useMemo(
    () => template ? findMergeTagIssues([template.subject, template.preheader, template.htmlBody, template.heroImageAlt], values) : [],
    [template, values],
  )

  useEffect(() => {
    if (!rendered || !template) { setHtml(''); return }
    let cancelled = false
    const t = setTimeout(() => {
      fetch('/api/admin/campaigns/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rendered, heroImageUrl: template.heroImageUrl }),
      }).then(r => r.json()).then(d => { if (!cancelled) setHtml(d.html ?? '') }).catch(() => {})
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [rendered, template])

  if (!template) {
    return (
      <div className="border border-dashed border-gray-200 bg-[#F7F5F2] flex items-center justify-center font-sans text-sm text-gray-400 text-center px-6" style={{ height }}>
        Choose a template to see the email, personalised for each recipient.
      </div>
    )
  }

  const unknown = issues.filter(i => i.kind === 'unknown')
  const empty = issues.filter(i => i.kind === 'empty')

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Preview as</label>
        {recipients.length > 0 ? (
          <select value={previewAsId} onChange={e => setPreviewAsId(e.target.value)}
            className="w-full bg-white border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]">
            {recipients.map(r => <option key={r.id} value={r.id}>{r.fullName} — {r.email}</option>)}
          </select>
        ) : (
          <p className="font-sans text-xs text-gray-500 inline-flex items-center gap-1.5"><UserRound size={12} /> Sample contact (no recipients to preview yet)</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 px-4 py-3">
        <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">Subject</p>
        <p className="font-sans text-sm text-[#000000] mt-0.5">{rendered?.subject || '(No subject)'}</p>
        {rendered?.preheader && <p className="font-sans text-xs text-gray-400 mt-1 truncate">{rendered.preheader}</p>}
      </div>

      {(unknown.length > 0 || empty.length > 0) && (
        <div className="bg-[#C9A96E]/15 px-4 py-3 space-y-1">
          {unknown.length > 0 && (
            <p className="font-sans text-xs text-[#8B6914] flex gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>Not filled by anything: {unknown.map(i => <code key={i.key} className="mx-0.5">{`{{${i.key}}}`}</code>)}. Add it as a campaign detail or fix the tag in the template.</span>
            </p>
          )}
          {empty.length > 0 && (
            <p className="font-sans text-xs text-[#8B6914] flex gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>
                Blank for {contact ? contact.fullName : 'this contact'}: {empty.map(i => <code key={i.key} className="mx-0.5">{`{{${i.key}}}`}</code>)}.
                Add a fallback in the template, e.g. <code>{`{{${empty[0].key}|there}}`}</code>.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="border border-gray-200 bg-[#F7F5F2] overflow-hidden" style={{ height }}>
        {html ? (
          <iframe srcDoc={html} title="Personalised email preview" className="w-full h-full border-0" sandbox="" />
        ) : (
          <div className="h-full flex items-center justify-center font-sans text-sm text-gray-400">Preview loading…</div>
        )}
      </div>
    </div>
  )
}
