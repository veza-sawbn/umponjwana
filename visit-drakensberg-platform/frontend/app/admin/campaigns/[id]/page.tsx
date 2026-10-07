'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Send, Pause, Play, XCircle, Eye, AlertTriangle, Users, FileText, Mail } from 'lucide-react'
import {
  getEmailCampaign, getEmailTemplate, getAudienceSegmentOptions, getConsentedAudienceCount,
  getConsentedRecipientCount, getCampaignContacts,
  dryRunSendCampaign, setCampaignStatus, getSendReadiness, sendCampaignNow, sendTestEmail, getCampaignStats,
  type EmailCampaign, type EmailTemplate, type CampaignContact, type SendReadiness, type CampaignStats,
} from '@/lib/email-campaigns-admin'
import type { SegmentCount } from '@/lib/customers-admin'
import PersonalisedPreview from '@/components/admin/campaigns/PersonalisedPreview'

const STATUS_LABEL: Record<EmailCampaign['status'], string> = {
  draft: 'Draft', scheduled: 'Scheduled', sending: 'Sending', dry_run_sent: 'Dry Run Sent', sent: 'Sent', paused: 'Paused', cancelled: 'Cancelled',
}
const STATUS_STYLE: Record<EmailCampaign['status'], string> = {
  draft: 'bg-gray-100 text-gray-500',
  scheduled: 'bg-blue-50 text-blue-600',
  sending: 'bg-blue-50 text-blue-600',
  dry_run_sent: 'bg-[#C9A96E]/15 text-[#8B6914]',
  sent: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  paused: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-400',
}

function fmtDateTime(d: string | null) {
  return d ? new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

function pct(n: number, d: number) {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—'
}

/** Delivery progress and engagement for a real send. */
function SendProgress({ campaign, stats }: { campaign: EmailCampaign; stats: CampaignStats | null }) {
  const r = stats?.recipients ?? {}
  const e = stats?.events ?? {}
  const total = campaign.audienceCountSnapshot ?? Object.values(r).reduce((a, b) => a + b, 0)
  const sent = (r.sent ?? 0) + (r.bounced ?? 0) + (r.complained ?? 0)
  const waiting = (r.queued ?? 0) + (r.sending ?? 0)
  const stopped = (r.failed ?? 0) + (r.suppressed ?? 0)
  const done = sent + stopped
  const tile = (label: string, value: number | string, hint?: string) => (
    <div className="border border-gray-100 px-3 py-2.5">
      <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{label}</p>
      <p className="font-display italic text-xl text-[#000000] mt-0.5">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {hint && <p className="font-sans text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-sans text-sm text-gray-700">
            {campaign.status === 'sending' ? 'Sending…' : campaign.status === 'paused' ? 'Paused' : `Finished ${fmtDateTime(campaign.completedAt)}`}
          </p>
          <p className="font-sans text-xs text-gray-400">{done.toLocaleString()} of {total.toLocaleString()} processed</p>
        </div>
        <div className="h-2 bg-gray-100"><div className="h-2 bg-[#2d6a4f] transition-all" style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }} /></div>
        {campaign.status === 'sending' && waiting > 0 && (
          <p className="font-sans text-[11px] text-gray-400 mt-2">{waiting.toLocaleString()} still queued. Delivery is paced by the daily cap and continues automatically.</p>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tile('Sent', sent)}
        {tile('Delivered', e.delivered ?? 0, pct(e.delivered ?? 0, sent))}
        {tile('Opened', e.opened ?? 0, pct(e.opened ?? 0, sent))}
        {tile('Clicked', e.clicked ?? 0, pct(e.clicked ?? 0, sent))}
        {tile('Bounced', (r.bounced ?? 0), pct(r.bounced ?? 0, sent))}
        {tile('Unsubscribed', e.unsubscribed ?? 0, pct(e.unsubscribed ?? 0, sent))}
        {tile('Complaints', r.complained ?? 0, pct(r.complained ?? 0, sent))}
        {tile('Skipped', stopped, 'consent withdrawn, suppressed or failed')}
      </div>
      <p className="font-sans text-[11px] text-gray-400 leading-relaxed">
        Opens are approximate: Apple Mail and some security scanners load images automatically, so treat clicks and
        replies as the reliable signal. Keep complaints under 0.1% and bounces under 2% — if either climbs, pause and
        check the audience before sending more.
      </p>
    </div>
  )
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
  const [readiness, setReadiness] = useState<SendReadiness | null | undefined>(undefined)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [testNote, setTestNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [dryRunning, setDryRunning] = useState(false)

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
  useEffect(() => { getSendReadiness().then(setReadiness) }, [])

  // Progress while a send is draining; stats afterwards. Refreshes itself every
  // 15s only while the campaign is actually sending.
  const status = campaign?.status
  useEffect(() => {
    const id = params?.id
    if (!id || !status || !['sending', 'sent', 'paused'].includes(status)) return
    let alive = true
    const pull = async () => {
      const st = await getCampaignStats(id)
      if (alive) setStats(st)
      if (alive && status === 'sending') { const c = await getEmailCampaign(id); if (alive && c) setCampaign(c) }
    }
    pull()
    if (status !== 'sending') return () => { alive = false }
    const t = setInterval(pull, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [params?.id, status])

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
    const { error: err } = await sendCampaignNow(campaign.id)
    setSending(false); setConfirmSend(false)
    if (err) { setError(err); return }
    await load()
  }

  async function handleDryRun() {
    if (!campaign) return
    setDryRunning(true); setError('')
    const { error: err } = await dryRunSendCampaign(campaign.id)
    setDryRunning(false)
    if (err) { setError(err); return }
    await load()
  }

  async function handleTest() {
    if (!campaign) return
    const to = testTo.split(/[\s,;]+/).map(a => a.trim()).filter(Boolean)
    if (to.length === 0) return
    setTesting(true); setTestNote(null)
    const { results, error: err } = await sendTestEmail({ campaignId: campaign.id, to })
    setTesting(false)
    if (err) { setTestNote({ ok: false, text: err }); return }
    const failed = results.filter(r => !r.ok)
    setTestNote(failed.length === 0
      ? { ok: true, text: `Test sent to ${results.map(r => r.to).join(', ')}. Check the inbox AND spam, and open "Show original" in Gmail to confirm SPF/DKIM/DMARC pass.` }
      : { ok: false, text: failed.map(r => `${r.to}: ${r.error}`).join(' · ') })
  }

  async function handleStatus(status: 'paused' | 'cancelled' | 'draft' | 'sending') {
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
          {/* Send panel */}
          <div className="bg-white border border-gray-200 p-6">
            {readiness && !readiness.ready && ['draft', 'scheduled'].includes(campaign.status) && (
              <div className="flex items-start gap-3 mb-5">
                <AlertTriangle size={16} className="text-[#C9A96E] shrink-0 mt-0.5" />
                <p className="font-sans text-xs text-gray-500 leading-relaxed">
                  Real sending isn&apos;t enabled on this deployment yet — missing <code>{readiness.missing.join(', ')}</code>.
                  You can still run a <strong>dry run</strong> below, which counts the audience without delivering anything.
                </p>
              </div>
            )}

            {campaign.lastError && (
              <p className="font-sans text-xs text-red-500 mb-4 break-words"><strong>Needs attention:</strong> {campaign.lastError}</p>
            )}

            {['sending', 'sent', 'paused'].includes(campaign.status) && !campaign.dryRun ? (
              <SendProgress campaign={campaign} stats={stats} />
            ) : campaign.status === 'dry_run_sent' ? (
              <div className="space-y-2">
                <p className="font-sans text-sm text-gray-700">Dry run completed {fmtDateTime(campaign.sentAt)} — nothing was delivered.</p>
                <p className="font-display italic text-2xl text-[#2d6a4f]">{campaign.audienceCountSnapshot?.toLocaleString() ?? 0} recipients resolved</p>
              </div>
            ) : sendable ? (
              <div className="space-y-5">
                {/* 1. Test */}
                {readiness?.ready && (
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-2">1 · Send yourself a test</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@example.com, colleague@example.com"
                        className="flex-1 bg-white border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                      <button onClick={handleTest} disabled={testing || !testTo.trim()}
                        className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50">
                        {testing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send test
                      </button>
                    </div>
                    {testNote && <p className={`font-sans text-xs mt-2 ${testNote.ok ? 'text-[#2d6a4f]' : 'text-red-500'}`}>{testNote.text}</p>}
                  </div>
                )}

                {/* 2. Send */}
                <div>
                  {readiness?.ready && <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-2">2 · Send to the audience</p>}
                  {confirmSend ? (
                    <div className="space-y-3">
                      <p className="font-sans text-sm text-gray-700">
                        This will <strong>really send</strong> to up to <strong>{liveAudienceCount ?? '…'}</strong> consented recipient{liveAudienceCount === 1 ? '' : 's'} in
                        &ldquo;{segmentName}&rdquo;. Delivery is paced to the daily cap of {readiness?.dailyCap?.toLocaleString() ?? '—'}, so a larger audience finishes over several days.
                        It can be paused, but emails already sent can&apos;t be recalled.
                      </p>
                      <div className="flex gap-3">
                        <button onClick={handleSend} disabled={sending} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50">
                          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {sending ? 'Starting…' : 'Yes, send now'}
                        </button>
                        <button onClick={() => setConfirmSend(false)} className="font-sans text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => setConfirmSend(true)} disabled={!readiness?.ready}
                        title={readiness?.ready ? undefined : 'Real sending is not enabled on this deployment yet'}
                        className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <Send size={14} /> Send campaign
                      </button>
                      <button onClick={handleDryRun} disabled={dryRunning}
                        className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50">
                        {dryRunning ? <Loader2 size={14} className="animate-spin" /> : null} Dry run (count only)
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
              {campaign.status !== 'paused' && ['draft', 'scheduled', 'sending'].includes(campaign.status) && (
                <button onClick={() => handleStatus('paused')} className="w-full inline-flex items-center gap-2 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"><Pause size={14} /> Pause</button>
              )}
              {campaign.status === 'paused' && (
                <button onClick={() => handleStatus(campaign.startedAt && !campaign.dryRun ? 'sending' : 'draft')} className="w-full inline-flex items-center gap-2 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"><Play size={14} /> {campaign.startedAt && !campaign.dryRun ? 'Resume sending' : 'Resume to Draft'}</button>
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
