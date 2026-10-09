'use client'

/**
 * /operations/grand-tour — VD Operations decides what is on the Grand Tour.
 *
 * Lists the activities of every supplier where the employee holds
 * manage_inventory and lets them put an activity on the Grand Tour: which
 * highlights it visits, where it departs from, which hotels it collects
 * from, and whether it is published. Suppliers no longer see these controls;
 * the database refuses a Grand Tour listing from anyone but staff or an ops
 * employee with manage_inventory on that supplier
 * (supabase/migrations/20261008_grand_tour_ops_only.sql).
 */

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Mountain, AlertCircle, Bus, Sparkles } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { getActivitiesBySupplier } from '@/lib/activities'
import StageFeaturesManager from '@/components/operations/StageFeaturesManager'
import DayToursManager from '@/components/grand-tour-admin/DayToursManager'

type Tab = 'tours' | 'features'

export default function OperationsGrandTourPage() {
  const { suppliers, loading: ctxLoading } = useOperations()
  const [tab, setTab] = useState<Tab>('tours')
  const operators = useMemo(
    () => suppliers
      .filter(s => s.permissions?.includes('manage_inventory'))
      .map(s => ({ id: s.supplier_id, name: s.supplier_name ?? 'Supplier' })),
    [suppliers],
  )
  const ids = operators.map(o => o.id).join(',')
  const loadActivities = useCallback(
    async () => (await Promise.all(ids.split(',').filter(Boolean).map(id => getActivitiesBySupplier(id).catch(() => [])))).flat(),
    [ids],
  )

  if (ctxLoading) return <div className="p-4 sm:p-6 lg:p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Across All Suppliers</p>
        <h1 className="font-display italic text-3xl text-black flex items-center gap-2">
          <Mountain size={22} className="text-[#C9A96E]" /> Grand Tour
        </h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          Build what visitors see on <Link href="/grand-tour" className="text-[#2d6a4f] underline underline-offset-2">/grand-tour</Link>:
          day tours guests book seats on, and the activities, events and guided tours featured at each stage. You board
          day-tour guests from <Link href="/operations/boarding" className="text-[#2d6a4f] underline underline-offset-2">Boarding &amp; Check-in</Link>.
        </p>
      </div>

      <div role="tablist" className="flex border-b border-gray-200 mb-6">
        {([['tours', 'Day tours', Bus], ['features', 'Featured on stages', Sparkles]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 -mb-px border-b-2 font-sans text-sm flex items-center gap-2 ${tab === key ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-500 hover:text-black'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'features' ? (
        <StageFeaturesManager />
      ) : (
        <DayToursManager
          key={ids}
          operators={operators}
          loadActivities={loadActivities}
          emptyNotice={
            <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="font-sans text-sm text-amber-800">
                Day tours belong to an operator, so creating or editing one needs the Manage Inventory permission on that
                supplier. Ask an administrator to assign you, or use “Featured on stages”, which needs no assignment.
              </p>
            </div>
          }
        />
      )}
    </div>
  )
}
