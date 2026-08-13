'use client'

import { Users } from 'lucide-react'
import ConsolidatedLauncher from '@/components/operations/ConsolidatedLauncher'

export default function ConsolidatedCustomersPage() {
  return (
    <ConsolidatedLauncher
      title="Guest Messages"
      description="Guest conversations for every supplier you handle communications for."
      icon={Users}
      permission="view_customers"
      permissionLabel="View Customers"
      routes={['/supplier/messages', '/supplier/requests']}
    />
  )
}
