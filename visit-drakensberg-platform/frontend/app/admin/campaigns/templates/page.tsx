'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, FileText, ArrowLeft } from 'lucide-react'
import { getEmailTemplates, type EmailTemplate } from '@/lib/email-campaigns-admin'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { getEmailTemplates().then(t => { setTemplates(t); setLoading(false) }) }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Campaigns</Link>

      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Email Templates</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Reusable subject + body content for campaigns.</p>
        </div>
        <Link href="/admin/campaigns/templates/new"
          className="inline-flex items-center justify-center gap-2 bg-[#2d6a4f] text-white px-4 py-3 sm:py-2 font-sans text-sm hover:bg-[#245a41] transition-colors shrink-0">
          <Plus size={14} /> New Template
        </Link>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading templates…</p>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <FileText size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No templates yet</p>
          <p className="font-sans text-sm text-gray-400 mb-5">Create your first email template to start building campaigns.</p>
          <Link href="/admin/campaigns/templates/new" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors">New Template</Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 divide-y divide-gray-100">
          {templates.map(t => (
            <Link key={t.id} href={`/admin/campaigns/templates/${t.id}/edit`} className="flex items-center justify-between gap-4 p-4 sm:p-5 hover:bg-[#F7F5F2] transition-colors">
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium truncate">{t.name}</p>
                <p className="font-sans text-xs text-gray-400 truncate mt-0.5">{t.subject || 'No subject set'}</p>
              </div>
              <p className="font-sans text-xs text-gray-300 shrink-0">Updated {fmtDate(t.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
