'use client'

/**
 * /operations/boarding — VD Operations boards Grand Tour guests.
 *
 * The day tours offered are the Grand Tour listings of every supplier where
 * the employee holds manage_bookings: the permission vd_redeem_ticket checks
 * before boarding a Grand Tour ticket (20261008_grand_tour_ops_only.sql).
 */

import { useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { getActivitiesBySupplier } from '@/lib/activities'
import BoardingConsole from '@/components/boarding/BoardingConsole'

export default function OperationsBoardingPage() {
  const { suppliers, loading } = useOperations()
  const boardable = suppliers.filter(s => s.permissions?.includes('manage_bookings'))
  const ids = boardable.map(s => s.supplier_id).join(',')

  const loadDayTours = useCallback(async () => {
    const lists = await Promise.all(ids.split(',').filter(Boolean).map(id => getActivitiesBySupplier(id).catch(() => [])))
    return lists.flat().filter(a => a.grandTour?.enabled)
  }, [ids])

  if (loading) return <div className="p-4 sm:p-6 lg:p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>

  if (boardable.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="font-sans text-sm text-amber-800">
            You need the Manage Bookings permission on a Grand Tour supplier to board its guests.
          </p>
        </div>
      </div>
    )
  }

  return (
    <BoardingConsole
      key={ids}
      title="Boarding & Check-in"
      intro="Choose the Grand Tour departure you are running, then scan each guest’s ticket as they board. The passenger list shows every seat by hotel pickup."
      loadDayTours={loadDayTours}
    />
  )
}
