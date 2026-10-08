'use client'

/**
 * /admin/grand-tour — full admin control of the Grand Tour Drakensberg page.
 *
 *   Page content        the hero, introduction, stages and highlights, and the
 *                       closing band (site_content, admin-only write)
 *   Day tours           create day tours for any approved operator and put
 *                       activities on the Grand Tour (the same tool VD
 *                       Operations uses, without the per-supplier assignment)
 *   Featured on stages  hand-pick activities, events and guided tours per stage
 *
 * Admins pass every database check these tools hit: site_content's admin write
 * policy, "Admins write all" on vd_entities, the Grand Tour listing guard and
 * the stage-feature curator check all admit is_admin().
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bus, ExternalLink, FileText, Sparkles } from 'lucide-react'
import { getActivities } from '@/lib/activities'
import { getAdminSuppliers } from '@/lib/admin-supabase'
import type { Operator } from '@/components/operations/NewDayTourForm'
import GrandTourContentEditor from '@/components/grand-tour-admin/GrandTourContentEditor'
import DayToursManager from '@/components/grand-tour-admin/DayToursManager'
import StageFeaturesManager from '@/components/operations/StageFeaturesManager'

type Tab = 'content' | 'tours' | 'features'

const TABS: [Tab, string, typeof Bus][] = [
  ['content', 'Page content', FileText],
  ['tours', 'Day tours', Bus],
  ['features', 'Featured on stages', Sparkles],
]

export default function AdminGrandTourPage() {
  const [tab, setTab] = useState<Tab>('content')
  const [operators, setOperators] = useState<Operator[] | null>(null)

  useEffect(() => {
    getAdminSuppliers()
      .then(list => setOperators(list.filter(s => s.is_verified).map(s => ({ id: s.id, name: s.business_name }))))
      .catch(() => setOperators([]))
  }, [])

  const loadActivities = useCallback(() => getActivities(), [])

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console · Website</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Grand Tour Drakensberg</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Everything visitors see on the Grand Tour page.</p>
        </div>
        <Link href="/grand-tour" target="_blank" className="font-sans text-sm text-[#2d6a4f] hover:underline flex items-center gap-1">
          View the page <ExternalLink size={13} />
        </Link>
      </div>

      <div role="tablist" className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 -mb-px border-b-2 font-sans text-sm flex items-center gap-2 whitespace-nowrap ${tab === key ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-500 hover:text-black'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'content' && <GrandTourContentEditor />}
      {tab === 'tours' && (
        operators === null
          ? <p className="font-sans text-sm text-gray-400">Loading operators…</p>
          : <DayToursManager
              operators={operators}
              loadActivities={loadActivities}
              emptyNotice={<p className="font-sans text-sm text-gray-500">There are no approved suppliers yet to run a day tour.</p>}
            />
      )}
      {tab === 'features' && <StageFeaturesManager />}
    </div>
  )
}
