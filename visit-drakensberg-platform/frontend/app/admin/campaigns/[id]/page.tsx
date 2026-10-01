'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Send, Pause, Play, XCircle, Eye, AlertTriangle, Users, FileText } from 'lucide-react'
import {
  getEmailCampaign, getEmailTemplate, getAudienceSegmentOptions, getConsentedAudienceCount,
  getConsentedRecipientCount, getCampaignContacts,
  dryRunSendCampaign, setCampaignStatus, type EmailCampaign, type EmailTemplate, type CampaignContact,
} from '@/lib/email-campaigns-admin'
import type { SegmentCount } from '@/lib/customers-admin'
import PersonalisedPreview from '@/components/admin/campaigns/PersonalisedPreview'

const STATUS_LABEL: Record<EmailCampaign['status'], string> = {
  draft: 'Draft', scheduled: 'Scheduled', dry_run_sent: 'Dry Run Sent', sent: 'Sent', paused: 'Paused', cancelled: 'Cancelled',
}
const STATUS_STYLE: Record<EmailCampaign['status'], string> = {
  draft: 'bg-gray-100 text-gray-500',
  scheduled: 'bg-blue-50 text-blue-600',
  dry_run_sent: 'bg-[#C9A96E]/15 text-[#8B6914]',
  sent: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  paused: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-400',
}

function fmtDateTime(d: string | null) {
  return d ? new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

export default function EmailCampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null)
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [segments, setSegments] = useState<SegmentCount[]>([])
  const [liveAudienceCount, setLiveAudienceCount] = useState<number | null>(null)
  const [contacts, setContacts] = useState<CampaignContact[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const id = params?.id
    if (!id) return
    const c = await getEmailCampaign(id)
    setCampaign(c)
    if (c) {
      const [t, segs, count, people] = await Promise.all([
        c.templateId ? getEmailTemplate(c.templateId) : Promise.resolve(null),
        getAudienceSegmentOptions(),
        c.audienceMode === 'manual' ? getConsentedRecipientCount(c.recipientUserIds) : getConsentedAudienceCount(c.audienceSegmentId),
        getCampaignContacts(),
      ])
      setTemplate(t); setSegments(segs); setLiveAudienceCount(count); setContacts(people)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [params?.id])

  // Who "Preview as" offers: the hand-picked list, or a sample of the segment.
  const previewRecipients = useMemo(() => {
    if (!campaign) return []
    if (campaign.audienceMode === 'manual') {
      const picked = new Set(campaign.recipientUserIds)
      return contacts.filter(c => picked.has(c.id))
    }
    const pool = campaign.audienceSegmentId ? contacts.filter(c => c.segmentIds.includes(campaign.audienceSegmentId!)) : contacts
    return pool.slice(0, 25)
  }, [campaign, contacts])

  async function handleSend() {
    if (!campaign) return
    setSending(true); setError('')
    const { error: err } = await dryRunSendCampaign(campaign.id)
    setSending(false); setConfirmSend(false)
    if (err) { setError(err); return }
    await load()
  }

  async function handleStatus(status: 'paused' | 'cancelled' | 'draft') {
    if (!campaign) return
    const { error: err } = await setCampaignStatus(campaign.id, status)
    if (err) { setError(err); return }
    await load()
  }

  if (loading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  if (!campaign) return (
    <div className="p-8">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Campaigns</Link>
      <p className="font-sans text-sm text-gray-400">Campaign not found.</p>
    </div>
  )

  const segmentName = campaign.audienceMode === 'manual'
    ? `${campaign.recipientUserIds.length.toLocaleString()} hand-picked contact${campaign.recipientUserIds.length === 1 ? '' : 's'}`
    : segments.find(s => s.id === campaign.audienceSegmentId)?.name ?? 'All marketing-consented customers'
  const sendable = ['draft', 'scheduled'].includes(campaign.status) && !!campaign.templateId
    && (campaign.audienceMode !== 'manual' || campaign.recipientUserIds.length > 0)
  const mergeEntries = Object.entries(campaign.mergeValues)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Campaigns</Link>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">{campaign.name}</h1>
            <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[campaign.status]}`}>{STATUS_LABEL[campaign.status]}</span>
          </div>
          <p className="font-sans text-sm text-gray-400 mt-1">{campaign.campaignType} campaign</p>
        </div>
        {['draft', 'scheduled'].includes(campaign.status) && (
          <Link href={`/admin/campaigns/${campaign.id}/edit`} className="font-sans text-sm text-[#2d6a4f] hover:underline shrink-0">Edit</Link>
        )}
      </div>

      {error && <p className="font-sans text-sm text-red-500 mb-6">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Send / dry-run panel */}
          <div className="bg-white border border-gray-200 p-6">
            <div className="flex items-start gap-3 mb-5">
              <AlertTriangle size={16} className="text-[#C9A96E] shrink-0 mt-0.5" />
              <p className="font-sans text-xs text-gray-500 leading-relaxed">
                Sending is a <strong>dry run</strong>: the real, consented audience is resolved and recorded below, but
                no email is actually delivered. Wire in a marketing email provider before enabling real sends.
              </p>
            </div>

            {campaign.sentAt ? (
              <div className="space-y-2">
                <p className="font-sans text-sm text-gray-700">Dry run completed {fmtDateTime(campaign.sentAt)}</p>
                <p className="font-display italic text-2xl text-[#2d6a4f]">{campaign.audienceCountSnapshot?.toLocaleString() ?? 0} recipients resolved</p>
              </div>
            ) : sendable ? (
              confirmSend ? (
                <div className="space-y-3">
                  <p className="font-sans text-sm text-gray-700">
                    Confirm dry-run send to <strong>{liveAudienceCount ?? '…'}</strong> consented recipient{liveAudienceCount === 1 ? '' : 's'} in
                    &ldquo;{segmentName}&rdquo;? No real email will be sent.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleSend} disabled={sending} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50">
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {sending ? 'Sending…' : 'Confirm Dry-Run Send'}
                    </button>
                    <button onClick={() => setConfirmSend(false)} className="font-sans text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmSend(true)} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245a41] transition-colors">
                  <Send size={14} /> Send (Dry Run)
                </button>
              )
            ) : (
              <p className="font-sans text-sm text-gray-400">
                {!campaign.templateId ? 'Add a template before sending.'
                  : campaign.audienceMode === 'manual' && campaign.recipientUserIds.length === 0 ? 'Pick at least one contact before sending.'
                  : `This campaign is ${STATUS_LABEL[campaign.status].toLowerCase()} and can't be sent.`}
              </p>
            )}
          </div>

          {/* Template */}
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-lg text-[#000000] mb-4">Template</h2>
            {template ? (
              <div>
                <p className="font-sans text-sm font-medium">{template.name}</p>
                <p className="font-sans text-xs text-gray-400 mt-1">{template.subject}</p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowPreview(v => !v)} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline"><Eye size={12} /> {showPreview ? 'Hide preview' : 'Preview personalised'}</button>
                  <Link href={`/admin/campaigns/templates/${template.id}/edit`} className="font-sans text-xs text-gray-400 hover:text-[#2d6a4f]">Edit template</Link>
                </div>
                {showPreview && (
                  <div className="mt-4">
                    <PersonalisedPreview template={template} recipients={previewRecipients} mergeValues={campaign.mergeValues} height={520} />
                  </div>
                )}
              </div>
            ) : (
              <p className="font-sans text-sm text-gray-400 inline-flex items-center gap-2"><FileText size={14} /> No template attached.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Audience */}
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-lg text-[#000000] mb-4">Audience</h2>
            <p className="font-sans text-sm text-gray-700">{segmentName}</p>
            <p className="font-sans text-xs text-gray-400 mt-2 inline-flex items-center gap-1.5">
              <Users size={12} />
              {campaign.audienceCountSnapshot !== null
                ? `${campaign.audienceCountSnapshot.toLocaleString()} at send time`
                : liveAudienceCount === null ? 'Calculating…' : `${liveAudienceCount.toLocaleString()} currently consented`}
            </p>
            {campaign.audienceMode === 'manual' && previewRecipients.length > 0 && (
              <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {previewRecipients.map(c => (
                  <li key={c.id} className="font-sans text-xs text-gray-600 truncate">{c.fullName} <span className="text-gray-400">· {c.email}</span></li>
                ))}
              </ul>
            )}
          </div>

          {mergeEntries.length > 0 && (
            <div className="bg-white border border-gray-200 p-6">
              <h2 className="font-display italic text-lg text-[#000000] mb-4">Campaign Details</h2>
              <dl className="space-y-2">
                {mergeEntries.map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[11px] text-gray-400">{`{{${k}}}`}</dt>
                    <dd className="font-sans text-sm text-gray-700 break-words">{v || <span className="text-gray-300">(empty)</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Schedule + notes */}
          <div className="bg-white border border-gray-200 p-6 space-y-4">
            <div>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1">Scheduled</p>
              <p className="font-sans text-sm text-gray-700">{fmtDateTime(campaign.scheduledAt)}</p>
            </div>
            {campaign.notes && (
              <div>
                <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1">Notes</p>
                <p className="font-sans text-sm text-gray-600 whitespace-pre-wrap">{campaign.notes}</p>
              </div>
            )}
          </div>

          {/* Lifecycle actions */}
          {!['cancelled'].includes(campaign.status) && (
            <div className="bg-white border border-gray-200 p-6 space-y-2">
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-2">Actions</p>
              {campaign.status !== 'paused' && ['draft', 'scheduled'].includes(campaign.status) && (
                <button onClick={() => handleStatus('paused')} className="w-full inline-flex items-center gap-2 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"><Pause size={14} /> Pause</button>
              )}
              {campaign.status === 'paused' && (
                <button onClick={() => handleStatus('draft')} className="w-full inline-flex items-center gap-2 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"><Play size={14} /> Resume to Draft</button>
              )}
              {!['sent', 'dry_run_sent'].includes(campaign.status) && (
                <button onClick={() => handleStatus('cancelled')} className="w-full inline-flex items-center gap-2 border border-red-200 px-4 py-2.5 font-sans text-sm text-red-400 hover:bg-red-50 transition-colors"><XCircle size={14} /> Cancel</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
