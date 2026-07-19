'use client'

import { useEffect, useState } from 'react'
import { Bus, Check, ChevronDown, ChevronUp, Trash2, Truck } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import type { MeetAndGreetDetails } from '@/lib/transport'
import type { ShuttleSupplierChoice } from '@/lib/shuttle-service'
import { TransportSupplierPicker } from './TransportSupplierPicker'
import { MeetAndGreetForm } from './MeetAndGreetForm'

// The shuttle line in the trip cart, expanded into its configuration hub:
// choose (or change) the transport partner + vehicle, and capture the
// arrival details the partner needs for passenger tracking and meet & greet.

export function ShuttleTripCard() {
  const booking = useBooking()
  const shuttle = booking.shuttle
  const [changingPartner, setChangingPartner] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [draft, setDraft] = useState<MeetAndGreetDetails>({})
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setDraft(shuttle?.meetAndGreet ?? {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuttle?.id])

  if (!shuttle) return null

  const hasPartner = Boolean(shuttle.supplierId && shuttle.vehicleId)
  const hasCoords = Boolean(shuttle.pickupLat && shuttle.pickupLng && shuttle.destinationLat && shuttle.destinationLng)
  const canPickPartner = hasCoords && shuttle.date && shuttle.distanceKm != null
  const isAirportPickup = /airport/i.test(shuttle.pickup ?? '')
  const detailsMissing = !shuttle.meetAndGreet?.contactPhone && !shuttle.meetAndGreet?.flightNumber

  function applyPartner(choice: ShuttleSupplierChoice | null) {
    if (!choice || !shuttle) return
    booking.setShuttle({
      ...shuttle,
      supplierId: choice.supplierId,
      companyId: choice.companyId,
      companyName: choice.companyName,
      vehicleId: choice.vehicleId,
      vehicleName: choice.vehicleName,
      vehicleType: choice.vehicleName,
      price: choice.price,
      description: shuttle.description.replace(/Operated by .*$/, `Operated by ${choice.companyName} (${choice.vehicleName}).`),
    })
    setChangingPartner(false)
  }

  function saveDetails() {
    if (!shuttle) return
    booking.setShuttle({ ...shuttle, meetAndGreet: draft })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
  }

  return (
    <div className="bg-white border border-black/8 rounded-xl p-5 space-y-4">
      {/* Summary row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[#2d6a4f]/10 flex items-center justify-center shrink-0">
            <Bus size={16} className="text-[#2d6a4f]" />
          </div>
          <div className="min-w-0">
            <p className="font-sans font-medium text-sm text-black/80 truncate">{shuttle.label}</p>
            <p className="font-sans text-xs text-black/40 mt-0.5">
              {shuttle.date}{shuttle.passengers ? ` · ${shuttle.passengers} passenger${shuttle.passengers !== 1 ? 's' : ''}` : ''}
              {shuttle.distanceKm != null ? ` · ${shuttle.distanceKm} km` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <p className="font-sans text-sm font-semibold text-black/80">R {shuttle.price.toLocaleString()}</p>
          <button onClick={() => booking.setShuttle(null)} className="text-red-400 hover:text-red-600 transition-colors" title="Remove">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Transport partner */}
      <div className="border-t border-black/5 pt-4">
        {hasPartner && !changingPartner ? (
          <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-xs text-black/60 flex items-center gap-1.5">
              <Truck size={13} className="text-[#2d6a4f]" />
              <span className="font-medium">{shuttle.companyName}</span> · {shuttle.vehicleName}
              <Check size={12} className="text-emerald-600" />
            </p>
            {canPickPartner && (
              <button onClick={() => setChangingPartner(true)} className="font-sans text-xs text-[#C9A96E] hover:underline shrink-0">
                Change partner
              </button>
            )}
          </div>
        ) : canPickPartner ? (
          <div>
            <p className="font-sans text-xs font-medium text-black/60 mb-2">
              {hasPartner ? 'Change transport partner' : 'Choose who drives you'}
            </p>
            <div className="border border-black/8 rounded-lg overflow-hidden">
              <TransportSupplierPicker
                pickup={{ address: shuttle.pickup ?? '', lat: shuttle.pickupLat, lng: shuttle.pickupLng }}
                dropoff={{ address: shuttle.destination ?? '', lat: shuttle.destinationLat, lng: shuttle.destinationLng }}
                date={shuttle.date ?? ''}
                passengers={shuttle.passengers ?? booking.guests}
                shuttleType={shuttle.shuttleType ?? 'Private Shuttle'}
                distanceKm={shuttle.distanceKm ?? 0}
                selected={hasPartner ? {
                  supplierId: shuttle.supplierId!,
                  companyId: shuttle.companyId!,
                  companyName: shuttle.companyName!,
                  vehicleId: shuttle.vehicleId!,
                  vehicleName: shuttle.vehicleName!,
                  price: shuttle.price,
                } : null}
                onSelect={applyPartner}
              />
            </div>
            {changingPartner && (
              <button onClick={() => setChangingPartner(false)} className="mt-2 font-sans text-xs text-black/40 hover:text-black/70">
                Keep {shuttle.companyName}
              </button>
            )}
          </div>
        ) : (
          <p className="font-sans text-xs text-black/40">
            A transport partner will be matched to this transfer at checkout.
          </p>
        )}
      </div>

      {/* Meet & greet details */}
      <div className="border-t border-black/5 pt-4">
        <button
          onClick={() => setDetailsOpen(v => !v)}
          className="w-full flex items-center justify-between font-sans text-xs font-medium text-black/60"
        >
          <span>
            Arrival & meet-and-greet details
            {detailsMissing && <span className="ml-2 font-normal text-[#C9A96E]">Recommended — helps your driver find you</span>}
            {!detailsMissing && <Check size={12} className="inline ml-2 text-emerald-600" />}
          </span>
          {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {detailsOpen && (
          <div className="mt-4 space-y-4">
            <MeetAndGreetForm value={draft} onChange={setDraft} showAirportFields={isAirportPickup} />
            <div className="flex items-center gap-3">
              <button onClick={saveDetails} className="rounded-lg bg-[#2d6a4f] px-4 py-2 font-sans text-xs text-white hover:bg-[#235a3f] transition-colors">
                Save details
              </button>
              {savedFlash && <p className="font-sans text-xs text-emerald-600 flex items-center gap-1"><Check size={12} /> Saved — shared with your transport partner at checkout.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
