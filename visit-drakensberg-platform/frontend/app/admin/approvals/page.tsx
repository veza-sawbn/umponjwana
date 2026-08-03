'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Check, X, MessageSquare, Clock, Building2 } from 'lucide-react'
import {
  getListingChanges, reviewListingChange,
  type ListingChange, type ListingChangeStatus,
} from '@/lib/partner-access'
import { supabase } from '@/lib/auth'

// Approval queue — supplier edits awaiting review.
//
// A change reaches this queue because the partner's access row does not
// auto-publish that field. Partners cannot write to the catalog directly and
// cannot resolve their own submissions, so this console is the only route from
// "submitted" to live (see 20260807_listing_approval_workflow.sql).

const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-[#C9A96E]/15 text-[#8B6914]',
  published: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  changes_requested: 'bg-blue-50 text-blue-500',
  rejected: 'bg-red-50 text-red-400',
}

const FILTERS: { key: ListingChangeStatus | 'all'; label: string }[] = [
  { key: 'submitted', label: 'Awaiting review' },
  { key: 'published', label: 'Published' },
  { key: 'changes_requested', label: 'Changes requested' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

function short(v: unknown): string {
  if (v === null || v === undefined) return '—'
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 160 ? `${s.slice(0, 160)}…` : s
}

function Diff({ change }: { change: ListingChange }) {
  return (
    <div className="space-y-3">
      {change.changed_fields.map(field => (
        <div key={field} className="border border-gray-100">
          <p className="px-3 py-1.5 bg-[#F7F5F2] font-sans text-[10px] tracking-[0.12em] uppercase text-gray-500">
            {field}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            <div className="p-3">
              <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-gray-400 mb-1">Current</p>
              <p className="font-sans text-xs text-gray-500 whitespace-pre-wrap break-words">
                {short(change.previous_value?.[field])}
              </p>
            </div>
            <div className="p-3 bg-[#2d6a4f]/[0.03]">
              <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-[#2d6a4f] mb-1">Proposed</p>
              <p className="font-sans text-xs text-gray-800 whitespace-pre-wrap break-words">
                {short(change.proposed_value?.[field])}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminApprovalsPage() {
  const [changes, setChanges] = useState<ListingChange[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [people, setPeople] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<ListingChangeStatus | 'all'>('submitted')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')

  async function load() {
    setLoading(true)
    const rows = await getListingChanges(filter === 'all' ? undefined : filter)
    setChanges(rows)
    try {
      const estIds = [...new Set(rows.map(r => r.establishment_id))]
      if (estIds.length) {
        const { data } = await supabase.from('vd_entities').select('id, value').in('id', estIds)
        const m: Record<string, string> = {}
        for (const e of (data ?? []) as { id: string; value: Record<string, unknown> }[]) {
          m[e.id] = String(e.value?.name ?? e.value?.title ?? e.id)
        }
        setNames(m)
      }
      const userIds = [...new Set(rows.map(r => r.submitted_by).filter(Boolean))] as string[]
      if (userIds.length) {
        const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
        const m: Record<string, string> = {}
        for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
          m[p.id] = p.full_name || p.email || p.id
        }
        setPeople(m)
      }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  async function decide(change: ListingChange, decision: 'approved' | 'rejected' | 'changes_requested') {
    setBusy(change.id)
    try {
      await reviewListingChange(change.id, decision, decision === 'approved' ? '' : note.trim())
      toast.success(
        decision === 'approved' ? 'Approved and published.'
        : decision === 'rejected' ? 'Change rejected.'
        : 'Sent back to the partner.')
      setNoteFor(null); setNote('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record the review')
    } finally { setBusy(null) }
  }

  const pending = useMemo(() => changes.filter(c => c.status === 'submitted').length, [changes])

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Approvals</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">
            Supplier edits awaiting review. Partners cannot publish these themselves.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-0 border border-gray-200 bg-white overflow-hidden w-fit mb-6">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 font-sans text-xs transition-colors border-r border-gray-100 last:border-0 ${
              filter === f.key ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
            {f.label}{f.key === 'submitted' && pending > 0 && filter === 'submitted' ? ` (${pending})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading…</p>
      ) : changes.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Check size={22} className="text-gray-300 mx-auto mb-3" />
          <p className="font-sans text-sm text-gray-500">Nothing here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {changes.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-gray-300 shrink-0" />
                    <p className="font-sans text-sm text-gray-800 truncate">
                      {names[c.establishment_id] ?? c.establishment_id}
                    </p>
                  </div>
                  <p className="font-sans text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                    <Clock size={11} />
                    {c.submitted_by ? (people[c.submitted_by] ?? c.submitted_by) : 'unknown'}
                    {' · '}{new Date(c.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{c.changed_fields.length} field{c.changed_fields.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className={`shrink-0 font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {c.status.replace(/_/g, ' ')}
                </span>
              </div>

              <Diff change={c} />

              {c.review_notes && (
                <p className="font-sans text-xs text-gray-500 mt-3 border-l-2 border-gray-200 pl-3">
                  {c.review_notes}
                </p>
              )}

              {c.status === 'submitted' && (
                <>
                  {noteFor === c.id && (
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                      placeholder="What should the partner change?"
                      className="mt-4 w-full border border-gray-200 px-3 py-2 font-sans text-xs resize-none focus:outline-none" />
                  )}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button onClick={() => decide(c, 'approved')} disabled={busy === c.id}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 font-sans text-xs transition-colors ${
                        busy === c.id ? 'bg-gray-100 text-gray-400' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
                      <Check size={13} /> Approve &amp; publish
                    </button>
                    <button
                      onClick={() => noteFor === c.id ? decide(c, 'changes_requested') : (setNoteFor(c.id), setNote(''))}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 border border-gray-200 px-4 py-2 font-sans text-xs text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]">
                      <MessageSquare size={13} /> {noteFor === c.id ? 'Send request' : 'Request changes'}
                    </button>
                    <button onClick={() => decide(c, 'rejected')} disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 border border-gray-200 px-4 py-2 font-sans text-xs text-red-400 hover:border-red-200">
                      <X size={13} /> Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
