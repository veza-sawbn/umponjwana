'use client'
import { Truck } from 'lucide-react'

/**
 * "This activity uses your own vehicles" — shared by the supplier activity
 * create and edit forms (the same way TimeslotEditor is).
 *
 * Ticking it stores Activity.usesOwnVehicles and, on save, adds the 'Shuttle'
 * supplier type, which is what reveals the fleet tools in the portal nav.
 * The copy says so plainly: the supplier should know what saving will change
 * about their dashboard before it changes.
 */
export function VehicleToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-lg border border-black/8 bg-black/[0.02] p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="usesOwnVehicles"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="mt-0.5 rounded"
        />
        <label htmlFor="usesOwnVehicles" className="cursor-pointer">
          <span className="font-sans text-sm font-medium text-black/70">This activity uses your own vehicles</span>
          <span className="block font-sans text-[11px] text-black/40 mt-0.5">
            Sani Pass 4×4 runs, game drives, guided tours by minibus: anything where you drive guests yourself.
          </span>
        </label>
      </div>
      {checked && (
        <p className="mt-3 pl-7 font-sans text-[11px] text-black/50 flex items-start gap-1.5">
          <Truck size={13} className="mt-px shrink-0 text-[#C9A96E]" />
          <span>
            Saving adds the transport tools to your dashboard (Transport Company, Vehicles, Drivers and
            Transport Jobs) so you can list the fleet and drivers that run it.
          </span>
        </p>
      )}
    </div>
  )
}
