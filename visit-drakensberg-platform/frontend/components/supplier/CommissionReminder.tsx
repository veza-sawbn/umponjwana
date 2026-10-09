import { Info } from 'lucide-react'
import { commissionReminder } from '@/lib/offers'

/** The "commission still applies" notice shown wherever offers are created or listed. */
export default function CommissionReminder({ rateLabel, className = '' }: { rateLabel: string; className?: string }) {
  return (
    <div role="note" className={`bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 ${className}`}>
      <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-sans text-sm font-semibold text-amber-900">Offers don&apos;t waive commission</p>
        <p className="font-sans text-sm text-amber-800 mt-0.5">{commissionReminder(rateLabel)}</p>
      </div>
    </div>
  )
}
