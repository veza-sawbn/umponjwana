'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Send, FileText, AlertTriangle } from 'lucide-react'
import { getEmailCampaigns, type EmailCampaign } from '@/lib/email-campaigns-admin'

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
const TYPE_LABEL: Record<EmailCampaign['campaignType'], string> = {
  broadcast: 'Broadcast', segmented: 'Segmented', behavioral: 'Behavioural', lifecycle: 'Lifecycle',
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { getEmailCampaigns().then(c => { setCampaigns(c); setLoading(false) }) }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Email Campaigns</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Create, target and send campaign emails to consented customers.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/admin/campaigns/templates" className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
            <FileText size={14} /> Templates
          </Link>
          <Link href="/admin/campaigns/new" className="inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-3 sm:py-2 font-sans text-sm hover:bg-[#245a41] transition-colors">
            <Plus size={14} /> New Campaign
          </Link>
        </div>
      </div>

      <div className="mb-6 bg-white border border-gray-200 p-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-[#C9A96E] shrink-0 mt-0.5" />
        <p className="font-sans text-xs text-gray-500 leading-relaxed">
          Sending is currently a <strong>dry run</strong> — the real, consented audience is resolved and recorded, but no
          email actually leaves the platform. Real delivery needs a marketing email provider wired in first (the existing
          transactional mailbox isn&apos;t suited to bulk sends).
        </p>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Send size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No campaigns yet</p>
          <p className="font-sans text-sm text-gray-400 mb-5">Create your first campaign to reach consented customers.</p>
          <Link href="/admin/campaigns/new" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors">New Campaign</Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 divide-y divide-gray-100">
          {campaigns.map(c => (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="flex items-center justify-between gap-4 p-4 sm:p-5 hover:bg-[#F7F5F2] transition-colors">
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium truncate">{c.name}</p>
                <p className="font-sans text-xs text-gray-400 mt-0.5">
                  {TYPE_LABEL[c.campaignType]}
                  {c.audienceCountSnapshot !== null ? ` · ${c.audienceCountSnapshot.toLocaleString()} recipients` : ''}
                  {c.sentAt ? ` · ${fmtDate(c.sentAt)}` : ''}
                </p>
              </div>
              <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 shrink-0 ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
