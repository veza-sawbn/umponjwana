'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Trash2 } from 'lucide-react'
import { saveEmailTemplate, deleteEmailTemplate, type EmailTemplate } from '@/lib/email-campaigns-admin'

const inputClass = 'w-full bg-white border border-gray-200 px-4 py-2.5 font-sans text-sm text-[#000000] placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] transition-colors'
const labelClass = 'font-sans text-xs tracking-[0.1em] uppercase text-gray-400 block mb-2'

export default function EmailTemplateForm({ template }: { template: EmailTemplate | null }) {
  const router = useRouter()
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [preheader, setPreheader] = useState(template?.preheader ?? '')
  const [htmlBody, setHtmlBody] = useState(template?.htmlBody ?? '')
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Debounced live preview through the server-rendered branded shell
  // (lib/email-layout.ts is server-only, so this fetches app/api/admin/campaigns/preview).
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/admin/campaigns/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, preheader, htmlBody }),
      }).then(r => r.json()).then(d => setPreviewHtml(d.html ?? '')).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [subject, preheader, htmlBody])

  async function handleSave() {
    if (!name.trim() || !subject.trim()) { setError('Name and subject are required.'); return }
    setSaving(true); setError('')
    const { id, error: err } = await saveEmailTemplate(template?.id ?? null, { name, subject, preheader, htmlBody })
    setSaving(false)
    if (err) { setError(err); return }
    router.push(id ? `/admin/campaigns/templates/${id}/edit` : '/admin/campaigns/templates')
    router.refresh()
  }

  async function handleDelete() {
    if (!template || !confirm(`Delete template "${template.name}"? This can't be undone.`)) return
    setDeleting(true)
    const { error: err } = await deleteEmailTemplate(template.id)
    setDeleting(false)
    if (err) { setError(err); return }
    router.push('/admin/campaigns/templates')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      <div className="space-y-5">
        {error && <p className="font-sans text-sm text-red-500">{error}</p>}
        <div>
          <label className={labelClass}>Template Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Winter Hiking Campaign" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Subject Line</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your next Drakensberg adventure awaits" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Preheader (inbox preview text)</label>
          <input value={preheader} onChange={e => setPreheader(e.target.value)} placeholder="Optional — shown next to the subject in most inboxes" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Body (HTML)</label>
          <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} rows={16}
            placeholder="<p>Hi there,</p><p>The berg is calling...</p>"
            className={`${inputClass} font-mono text-xs leading-relaxed`} />
          <p className="font-sans text-xs text-gray-400 mt-2">Rendered inside the standard Visit Drakensberg branded shell — this box is just the content that goes inside it.</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving…' : 'Save Template'}
          </button>
          {template && (
            <button onClick={handleDelete} disabled={deleting}
              className="inline-flex items-center gap-2 border border-red-200 text-red-400 px-6 py-3 font-sans text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
              <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Live Preview</label>
        <div className="border border-gray-200 bg-[#F7F5F2] h-[640px] overflow-hidden">
          {previewHtml ? (
            <iframe srcDoc={previewHtml} title="Email preview" className="w-full h-full border-0" sandbox="" />
          ) : (
            <div className="h-full flex items-center justify-center font-sans text-sm text-gray-400">Preview loading…</div>
          )}
        </div>
      </div>
    </div>
  )
}
