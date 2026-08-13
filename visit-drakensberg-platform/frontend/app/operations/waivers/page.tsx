'use client'

import { FileSignature } from 'lucide-react'
import ConsolidatedLauncher from '@/components/operations/ConsolidatedLauncher'

export default function ConsolidatedWaiversPage() {
  return (
    <ConsolidatedLauncher
      title="Waivers"
      description="Open the waiver register for any supplier whose participants you handle."
      icon={FileSignature}
      permission="view_customers"
      permissionLabel="View Customers"
      routes={['/supplier/waivers']}
    />
  )
}
