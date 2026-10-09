'use client'

/**
 * The Grand Tour "Day tours" tool, shared by VD Operations
 * (/operations/grand-tour, operators = suppliers they hold Manage Inventory
 * on) and admins (/admin/grand-tour, operators = every approved supplier).
 *
 * Lists the operators' activities, creates new day tours, puts activities on
 * the Grand Tour (highlights, departs from, hotel pickups) and publishes
 * them. The database decides who may actually write: staff, or an ops
 * employee with Manage Inventory on that supplier
 * (supabase/migrations/20261008_grand_tour_ops_only.sql).
 */

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, ExternalLink, Search, Bus, CalendarDays, Check, Plus } from 'lucide-react'
import { updateActivity, type Activity } from '@/lib/activities'
import { dayTourHref, stagesForActivity, upcomingDepartures } from '@/lib/grand-tour'
import { useGrandTourStages } from '@/lib/use-grand-tour-stages'
import { GrandTourEditor, emptyGrandTour, cleanGrandTour } from '@/components/activities/GrandTourEditor'
import type { GrandTourListing } from '@/lib/grand-tour'
import NewDayTourForm, { type Operator } from '@/components/operations/NewDayTourForm'

type Row = Activity & { supplierLabel: string }
type Filter = 'listed' | 'all'

/** Why a listed tour is not yet bookable on /grand-tour, if it isn't. */
function blockers(a: Activity): string[] {
  const out: string[] = []
  if (a.status !== 'active') out.push('Not published')
  if (!(a.timeslots?.length)) out.push('No departure times: the supplier adds timeslots on the activity')
  if (!(a.grandTour?.highlightIds?.length)) out.push('No highlights chosen, so it shows in the tour grid only')
  return out
}

export default function DayToursManager({
  operators, loadActivities, emptyNotice,
}: {
  operators: Operator[]
  /** Every activity these operators own. Kept stable (useCallback) by the caller. */
  loadActivities: () => Promise<Activity[]>
  /** Shown instead of the tool when there are no operators to work for. */
  emptyNotice: ReactNode
}) {
  const allStages = useGrandTourStages()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<GrandTourListing>(emptyGrandTour())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadActivities()
      .then(list => {
        if (cancelled) return
        const all = list
          .map(a => ({ ...a, supplierLabel: operators.find(o => o.id === a.supplierId)?.name ?? a.supplierName ?? 'Supplier' }))
          .sort((a, b) => Number(!!b.grandTour?.enabled) - Number(!!a.grandTour?.enabled) || a.name.localeCompare(b.name))
        setRows(all)
        if (all.some(a => a.grandTour?.enabled)) setFilter('listed')
      })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [loadActivities, operators])

  const visible = rows.filter(a =>
    (filter === 'all' || a.grandTour?.enabled)
    && (!query.trim() || `${a.name} ${a.supplierLabel} ${a.region}`.toLowerCase().includes(query.trim().toLowerCase())))

  function startEdit(a: Row) {
    setEditing(a.id)
    setError('')
    setDraft(a.grandTour ? { ...emptyGrandTour(), ...a.grandTour } : { ...emptyGrandTour(), enabled: true })
  }

  async function save(a: Row, patch: Partial<Activity>) {
    setSaving(true)
    setError('')
    try {
      await updateActivity(a.id, patch)
      setRows(rs => rs.map(r => (r.id === a.id ? { ...r, ...patch } : r)))
      setSavedId(a.id)
      setTimeout(() => setSavedId(id => (id === a.id ? null : id)), 2500)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Check you hold Manage Inventory for this supplier.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveListing(a: Row) {
    if (await save(a, { grandTour: cleanGrandTour(draft) ?? emptyGrandTour() })) setEditing(null)
  }

  if (operators.length === 0) return <>{emptyNotice}</>

  if (creating) {
    return (
      <NewDayTourForm
        operators={operators}
        onCancel={() => setCreating(false)}
        onCreated={a => {
          setRows(rs => [{ ...a, supplierLabel: operators.find(o => o.id === a.supplierId)?.name ?? a.supplierName }, ...rs])
          setFilter('listed')
          setCreating(false)
          setSavedId(a.id)
        }}
      />
    )
  }

  return (
    <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-white border border-gray-200 p-4">
            <div>
              <p className="font-sans text-sm font-medium text-gray-900">Add a day tour</p>
              <p className="font-sans text-xs text-gray-500">Create a new one for an operator, or put one of their existing activities on the Grand Tour from the list below.</p>
            </div>
            <button onClick={() => setCreating(true)} className="bg-[#2d6a4f] text-white font-sans text-sm px-4 py-2.5 hover:bg-[#235a3f] flex items-center gap-1.5 shrink-0">
              <Plus size={14} /> New day tour
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
            <div className="inline-flex border border-gray-200 bg-white">
              {(['listed', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 font-sans text-sm ${filter === f ? 'bg-[#2d6a4f] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  {f === 'listed' ? `On the Grand Tour (${rows.filter(r => r.grandTour?.enabled).length})` : `All activities (${rows.length})`}
                </button>
              ))}
            </div>
            <label className="relative sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search activities" aria-label="Search activities" className="w-full border border-gray-200 bg-white pl-9 pr-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
            </label>
          </div>

          {loading ? (
            <p className="font-sans text-sm text-gray-400">Loading activities…</p>
          ) : visible.length === 0 ? (
            <div className="bg-white border border-gray-200 p-8 text-center">
              <p className="font-sans text-sm text-gray-500">
                {filter === 'listed' ? 'Nothing is on the Grand Tour yet. Switch to “All activities” to add one.' : 'No activities match.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map(a => {
                const listed = !!a.grandTour?.enabled
                const stages = stagesForActivity(a, allStages)
                const next = upcomingDepartures(a, { limit: 1 })[0]
                const issues = listed ? blockers(a) : []
                const open = editing === a.id
                return (
                  <li key={a.id} className="bg-white border border-gray-200">
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display italic text-xl text-gray-900">{a.name}</p>
                          {listed && <span className="font-sans text-[10px] tracking-wider uppercase bg-[#2d6a4f] text-white px-2 py-0.5">Grand Tour</span>}
                          <span className={`font-sans text-[10px] tracking-wider uppercase px-2 py-0.5 ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {a.status === 'active' ? 'Published' : 'Draft'}
                          </span>
                          {savedId === a.id && <span className="font-sans text-xs text-emerald-700 flex items-center gap-1"><Check size={12} /> Saved</span>}
                        </div>
                        <p className="font-sans text-xs text-gray-500 mt-1">
                          {a.supplierLabel}{a.region ? ` · ${a.region}` : ''}
                          {listed && a.grandTour?.departsFrom ? ` · departs ${a.grandTour.departsFrom}` : ''}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 font-sans text-xs text-gray-500">
                          <span className="flex items-center gap-1"><CalendarDays size={12} />
                            {next ? `Next ${new Date(`${next.date}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} ${next.time}` : `${a.timeslots?.length ?? 0} departure time${a.timeslots?.length === 1 ? '' : 's'}`}
                          </span>
                          {listed && <span className="flex items-center gap-1"><Bus size={12} />{a.grandTour?.pickupPoints.length ?? 0} pickup{a.grandTour?.pickupPoints.length === 1 ? '' : 's'}</span>}
                          {listed && stages.length > 0 && <span>Stages: {stages.map(s => s.name).join(', ')}</span>}
                        </div>
                        {issues.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {issues.map(i => <li key={i} className="font-sans text-xs text-amber-700 flex items-start gap-1.5"><AlertCircle size={12} className="mt-0.5 shrink-0" />{i}</li>)}
                          </ul>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          onClick={() => (open ? setEditing(null) : startEdit(a))}
                          className="font-sans text-xs border border-[#2d6a4f] text-[#2d6a4f] px-3 py-2 hover:bg-[#2d6a4f] hover:text-white"
                        >
                          {open ? 'Close' : listed ? 'Edit listing' : 'Add to Grand Tour'}
                        </button>
                        <button
                          onClick={() => save(a, { status: a.status === 'active' ? 'draft' : 'active' })}
                          disabled={saving}
                          className="font-sans text-xs border border-gray-300 text-gray-700 px-3 py-2 hover:border-gray-600 disabled:opacity-40"
                        >
                          {a.status === 'active' ? 'Unpublish' : 'Publish'}
                        </button>
                        {listed && (
                          <Link href={dayTourHref(a)} target="_blank" className="font-sans text-xs text-gray-500 hover:text-black px-2 py-2 flex items-center gap-1">
                            View page <ExternalLink size={11} />
                          </Link>
                        )}
                      </div>
                    </div>

                    {open && (
                      <div className="border-t border-gray-100 p-4 sm:p-5 bg-[#F7F5F2]/60">
                        <GrandTourEditor value={draft} onChange={setDraft} hasTimeslots={(a.timeslots?.length ?? 0) > 0} />
                        {error && <p className="font-sans text-xs text-red-600 mt-3">{error}</p>}
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => saveListing(a)} disabled={saving} className="bg-[#2d6a4f] text-white font-sans text-sm px-5 py-2 hover:bg-[#235a3f] disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save listing'}
                          </button>
                          <button onClick={() => setEditing(null)} className="font-sans text-sm text-gray-500 px-3 py-2 hover:text-black">Cancel</button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {error && !editing && <p className="font-sans text-xs text-red-600 mt-3">{error}</p>}
    </>
  )
}
