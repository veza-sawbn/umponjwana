'use client'

import { Tag } from 'lucide-react'
import ConsolidatedLauncher from '@/components/operations/ConsolidatedLauncher'

export default function ConsolidatedRatesPage() {
  return (
    <ConsolidatedLauncher
      title="Rates, Offers & Discounts"
      description="Pricing, scheduled offer and discount tools for each supplier in your portfolio."
      icon={Tag}
      permission="view_rates"
      permissionLabel="View Rates"
      routes={['/supplier/offers', '/supplier/discounts', '/supplier/estimator']}
    />
  )
}
