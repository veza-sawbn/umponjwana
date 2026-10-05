'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Save, Users, Plus, Trash2, Copy, Check } from 'lucide-react'
import {
  saveEmailCampaign, getEmailTemplates, getAudienceSegmentOptions, getConsentedAudienceCount,
  getCampaignContacts, type EmailCampaign, type EmailTemplate, type CampaignContact,
} from '@/lib/email-campaigns-admin'
import type { SegmentCount } from '@/lib/customers-admin'
import { CONTACT_MERGE_TAGS, campaignFieldKeyError, toCampaignFieldKey, usedMergeTags } from '@/lib/email-merge-tags'
import ContactPicker from '@/components/admin/campaigns/ContactPicker'
import PersonalisedPreview from '@/components/admin/campaigns/PersonalisedPreview'

const inputClass = 'w-full bg-white border border-gray-200 px-4 py-2.5 font-sans text-sm text-[#000000] focus:outline-none focus:border-[#2d6a4f] transition-colors'
const labelClass = 'font-sans text-xs tracking-[0.1em] uppercase text-gray-400 block mb-2'

const CAMPAIGN_TYPE_OPTIONS: { value: EmailCampaign['campaignType']; label: string; hint: string }[] = [
  { value: 'broadcast', label: 'Broadcast', hint: 'One-off to everyone consented, or a segment' },
  { value: 'segmented', label: 'Segmented', hint: 'Targeted at customers matching a specific segment' },
  { value: 'behavioral', label: 'Behavioural', hint: 'Trigger-driven: recorded here, sent by the automation engine' },
  { value: 'lifecycle', label: 'Lifecycle', hint: 'Trigger-driven: recorded here, sent by the automation engine' },
]

/** Common campaign details, offered as one-click additions. */
const SUGGESTED_FIELDS = ['offer', 'promo_code', 'deadline', 'event_name', 'event_date', 'cta_url']

/** How many audience members the segment-mode preview offers in "Preview as". */
const SEGMENT_PREVIEW_SAMPLE = 25

type FieldRow = { key: string; value: string }

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
  const [audienceMode, setAudienceMode] = useState<EmailCampaign['audienceMode']>(campaign?.audienceMode ?? 'segment')
  const [recipientIds, setRecipientIds] = useState<string[]>(campaign?.recipientUserIds ?? [])
  const [fieldRows, setFieldRows] = useState<FieldRow[]>(
    Object.entries(campaign?.mergeValues ?? {}).map(([key, value]) => ({ key, value: String(value ?? '') })),
  )

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [segments, setSegments] = useState<SegmentCount[]>([])
  const [contacts, setContacts] = useState<CampaignContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [copiedTag, setCopiedTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getEmailTemplates(), getAudienceSegmentOptions()]).then(([t, s]) => { setTemplates(t); setSegments(s) })
    getCampaignContacts().then(c => { setContacts(c); setContactsLoading(false) })
  }, [])

  useEffect(() => {
    if (audienceMode !== 'segment') return
    setAudienceCount(null)
    getConsentedAudienceCount(audienceSegmentId || null).then(setAudienceCount)
  }, [audienceSegmentId, audienceMode])

  const template = templates.find(t => t.id === templateId) ?? null

  // Rows → the map the merge engine and the database both take. Blank keys
  // are a row still being typed, not an error.
  const mergeValues = useMemo(() => {
    const out: Record<string, string> = {}
    for (const r of fieldRows) if (r.key.trim()) out[r.key.trim()] = r.value
    return out
  }, [fieldRows])

  const contactsById = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts])
  const selectedContacts = useMemo(
    () => recipientIds.map(id => contactsById.get(id)).filter((c): c is CampaignContact => !!c),
    [recipientIds, contactsById],
  )
  const previewRecipients = useMemo(() => {
    if (audienceMode === 'manual') return selectedContacts
    const pool = audienceSegmentId ? contacts.filter(c => c.segmentIds.includes(audienceSegmentId)) : contacts
    return pool.slice(0, SEGMENT_PREVIEW_SAMPLE)
  }, [audienceMode, selectedContacts, contacts, audienceSegmentId])

  // Tags the chosen template uses that nothing fills yet — offered as
  // one-click campaign details so the admin isn't left guessing the key.
  const missingFieldKeys = useMemo(() => {
    if (!template) return []
    const contactKeys = new Set(CONTACT_MERGE_TAGS.map(t => t.key))
    return usedMergeTags([template.subject, template.preheader, template.htmlBody, template.heroImageAlt])
      .filter(k => !contactKeys.has(k) && !(k in mergeValues))
  }, [template, mergeValues])

  function addField(key = '') {
    setFieldRows(rows => rows.some(r => r.key === key && key) ? rows : [...rows, { key, value: '' }])
  }
  function updateField(i: number, patch: Partial<FieldRow>) {
    setFieldRows(rows => rows.map((r, j) => j === i ? { ...r, ...patch } : r))
  }
  function removeField(i: number) {
    setFieldRows(rows => rows.filter((_, j) => j !== i))
  }
  async function copyTag(key: string) {
    try { await navigator.clipboard.writeText(`{{${key}}}`) } catch { /* clipboard blocked: the tag is on screen anyway */ }
    setCopiedTag(key)
    setTimeout(() => setCopiedTag(k => k === key ? '' : k), 1200)
  }

  const locked = campaign ? !['draft', 'scheduled'].includes(campaign.status) : false

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return }
    if (audienceMode === 'manual' && recipientIds.length === 0) { setError('Select at least one contact, or switch the audience to a segment.'); return }
    const keys = fieldRows.map(r => r.key.trim()).filter(Boolean)
    for (const k of keys) {
      const keyErr = campaignFieldKeyError(k)
      if (keyErr) { setError(`Campaign detail {{${k}}}: ${keyErr}`); return }
    }
    if (new Set(keys).size !== keys.length) { setError('Each campaign detail needs a different name.'); return }
    setSaving(true); setError('')
    const { id, error: err } = await saveEmailCampaign(campaign?.id ?? null, {
      name, campaignType, templateId: templateId || null, audienceSegmentId: audienceSegmentId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, notes,
      audienceMode, recipientUserIds: recipientIds, mergeValues,
    })
    setSaving(false)
    if (err) { setError(err); return }
    router.push(id ? `/admin/campaigns/${id}` : '/admin/campaigns')
    router.refresh()
  }

  const consentedSelected = selectedContacts.length

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
    <div className="space-y-5 min-w-0">
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
          <option value="">Select a template</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {templates.length === 0 && (
          <p className="font-sans text-xs text-gray-400 mt-2">
            No templates yet. <Link href="/admin/campaigns/templates/new" className="text-[#2d6a4f] hover:underline">create one first</Link>.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass}>Audience</label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {([
            { value: 'segment', label: 'Segment', hint: 'Everyone consented, or one segment' },
            { value: 'manual', label: 'Hand-picked', hint: 'Choose specific contacts' },
          ] as const).map(o => (
            <label key={o.value} className={`border px-4 py-3 cursor-pointer transition-colors ${audienceMode === o.value ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 hover:border-gray-300'} ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="radio" name="audience-mode" checked={audienceMode === o.value} onChange={() => setAudienceMode(o.value)} className="sr-only" />
              <p className="font-sans text-sm font-medium">{o.label}</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5">{o.hint}</p>
            </label>
          ))}
        </div>

        {audienceMode === 'segment' ? (
          <>
            <select value={audienceSegmentId} onChange={e => setAudienceSegmentId(e.target.value)} disabled={locked} className={inputClass}>
              <option value="">All marketing-consented customers</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="font-sans text-xs text-gray-500 mt-2 inline-flex items-center gap-1.5">
              <Users size={12} className="text-gray-400" />
              {audienceCount === null ? 'Calculating…' : `${audienceCount.toLocaleString()} consented recipient${audienceCount === 1 ? '' : 's'}`}
            </p>
          </>
        ) : contactsLoading ? (
          <div className="border border-gray-200 h-40 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
        ) : (
          <>
            <ContactPicker contacts={contacts} segments={segments} selected={recipientIds} onChange={setRecipientIds} disabled={locked} />
            <p className="font-sans text-xs text-gray-500 mt-2 inline-flex items-center gap-1.5">
              <Users size={12} className="text-gray-400" />
              {consentedSelected.toLocaleString()} consented recipient{consentedSelected === 1 ? '' : 's'} selected.
              Only customers who have opted in to marketing are listed.
            </p>
          </>
        )}
      </div>

      <div>
        <label className={labelClass}>Campaign Details</label>
        <p className="font-sans text-xs text-gray-400 mb-3">
          Values the template can drop in with a tag, e.g. <code>{'{{offer}}'}</code> or <code>{'{{promo_code}}'}</code>.
          Change one here and the preview updates for every recipient.
        </p>
        {missingFieldKeys.length > 0 && !locked && (
          <div className="bg-[#C9A96E]/15 px-3 py-2 mb-3 font-sans text-xs text-[#8B6914] flex flex-wrap items-center gap-2">
            The template uses
            {missingFieldKeys.map(k => {
              const ok = !campaignFieldKeyError(k)
              return ok ? (
                <button key={k} type="button" onClick={() => addField(k)} className="inline-flex items-center gap-1 bg-white border border-[#C9A96E]/40 px-2 py-0.5 hover:border-[#2d6a4f]">
                  <Plus size={10} /> {k}
                </button>
              ) : <code key={k}>{`{{${k}}}`}</code>
            })}
            but no value is set.
          </div>
        )}
        <div className="space-y-2">
          {fieldRows.map((r, i) => {
            const keyErr = r.key.trim() ? campaignFieldKeyError(r.key.trim()) : null
            return (
              <div key={i}>
                <div className="flex gap-2">
                  <input value={r.key} onChange={e => updateField(i, { key: e.target.value.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                    onBlur={e => updateField(i, { key: toCampaignFieldKey(e.target.value) })}
                    disabled={locked} placeholder="offer" aria-label="Detail name"
                    className={`${inputClass} w-2/5 font-mono text-xs ${keyErr ? 'border-red-300' : ''}`} />
                  <input value={r.value} onChange={e => updateField(i, { value: e.target.value })}
                    disabled={locked} placeholder="Winter midweek: stay 3, pay 2" aria-label="Detail value"
                    className={inputClass} />
                  {!locked && (
                    <button type="button" onClick={() => removeField(i)} aria-label="Remove detail" className="px-2 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  )}
                </div>
                {keyErr && <p className="font-sans text-xs text-red-400 mt-1">{keyErr}</p>}
              </div>
            )
          })}
        </div>
        {!locked && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" onClick={() => addField()} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline"><Plus size={12} /> Add detail</button>
            {SUGGESTED_FIELDS.filter(k => !(k in mergeValues)).map(k => (
              <button key={k} type="button" onClick={() => addField(k)} className="font-mono text-[11px] text-gray-500 border border-gray-200 px-2 py-0.5 hover:border-[#2d6a4f] hover:text-[#2d6a4f]">+ {k}</button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Personalisation Tags</label>
        <p className="font-sans text-xs text-gray-400 mb-2">
          Filled per recipient from their profile. Click to copy, then paste into the template. Add a fallback
          for contacts missing a value: <code>{'{{first_name|there}}'}</code>.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...CONTACT_MERGE_TAGS.map(t => ({ key: t.key, label: t.label })), ...Object.keys(mergeValues).map(k => ({ key: k, label: 'Campaign detail' }))].map(t => (
            <button key={t.key} type="button" onClick={() => copyTag(t.key)} title={t.label}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-600 bg-[#F7F5F2] border border-gray-200 px-2 py-0.5 hover:border-[#2d6a4f]">
              {copiedTag === t.key ? <Check size={10} className="text-[#2d6a4f]" /> : <Copy size={10} className="text-gray-300" />}
              {`{{${t.key}}}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Schedule (optional)</label>
        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} disabled={locked} className={inputClass} />
        <p className="font-sans text-xs text-gray-400 mt-2">Recorded as intent only. Nothing fires automatically at this time yet. Use the Send button on the campaign page when ready.</p>
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

    <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
      <label className={labelClass}>Live Preview</label>
      <PersonalisedPreview template={template} recipients={previewRecipients} mergeValues={mergeValues} />
      <p className="font-sans text-xs text-gray-400 mt-2">
        Updates as you change the template, campaign details or recipients. Each person receives their own
        version with their details filled in.
      </p>
    </div>
    </div>
  )
}
