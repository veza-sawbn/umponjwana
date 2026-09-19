'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Send, AlertTriangle, Check, X, MinusCircle } from 'lucide-react'
import { getEmailTemplates, type EmailTemplate } from '@/lib/email-campaigns-admin'
import { getRecipients, type Recipient, type RecipientKind } from '@/lib/email-recipients'

const inputClass = 'w-full bg-white border border-gray-200 px-4 py-2.5 font-sans text-sm text-[#000000] placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] transition-colors'
const labelClass = 'font-sans text-xs tracking-[0.1em] uppercase text-gray-400 block mb-2'

// Mirrors MAX_RECIPIENTS in app/api/admin/campaigns/send. Duplicated here only
// so the UI can stop you before the round trip; the route is what enforces it.
const MAX_RECIPIENTS = 50

type Outcome = {
  email: string
  name: string
  status: 'sent' | 'skipped_no_consent' | 'skipped_opted_out' | 'failed'
  detail: string
}

const KIND_LABEL: Record<RecipientKind, string> = { customer: 'Customer', contact: 'Directory' }

const STATUS_ICON = {
  sent: <Check size={13} className="text-[#2d6a4f]" />,
  failed: <X size={13} className="text-red-400" />,
  skipped_no_consent: <MinusCircle size={13} className="text-gray-300" />,
  skipped_opted_out: <MinusCircle size={13} className="text-[#C9A96E]" />,
} as const

export default function ManualSendForm() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [templateId, setTemplateId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | RecipientKind>('all')
  const [sendableOnly, setSendableOnly] = useState(true)

  const [previewHtml, setPreviewHtml] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getEmailTemplates(), getRecipients()]).then(([t, r]) => {
      setTemplates(t)
      setRecipients(r.recipients)
      if (r.error) setLoadError(r.error)
      setLoading(false)
    })
  }, [])

  const template = templates.find(t => t.id === templateId) ?? null

  // Same shell the send route will use, so what is approved here is what goes.
  useEffect(() => {
    if (!template) { setPreviewHtml(''); return }
    fetch('/api/admin/campaigns/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: template.subject, preheader: template.preheader, htmlBody: template.htmlBody,
        heroImageUrl: template.heroImageUrl, heroImageAlt: template.heroImageAlt,
      }),
    }).then(r => r.json()).then(d => setPreviewHtml(d.html ?? '')).catch(() => {})
  }, [template])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipients.filter(r => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false
      if (sendableOnly && !r.sendable) return false
      if (!q) return true
      return r.name.toLowerCase().includes(q) || r.email.includes(q) || r.detail.toLowerCase().includes(q)
    })
  }, [recipients, query, kindFilter, sendableOnly])

  const selectedList = useMemo(
    () => recipients.filter(r => selected.has(r.key)),
    [recipients, selected],
  )
  // Counted separately from the selection so the confirm step can say plainly
  // how many of the chosen addresses the server is going to decline to email.
  const blockedCount = selectedList.filter(r => !r.sendable).length

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAllFiltered() {
    // Adds up to the cap rather than silently taking the first 50 of a much
    // larger filter — the count next to the button says what will happen.
    setSelected(prev => {
      const next = new Set(prev)
      for (const r of filtered) {
        if (next.size >= MAX_RECIPIENTS) break
        next.add(r.key)
      }
      return next
    })
  }

  async function handleSend() {
    if (!template || selectedList.length === 0) return
    setSending(true); setError(''); setOutcomes(null)
    try {
      const res = await fetch('/api/admin/campaigns/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          recipients: selectedList.map(r => ({ email: r.email, name: r.name, kind: r.kind, id: r.id })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Send failed.'); return }
      setOutcomes(data.outcomes ?? [])
      setSelected(new Set())
      if (data.logged === false) {
        setError('The email was sent, but writing the audit log failed — check the server logs.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed.')
    } finally {
      setSending(false); setConfirming(false)
    }
  }

  if (loading) {
    return <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading templates and contacts…</p>
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="font-sans text-sm text-red-500">Some recipients could not be loaded: {loadError}</p>
      )}
      {error && <p className="font-sans text-sm text-red-500">{error}</p>}

      {outcomes && (
        <div className="bg-white border border-gray-200 p-4 sm:p-5">
          <p className="font-sans text-sm mb-3">
            <strong>{outcomes.filter(o => o.status === 'sent').length} sent</strong>
            {' · '}{outcomes.filter(o => o.status.startsWith('skipped')).length} skipped
            {' · '}{outcomes.filter(o => o.status === 'failed').length} failed
          </p>
          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {outcomes.map(o => (
              <div key={o.email} className="flex items-start gap-2.5 py-2">
                <span className="mt-0.5 shrink-0">{STATUS_ICON[o.status]}</span>
                <div className="min-w-0">
                  <p className="font-sans text-xs truncate">{o.name || o.email}</p>
                  <p className="font-sans text-xs text-gray-400 truncate">
                    {o.email}{o.detail ? ` — ${o.detail}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="space-y-5">
          <div>
            <label className={labelClass}>Template</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={inputClass}>
              <option value="">Choose a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {templates.length === 0 && (
              <p className="font-sans text-xs text-gray-400 mt-2">
                No templates yet — create one first, starting from one of the eleven house templates.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-end justify-between gap-3 mb-2">
              <label className={`${labelClass} mb-0`}>Recipients</label>
              <span className="font-sans text-xs text-gray-400">
                {selected.size} of {MAX_RECIPIENTS} selected
              </span>
            </div>

            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search name, email, region…" className={`${inputClass} pl-9`} />
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(['all', 'customer', 'contact'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKindFilter(k)}
                  className={`font-sans text-xs px-3 py-1.5 border transition-colors ${
                    kindFilter === k ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {k === 'all' ? 'All' : k === 'customer' ? 'Customers' : 'Directory'}
                </button>
              ))}
              <label className="font-sans text-xs text-gray-500 flex items-center gap-1.5 ml-1">
                <input type="checkbox" checked={sendableOnly} onChange={e => setSendableOnly(e.target.checked)} />
                Only those we may email
              </label>
              <button type="button" onClick={selectAllFiltered} disabled={filtered.length === 0}
                className="font-sans text-xs text-[#2d6a4f] hover:underline disabled:opacity-40 ml-auto">
                Select {Math.min(filtered.length, Math.max(0, MAX_RECIPIENTS - selected.size))} shown
              </button>
            </div>

            <div className="border border-gray-200 divide-y divide-gray-100 max-h-[380px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="font-sans text-sm text-gray-400 p-6 text-center">No matching contacts.</p>
              ) : filtered.slice(0, 300).map(r => (
                <label key={r.key} className="flex items-start gap-3 p-3 hover:bg-[#F7F5F2] cursor-pointer">
                  <input type="checkbox" className="mt-1 shrink-0"
                    checked={selected.has(r.key)}
                    disabled={!selected.has(r.key) && selected.size >= MAX_RECIPIENTS}
                    onChange={() => toggle(r.key)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm truncate">{r.name}</p>
                    <p className="font-sans text-xs text-gray-400 truncate">{r.email}</p>
                    <p className="font-sans text-[11px] text-gray-300 truncate mt-0.5">
                      {KIND_LABEL[r.kind]}{r.detail ? ` · ${r.detail}` : ''}
                    </p>
                  </div>
                  {!r.sendable && (
                    <span className="font-sans text-[10px] tracking-wide uppercase text-[#C9A96E] shrink-0 mt-1">
                      {r.consent === 'withdrawn' ? 'Opted out' : 'No consent'}
                    </span>
                  )}
                </label>
              ))}
            </div>
            {filtered.length > 300 && (
              <p className="font-sans text-xs text-gray-400 mt-2">
                Showing the first 300 of {filtered.length} matches — narrow the search to see the rest.
              </p>
            )}
          </div>

          {!confirming ? (
            <button onClick={() => setConfirming(true)} disabled={!template || selected.size === 0}
              className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-40">
              <Send size={14} /> Review and send
            </button>
          ) : (
            <div className="border border-[#C9A96E]/40 bg-[#C9A96E]/5 p-4">
              <p className="font-sans text-sm mb-2">
                Send <strong>{template?.name}</strong> to <strong>{selected.size - blockedCount}</strong>{' '}
                {selected.size - blockedCount === 1 ? 'recipient' : 'recipients'}?
              </p>
              <p className="font-sans text-xs text-gray-500 leading-relaxed mb-4">
                This sends real email, one message per recipient, from the Visit Drakensberg mailbox.
                {blockedCount > 0 && ` ${blockedCount} of the ${selected.size} selected will be skipped —
                  customers without marketing consent, and anyone who has opted out.`}
                {' '}It cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={handleSend} disabled={sending}
                  className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? 'Sending…' : 'Send now'}
                </button>
                <button onClick={() => setConfirming(false)} disabled={sending}
                  className="font-sans text-sm px-5 py-3 border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>Preview</label>
          <div className="border border-gray-200 bg-[#F7F5F2] h-[640px] overflow-hidden">
            {previewHtml ? (
              <iframe srcDoc={previewHtml} title="Email preview" className="w-full h-full border-0" sandbox="" />
            ) : (
              <div className="h-full flex items-center justify-center font-sans text-sm text-gray-400 px-8 text-center">
                Choose a template to preview it.
              </div>
            )}
          </div>
          <div className="mt-3 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-[#C9A96E] shrink-0 mt-0.5" />
            <p className="font-sans text-xs text-gray-500 leading-relaxed">
              Each recipient gets their own message with their own unsubscribe link — never a shared BCC.
              Customers are only emailed with marketing consent on record; directory businesses are emailed
              unless they have opted out. Every attempt is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
