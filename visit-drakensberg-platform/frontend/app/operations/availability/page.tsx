'use client'

import { Clock } from 'lucide-react'
import ConsolidatedLauncher from '@/components/operations/ConsolidatedLauncher'

export default function ConsolidatedAvailabilityPage() {
  return (
    <ConsolidatedLauncher
      title="Availability"
      description="Open the availability calendar for any supplier you manage."
      icon={Clock}
      permission="view_availability"
      permissionLabel="View Availability"
      routes={['/supplier/availability', '/supplier/departures']}
    />
  )
}
