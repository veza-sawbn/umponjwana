'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, Mail, RefreshCw, ShieldCheck, UserX } from 'lucide-react'
import {
  getConcerns, setConcernStatus, CONCERN_CATEGORY_LABEL, CONCERN_STATUS_LABEL,
  type Concern, type ConcernStatus,
} from '@/lib/concerns'

// Reports lodged at /report-a-concern. Nobody but the verification office can
// read this table at all — RLS returns an empty list to everyone else, so an
// empty page here means either no reports or the wrong role, never a leak.

const STATUS_STYLE: Record<ConcernStatus, string> = {
  new: 'bg-[#C9A96E]/15 text-[#8B6914]',
  reviewing: 'bg-blue-50 text-blue-600',
  resolved: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  dismissed: 'bg-gray-100 text-gray-500',
}

const FILTERS: ('all' | ConcernStatus)[] = ['all', 'new', 'reviewing', 'resolved', 'dismissed']

export default function AdminConcernsPage() {
  const [concerns, setConcerns] = useState<Concern[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | ConcernStatus>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getConcerns()
      setConcerns(rows)
      setNotes(Object.fromEntries(rows.map(c => [c.id, c.adminNote])))
    } catch {
      toast.error('Could not load reports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visible = useMemo(
    () => (filter === 'all' ? concerns : concerns.filter(c => c.status === filter)),
    [concerns, filter],
  )

  const countFor = (f: 'all' | ConcernStatus) =>
    f === 'all' ? concerns.length : concerns.filter(c => c.status === f).length

  async function decide(concern: Concern, status: ConcernStatus) {
    setBusyId(concern.id)
    try {
      await setConcernStatus(concern.id, status, notes[concern.id] ?? '')
      setConcerns(list => list.map(c => (c.id === concern.id ? { ...c, status, adminNote: notes[c.id] ?? '' } : c)))
      toast.success(`Marked ${CONCERN_STATUS_LABEL[status].toLowerCase()}.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update that report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Concerns</h1>
          <p className="font-sans text-sm text-gray-500 mt-1 max-w-2xl">
            Reports from /report-a-concern — the channel the Supplier Code of Conduct points suppliers, their workers
            and guests at. Anonymous reports carry no contact details by design.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 font-sans text-xs transition-colors capitalize ${
              filter === f ? 'bg-[#000000] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            }`}>
            {f === 'all' ? 'All' : CONCERN_STATUS_LABEL[f]} <span className="text-gray-400 ml-1">{countFor(f)}</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200">
        {loading && <div className="px-6 py-16 text-center font-sans text-sm text-gray-400">Loading…</div>}

        {!loading && visible.length === 0 && (
          <div className="px-6 py-16 text-center">
            <ShieldCheck size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="font-sans text-sm text-gray-400">
              {concerns.length === 0 ? 'No reports.' : 'No reports match this filter.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {visible.map(concern => {
            const isOpen = expanded === concern.id
            const busy = busyId === concern.id
            return (
              <div key={concern.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : concern.id)}
                  className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-[#F7F5F2]/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-sans text-sm font-medium truncate">
                        {CONCERN_CATEGORY_LABEL[concern.category]}
                      </p>
                      <span className={`inline-flex px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${STATUS_STYLE[concern.status]}`}>
                        {CONCERN_STATUS_LABEL[concern.status]}
                      </span>
                      {concern.isAnonymous && (
                        <span className="inline-flex items-center gap-1 font-sans text-[10px] uppercase tracking-wide text-gray-400">
                          <UserX size={10} /> Anonymous
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-xs text-gray-400 truncate">
                      {concern.reference} · {concern.aboutBusiness || 'No business named'}
                    </p>
                  </div>
                  <span className="font-sans text-xs text-gray-400 shrink-0 hidden sm:block">
                    {concern.createdAt ? new Date(concern.createdAt).toLocaleDateString('en-ZA') : ''}
                  </span>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 space-y-4 bg-[#F7F5F2]/40">
                    <p className="font-sans text-sm text-gray-700 leading-relaxed whitespace-pre-line border-l-2 border-gray-200 pl-4">
                      {concern.body}
                    </p>

                    {concern.isAnonymous ? (
                      <p className="font-sans text-xs text-gray-400">
                        Reported anonymously — no contact details were collected, so there is no way to ask follow-up
                        questions.
                      </p>
                    ) : (
                      <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                        {concern.reporterName || 'Name not given'}
                        {concern.reporterEmail && (
                          <a href={`mailto:${concern.reporterEmail}`} className="text-[#2d6a4f] hover:underline flex items-center gap-1">
                            <Mail size={11} /> {concern.reporterEmail}
                          </a>
                        )}
                      </p>
                    )}

                    <input
                      value={notes[concern.id] ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [concern.id]: e.target.value }))}
                      placeholder="What was done about it"
                      className="w-full border border-gray-200 px-3 py-2 font-sans text-xs text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] bg-white"
                    />

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['reviewing', 'resolved', 'dismissed'] as ConcernStatus[])
                        .filter(s => s !== concern.status)
                        .map(s => (
                          <button key={s} disabled={busy} onClick={() => decide(concern, s)}
                            className="px-2.5 py-1 border border-gray-300 text-gray-600 font-sans text-xs hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50">
                            Mark {CONCERN_STATUS_LABEL[s].toLowerCase()}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
