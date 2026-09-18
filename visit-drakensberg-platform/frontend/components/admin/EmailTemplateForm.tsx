'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Trash2, Sparkles } from 'lucide-react'
import { saveEmailTemplate, deleteEmailTemplate, type EmailTemplate } from '@/lib/email-campaigns-admin'

const inputClass = 'w-full bg-white border border-gray-200 px-4 py-2.5 font-sans text-sm text-[#000000] placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] transition-colors'
const labelClass = 'font-sans text-xs tracking-[0.1em] uppercase text-gray-400 block mb-2'

// Mirrors what app/api/admin/campaigns/starters returns. The bodies are built
// server-side from lib/email-layout.ts's blocks, so this component never
// imports that module (it is SERVER ONLY) and never keeps a second copy of the
// markup that would drift away from the design system.
type Starter = {
  id: string
  name: string
  description: string
  subject: string
  preheader: string
  heroAlt: string
  htmlBody: string
}

export default function EmailTemplateForm({ template }: { template: EmailTemplate | null }) {
  const router = useRouter()
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [preheader, setPreheader] = useState(template?.preheader ?? '')
  const [htmlBody, setHtmlBody] = useState(template?.htmlBody ?? '')
  const [heroImageUrl, setHeroImageUrl] = useState(template?.heroImageUrl ?? '')
  const [heroImageAlt, setHeroImageAlt] = useState(template?.heroImageAlt ?? '')
  const [starters, setStarters] = useState<Starter[]>([])
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Only offered on a new template. Dropping a starter over a template someone
  // has already written would be a one-click way to lose their work, and the
  // textarea has no undo across a full replacement.
  useEffect(() => {
    if (template) return
    fetch('/api/admin/campaigns/starters')
      .then(r => r.json()).then(d => setStarters(d.starters ?? [])).catch(() => {})
  }, [template])

  // Debounced live preview through the server-rendered branded shell
  // (lib/email-layout.ts is server-only, so this fetches app/api/admin/campaigns/preview).
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/admin/campaigns/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, preheader, htmlBody, heroImageUrl, heroImageAlt }),
      }).then(r => r.json()).then(d => setPreviewHtml(d.html ?? '')).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [subject, preheader, htmlBody, heroImageUrl, heroImageAlt])

  function applyStarter(s: Starter) {
    if (htmlBody.trim() && !confirm(`Replace what you have written with the "${s.name}" starter?`)) return
    setName(n => n || s.name)
    setSubject(s.subject)
    setPreheader(s.preheader)
    setHtmlBody(s.htmlBody)
    setHeroImageAlt(s.heroAlt)
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim()) { setError('Name and subject are required.'); return }
    // Not a nicety: Outlook blocks images by default, and so does Gmail for a
    // sender the reader has not written to, so a hero with no alt text is a
    // blank band for a large slice of any campaign's audience.
    if (heroImageUrl.trim() && !heroImageAlt.trim()) {
      setError('Describe the hero image in the alt text field — it is what readers with images blocked will see instead.')
      return
    }
    setSaving(true); setError('')
    const { id, error: err } = await saveEmailTemplate(template?.id ?? null, {
      name, subject, preheader, htmlBody, heroImageUrl, heroImageAlt,
    })
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

        {starters.length > 0 && (
          <div className="border border-gray-200 bg-[#F7F5F2] p-4">
            <p className="font-sans text-xs tracking-[0.1em] uppercase text-gray-400 mb-1 flex items-center gap-1.5">
              <Sparkles size={12} /> Start from a template
            </p>
            <p className="font-sans text-xs text-gray-500 mb-3">
              House editorial structures, already in Visit Drakensberg branding. Everything in square
              brackets is yours to replace — nothing is filled in automatically on send.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {starters.map(s => (
                <button key={s.id} type="button" onClick={() => applyStarter(s)}
                  className="text-left bg-white border border-gray-200 p-3 hover:border-[#2d6a4f] transition-colors">
                  <span className="font-sans text-sm block">{s.name}</span>
                  <span className="font-sans text-xs text-gray-400 block mt-0.5 leading-snug">{s.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
          <input value={preheader} onChange={e => setPreheader(e.target.value)} placeholder="Optional. Shown next to the subject in most inboxes" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Hero Image URL</label>
          <input value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)}
            placeholder="https://… — optional, shown full width above the body" className={inputClass} />
          <p className="font-sans text-xs text-gray-400 mt-2">
            Landscape, roughly 1280&times;720, hosted over HTTPS and under about 500&nbsp;KB. Leave empty for a text-led email.
          </p>
        </div>
        {heroImageUrl.trim() && (
          <div>
            <label className={labelClass}>Hero Image Alt Text</label>
            <input value={heroImageAlt} onChange={e => setHeroImageAlt(e.target.value)}
              placeholder="Sunrise over the Amphitheatre from the Sentinel car park" className={inputClass} />
            <p className="font-sans text-xs text-gray-400 mt-2">
              Required. Outlook blocks images by default, and Gmail does too for senders the reader
              hasn&apos;t written to — for them this line is the hero.
            </p>
          </div>
        )}
        <div>
          <label className={labelClass}>Body (HTML)</label>
          <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} rows={16}
            placeholder="<p>Hi there,</p><p>The berg is calling...</p>"
            className={`${inputClass} font-mono text-xs leading-relaxed`} />
          <p className="font-sans text-xs text-gray-400 mt-2">Rendered inside the standard Visit Drakensberg branded shell. This box is just the content that goes inside it.</p>
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
        <p className="font-sans text-xs text-gray-400 mt-2">
          Shown with the promotional footer — address, preferences and unsubscribe — because every
          campaign goes only to marketing-consented contacts. Trip email uses a different footer.
        </p>
      </div>
    </div>
  )
}
