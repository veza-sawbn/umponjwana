'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Star, Truck, Users } from 'lucide-react'
import {
  companyAvgResponseMinutes, companyRating, companyTransferPrice,
  SUPPLIER_CATEGORIES, vehicleAvailableOn, vehicleSeats, vehicleTransferPrice,
  type GeoPoint, type TransportCompany, type TransportVehicle,
} from '@/lib/transport'
import { rankSuppliers, type ScoredCandidate } from '@/lib/transport-dispatch'
import type { ShuttleSupplierChoice } from '@/lib/shuttle-service'
import { formatMoney } from '@/lib/allocation'

// The supplier step of the booking journey: once the route is known, the
// customer picks which registered transport company — and which of its
// available vehicles — will run the transfer. Each vehicle is quoted at the
// rate its operator set for it, so a 14-seater and a sedan from the same
// company carry different prices; the company row shows the cheapest of them.
// Suppliers are listed in suitability order (the dispatch engine's ranking).

export function TransportSupplierPicker({
  pickup,
  dropoff,
  date,
  passengers,
  distanceKm,
  selected,
  onSelect,
  onCandidates,
  onLowestPrice,
}: {
  pickup: GeoPoint
  dropoff: GeoPoint
  date: string
  passengers: number
  distanceKm: number
  selected: ShuttleSupplierChoice | null
  onSelect: (choice: ShuttleSupplierChoice | null) => void
  onCandidates?: (eligibleCount: number) => void
  /** The cheapest fare among this route's eligible, listed suppliers — lets
   *  a caller show a real market price (e.g. the "Live route estimate"
   *  above this list) instead of the generic distance-based formula, before
   *  the visitor has picked a specific company. Null once there are no
   *  eligible suppliers for the route. */
  onLowestPrice?: (price: number | null) => void
}) {
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<ScoredCandidate[]>([])
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)

  const inputKey = useMemo(
    () => [pickup.lat, pickup.lng, pickup.address, dropoff.lat, dropoff.lng, dropoff.address, date, passengers, distanceKm].join('|'),
    [pickup, dropoff, date, passengers, distanceKm],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    rankSuppliers({ pickup, dropoff, date, passengers, distanceKm, quotedPrice: 0 })
      .then(({ candidates: ranked }) => {
        if (cancelled) return
        const eligible = ranked.filter(c => c.eligible)
        setCandidates(eligible)
        onCandidates?.(eligible.length)
        onLowestPrice?.(eligible.length
          ? Math.min(...eligible.map(c => fromPrice(c, date, passengers, distanceKm)))
          : null)
        // A previous selection that no longer applies is cleared.
        if (selected && !eligible.some(c => c.company.id === selected.companyId)) onSelect(null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey])

  function pickVehicle(candidate: ScoredCandidate, vehicle: TransportVehicle) {
    onSelect({
      supplierId: candidate.company.supplierId,
      companyId: candidate.company.id,
      companyName: candidate.company.companyName,
      vehicleId: vehicle.id,
      vehicleName: vehicleLabel(vehicle),
      price: vehicleTransferPrice(candidate.company, vehicle, distanceKm, passengers),
    })
  }

  if (loading) return <p className="p-5 font-sans text-sm text-gray-400">Finding available transport partners…</p>

  if (candidates.length === 0) {
    return (
      <p className="p-5 font-sans text-sm text-gray-400">
        No registered transport partner covers this trip yet. You can still book — our team will place the transfer
        with the best available operator after checkout.
      </p>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {candidates.map((candidate, index) => {
        const company = candidate.company
        const isSelectedCompany = selected?.companyId === company.id
        const expanded = expandedCompanyId === company.id || isSelectedCompany
        const rating = companyRating(company)
        const response = companyAvgResponseMinutes(company)
        const vehicles = getUsableVehicles(candidate, date, passengers)
        // The headline is the cheapest vehicle this company can put on the
        // route — the exact fare only settles once a vehicle is chosen.
        const price = fromPrice(candidate, date, passengers, distanceKm)
        return (
          <div key={company.id} className={isSelectedCompany ? 'bg-forest/[0.04]' : ''}>
            <button
              type="button"
              onClick={() => setExpandedCompanyId(expanded && !isSelectedCompany ? null : company.id)}
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-mist transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg text-forest flex items-center gap-2">
                  {isSelectedCompany && <Check size={16} className="text-emerald-600 shrink-0" />}
                  {company.companyName}
                  {index === 0 && <span className="font-sans text-[10px] tracking-wide uppercase bg-gold/15 text-gold px-2 py-0.5">Best match</span>}
                </p>
                <p className="font-sans text-xs text-forest/40 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{SUPPLIER_CATEGORIES[company.category].label}</span>
                  <span className="flex items-center gap-1"><Star size={11} className="text-gold" /> {rating}/5</span>
                  <span>{company.stats?.completedTrips ?? 0} trips</span>
                  {response !== null && <span className="flex items-center gap-1"><Clock size={11} /> responds in ~{response} min</span>}
                  <span>{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} available</span>
                </p>
              </div>
              <p className="font-display text-xl text-forest shrink-0 text-right">
                {vehicles.length > 1 && <span className="font-sans text-[10px] uppercase tracking-wide text-forest/40 block">From</span>}
                {formatMoney(price)}
              </p>
            </button>

            {expanded && (
              <div className="px-5 pb-5 space-y-2">
                <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-forest/30">Choose your vehicle</p>
                {vehicles.map(vehicle => {
                  const isSelectedVehicle = isSelectedCompany && selected?.vehicleId === vehicle.id
                  const vehiclePrice = vehicleTransferPrice(company, vehicle, distanceKm, passengers)
                  return (
                    <button
                      type="button"
                      key={vehicle.id}
                      onClick={() => pickVehicle(candidate, vehicle)}
                      className={`w-full flex flex-wrap items-center gap-x-3 gap-y-1 border px-4 py-3 text-left transition-colors ${
                        isSelectedVehicle ? 'border-forest bg-forest text-white' : 'border-gray-200 bg-white hover:border-forest/50'
                      }`}
                    >
                      <Truck size={16} className={isSelectedVehicle ? 'text-gold' : 'text-forest/50'} />
                      <span className="flex-1 min-w-0 font-sans text-sm">{vehicleLabel(vehicle)}</span>
                      <span className={`font-sans text-xs flex items-center gap-1 ${isSelectedVehicle ? 'text-white/70' : 'text-forest/40'}`}>
                        <Users size={11} /> {vehicleSeats(vehicle)} seats · {vehicle.type ?? 'Shuttle'}
                      </span>
                      <span className={`font-display text-base ${isSelectedVehicle ? 'text-gold' : 'text-forest'}`}>
                        {formatMoney(vehiclePrice)}
                      </span>
                      {isSelectedVehicle && <Check size={14} className="text-gold" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getUsableVehicles(candidate: ScoredCandidate, date: string, passengers: number): TransportVehicle[] {
  return candidate.vehicles
    .filter(v => vehicleAvailableOn(v, date) && vehicleSeats(v) >= passengers)
    .sort((a, b) => vehicleSeats(a) - vehicleSeats(b))
}

export function vehicleLabel(vehicle: TransportVehicle): string {
  return vehicle.name ?? ([vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.type || 'Vehicle')
}

/** The cheapest fare this company can actually put on the route. Falls back
 *  to the company rate card when it has no vehicle free for the date. */
function fromPrice(candidate: ScoredCandidate, date: string, passengers: number, distanceKm: number): number {
  const company: TransportCompany = candidate.company
  const vehicles = getUsableVehicles(candidate, date, passengers)
  if (!vehicles.length) return companyTransferPrice(company, distanceKm, passengers)
  return Math.min(...vehicles.map(v => vehicleTransferPrice(company, v, distanceKm, passengers)))
}
