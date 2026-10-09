'use client'

import BoardingConsole from '@/components/boarding/BoardingConsole'

// Suppliers check in their own event tickets here. Grand Tour day tours are
// boarded by VD Operations from /operations/boarding.
export default function SupplierCheckInPage() {
  return (
    <BoardingConsole
      title="Check-in Scanner"
      intro="Scan a guest’s ticket QR code, or type its code, to check them in to your event."
    />
  )
}
