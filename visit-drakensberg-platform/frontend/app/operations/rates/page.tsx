'use client'

import { Tag } from 'lucide-react'
import ConsolidatedLauncher from '@/components/operations/ConsolidatedLauncher'

export default function ConsolidatedRatesPage() {
  return (
    <ConsolidatedLauncher
      title="Rates & Discounts"
      description="Pricing and discount tools for each supplier in your portfolio."
      icon={Tag}
      permission="view_rates"
      permissionLabel="View Rates"
      routes={['/supplier/discounts', '/supplier/estimator']}
    />
  )
}
