'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Save, Users } from 'lucide-react'
import {
  saveEmailCampaign, getEmailTemplates, getAudienceSegmentOptions, getConsentedAudienceCount,
  type EmailCampaign, type EmailTemplate,
} from '@/lib/email-campaigns-admin'
import type { SegmentCount } from '@/lib/customers-admin'

const inputClass = 'w-full bg-white border border-gray-200 px-4 py-2.5 font-sans text-sm text-[#000000] focus:outline-none focus:border-[#2d6a4f] transition-colors'
const labelClass = 'font-sans text-xs tracking-[0.1em] uppercase text-gray-400 block mb-2'

const CAMPAIGN_TYPE_OPTIONS: { value: EmailCampaign['campaignType']; label: string; hint: string }[] = [
  { value: 'broadcast', label: 'Broadcast', hint: 'One-off to everyone consented, or a segment' },
  { value: 'segmented', label: 'Segmented', hint: 'Targeted at customers matching a specific segment' },
  { value: 'behavioral', label: 'Behavioural', hint: 'Trigger-driven — recorded here, sent by the automation engine' },
  { value: 'lifecycle', label: 'Lifecycle', hint: 'Trigger-driven — recorded here, sent by the automation engine' },
]

/** `<input type="datetime-local">` reads/writes local wall-clock time with
 *  no timezone info. Slicing a stored UTC ISO string to 16 chars puts its
 *  UTC clock value straight into that field instead — e.g. a schedule
 *  stored as 08:00Z would show (and, on the next save, be silently
 *  re-interpreted as) 08:00 local rather than the correct 10:00 in SAST.
 *  Converting through Date's local getters keeps what the admin sees and
 *  re-saves consistent with the instant actually stored. */
function toLocalDateTimeInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EmailCampaignForm({ campaign }: { campaign: EmailCampaign | null }) {
  const router = useRouter()
  const [name, setName] = useState(campaign?.name ?? '')
  const [campaignType, setCampaignType] = useState<EmailCampaign['campaignType']>(campaign?.campaignType ?? 'broadcast')
  const [templateId, setTemplateId] = useState<string | ''>(campaign?.templateId ?? '')
  const [audienceSegmentId, setAudienceSegmentId] = useState<string | ''>(campaign?.audienceSegmentId ?? '')
  const [scheduledAt, setScheduledAt] = useState(campaign?.scheduledAt ? toLocalDateTimeInputValue(campaign.scheduledAt) : '')
  const [notes, setNotes] = useState(campaign?.notes ?? '')

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [segments, setSegments] = useState<SegmentCount[]>([])
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getEmailTemplates(), getAudienceSegmentOptions()]).then(([t, s]) => { setTemplates(t); setSegments(s) })
  }, [])

  useEffect(() => {
    getConsentedAudienceCount(audienceSegmentId || null).then(setAudienceCount)
  }, [audienceSegmentId])

  const locked = campaign ? !['draft', 'scheduled'].includes(campaign.status) : false

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    const { id, error: err } = await saveEmailCampaign(campaign?.id ?? null, {
      name, campaignType, templateId: templateId || null, audienceSegmentId: audienceSegmentId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, notes,
    })
    setSaving(false)
    if (err) { setError(err); return }
    router.push(id ? `/admin/campaigns/${id}` : '/admin/campaigns')
    router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-5">
      {error && <p className="font-sans text-sm text-red-500">{error}</p>}
      {locked && (
        <p className="font-sans text-sm text-[#8B6914] bg-[#C9A96E]/15 px-4 py-3">
          This campaign has already been sent (or is paused/cancelled) and can no longer be edited.
        </p>
      )}

      <div>
        <label className={labelClass}>Campaign Name</label>
        <input value={name} onChange={e => setName(e.target.value)} disabled={locked} placeholder="Winter Hiking Campaign" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Campaign Type</label>
        <div className="grid grid-cols-2 gap-3">
          {CAMPAIGN_TYPE_OPTIONS.map(o => (
            <label key={o.value} className={`border px-4 py-3 cursor-pointer transition-colors ${campaignType === o.value ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 hover:border-gray-300'} ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="radio" checked={campaignType === o.value} onChange={() => setCampaignType(o.value)} className="sr-only" />
              <p className="font-sans text-sm font-medium">{o.label}</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5">{o.hint}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Template</label>
        <select value={templateId} onChange={e => setTemplateId(e.target.value)} disabled={locked} className={inputClass}>
          <option value="">— Select a template —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {templates.length === 0 && (
          <p className="font-sans text-xs text-gray-400 mt-2">
            No templates yet — <Link href="/admin/campaigns/templates/new" className="text-[#2d6a4f] hover:underline">create one first</Link>.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass}>Audience</label>
        <select value={audienceSegmentId} onChange={e => setAudienceSegmentId(e.target.value)} disabled={locked} className={inputClass}>
          <option value="">All marketing-consented customers</option>
          {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="font-sans text-xs text-gray-500 mt-2 inline-flex items-center gap-1.5">
          <Users size={12} className="text-gray-400" />
          {audienceCount === null ? 'Calculating…' : `${audienceCount.toLocaleString()} consented recipient${audienceCount === 1 ? '' : 's'}`}
        </p>
      </div>

      <div>
        <label className={labelClass}>Schedule (optional)</label>
        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} disabled={locked} className={inputClass} />
        <p className="font-sans text-xs text-gray-400 mt-2">Recorded as intent only — nothing fires automatically at this time yet. Use the Send button on the campaign page when ready.</p>
      </div>

      <div>
        <label className={labelClass}>Internal Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={locked} rows={3} className={inputClass} />
      </div>

      {!locked && (
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving…' : 'Save Campaign'}
        </button>
      )}
    </div>
  )
}
