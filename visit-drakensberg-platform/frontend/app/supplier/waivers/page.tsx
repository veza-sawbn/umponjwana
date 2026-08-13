'use client'

/**
 * /supplier/waivers — waiver forms and the signatures they've collected.
 *
 * Two tabs: the forms the supplier has written, and every waiver sent to a
 * participant with its current status. Signed waivers open read-only — they
 * are legal records and the database has no update path for them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FileSignature, Plus, Send, Copy, Check, X, Eye, RefreshCw, Search, Ban,
} from 'lucide-react'
import {
  getMyWaiverTemplates, getMyWaiverRequests, deleteWaiverTemplate,
  voidWaiverRequest, waiverUrl,
  type WaiverTemplate, type WaiverRequestDetails,
} from '@/lib/waivers'
import SendWaiverModal from '@/components/waivers/SendWaiverModal'
import WaiverSubmissionPanel from '@/components/waivers/WaiverSubmissionPanel'

const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  signed: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-gray-100 text-gray-500',
  void: 'bg-red-50 text-red-600',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(waiverUrl(token))
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          toast.error('Could not copy the link.')
        }
      }}
      className="inline-flex items-center gap-1 font-sans text-xs text-black/40 hover:text-[#C9A96E] transition-colors"
      title="Copy the participant's link"
    >
      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Link</>}
    </button>
  )
}

export default function WaiversPage() {
  const [tab, setTab] = useState<'sent' | 'forms'>('sent')
  const [templates, setTemplates] = useState<WaiverTemplate[]>([])
  const [requests, setRequests] = useState<WaiverRequestDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [viewing, setViewing] = useState<WaiverRequestDetails | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [t, r] = await Promise.all([getMyWaiverTemplates(), getMyWaiverRequests()])
    setTemplates(t)
    setRequests(r)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return requests
    return requests.filter(r =>
      r.participant_name?.toLowerCase().includes(q) ||
      r.participant_email?.toLowerCase().includes(q) ||
      r.activity_name?.toLowerCase().includes(q) ||
      r.booking_reference?.toLowerCase().includes(q),
    )
  }, [requests, search])

  const counts = useMemo(() => ({
    pending: requests.filter(r => r.status === 'pending').length,
    signed: requests.filter(r => r.status === 'signed').length,
  }), [requests])

  async function removeTemplate(t: WaiverTemplate) {
    if (!confirm(`Delete "${t.title}"?`)) return
    try {
      await deleteWaiverTemplate(t.id)
      toast.success('Waiver form deleted.')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the form.')
    }
  }

  async function withdraw(r: WaiverRequestDetails) {
    if (!confirm(`Withdraw the waiver sent to ${r.participant_name || r.participant_email}? Their link stops working immediately.`)) return
    try {
      await voidWaiverRequest(r.id)
      toast.success('Waiver withdrawn.')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not withdraw this waiver.')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display italic text-2xl text-black/90 flex items-center gap-2">
            <FileSignature size={20} className="text-[#C9A96E]" /> Waivers
          </h1>
          <p className="font-sans text-sm text-black/40 mt-1">
            {counts.pending} awaiting signature · {counts.signed} signed
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 border border-black/15 px-3 py-2 rounded-lg font-sans text-sm text-black/50 hover:border-[#C9A96E]/50 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <Link
            href="/supplier/waivers/new"
            className="inline-flex items-center gap-2 border border-black/15 px-3 py-2 rounded-lg font-sans text-sm text-black/50 hover:border-[#C9A96E]/50 transition-colors"
          >
            <Plus size={14} /> New form
          </Link>
          <button
            onClick={() => {
              if (templates.filter(t => t.is_active).length === 0) {
                toast.error('Create a waiver form first.')
                return
              }
              setSending(true)
            }}
            className="inline-flex items-center gap-2 bg-[#C9A96E] text-white px-4 py-2 rounded-lg font-sans text-sm hover:bg-[#b8965d] transition-colors"
          >
            <Send size={14} /> Send waiver
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-black/8 mb-5">
        {([['sent', `Sent (${requests.length})`], ['forms', `Forms (${templates.length})`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 font-sans text-sm border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-[#C9A96E] text-black/80'
                : 'border-transparent text-black/35 hover:text-black/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="font-sans text-sm text-black/30">Loading…</p>
      ) : tab === 'sent' ? (
        <>
          <div className="relative max-w-sm mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search participant, activity or reference…"
              className="w-full font-sans text-sm border border-black/10 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white border border-black/8 rounded-xl p-8 text-center">
              <p className="font-sans text-sm text-black/30">
                {requests.length === 0
                  ? 'No waivers sent yet. Create a form, then send it to your participants.'
                  : 'No waivers match your search.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-black/8 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-black/5">
                    {['Participant', 'Activity', 'Date', 'Form', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-black/30">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-black/[0.015]">
                      <td className="px-5 py-4">
                        <p className="font-sans text-sm text-black/80">{r.participant_name || '—'}</p>
                        <p className="font-sans text-[11px] text-black/35 mt-0.5">{r.participant_email}</p>
                      </td>
                      <td className="px-5 py-4 font-sans text-sm text-black/60">{r.activity_name || '—'}</td>
                      <td className="px-5 py-4 font-sans text-xs text-black/40">{fmt(r.service_date)}</td>
                      <td className="px-5 py-4 font-sans text-xs text-black/40">{r.template_title}</td>
                      <td className="px-5 py-4">
                        <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 rounded ${STATUS_CHIP[r.status] ?? ''}`}>
                          {r.status}
                        </span>
                        {r.signed_at && (
                          <p className="font-sans text-[10px] text-black/30 mt-1">{fmt(r.signed_at)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 justify-end">
                          {r.status === 'signed' ? (
                            <button
                              onClick={() => setViewing(r)}
                              className="inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline"
                            >
                              <Eye size={12} /> View
                            </button>
                          ) : r.status === 'pending' ? (
                            <>
                              <CopyLink token={r.token} />
                              <button
                                onClick={() => withdraw(r)}
                                className="inline-flex items-center gap-1 font-sans text-xs text-black/30 hover:text-red-500 transition-colors"
                              >
                                <Ban size={12} /> Withdraw
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3 bg-white border border-black/8 rounded-xl p-8 text-center">
              <p className="font-sans text-sm text-black/30 mb-3">
                No waiver forms yet.
              </p>
              <Link
                href="/supplier/waivers/new"
                className="inline-flex items-center gap-2 bg-[#C9A96E] text-white px-4 py-2 rounded-lg font-sans text-sm hover:bg-[#b8965d] transition-colors"
              >
                <Plus size={14} /> Create your first form
              </Link>
            </div>
          ) : templates.map(t => (
            <div key={t.id} className="bg-white border border-black/8 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-sans text-sm font-medium text-black/80 min-w-0">{t.title}</p>
                <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 rounded shrink-0 ${
                  t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {t.is_active ? 'Active' : 'Draft'}
                </span>
              </div>
              <p className="font-sans text-xs text-black/35 leading-relaxed line-clamp-3">
                {t.intro || 'No introduction text.'}
              </p>
              <p className="font-sans text-[11px] text-black/30 mt-3">
                {t.clauses.length} clause{t.clauses.length !== 1 ? 's' : ''} ·{' '}
                {requests.filter(r => r.template_id === t.id).length} sent
              </p>
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-black/5">
                <Link
                  href={`/supplier/waivers/${t.id}`}
                  className="font-sans text-xs text-[#2d6a4f] hover:underline"
                >
                  Edit
                </Link>
                <button
                  onClick={() => removeTemplate(t)}
                  className="font-sans text-xs text-black/30 hover:text-red-500 transition-colors ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sending && (
        <SendWaiverModal
          templates={templates.filter(t => t.is_active)}
          onClose={() => setSending(false)}
          onSent={() => { setSending(false); load() }}
        />
      )}
      {viewing && (
        <WaiverSubmissionPanel request={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
