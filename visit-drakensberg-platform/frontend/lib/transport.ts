import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './auth'
import { listEntities, getEntity, insertEntity, updateEntity, newEntityId, listEntitiesByOwner } from './entities'
import { getSupplierEntities, updateSupplierEntity, type SupplierEntity } from './supplier-entities'
import { notify } from './notifications'
import { formatMoney } from './allocation'

// ============================================================================
// Transport Supplier Marketplace — core domain.
//
// Approved transport companies register a company profile (category, home
// base, service regions), manage their fleet, and receive booking
// opportunities ranked by a suitability score (lib/transport-dispatch.ts).
// Vehicle availability is a lifecycle, not a calendar:
//   accepted → vehicle reserved → driver assigned → trip in progress
//   → trip completed → vehicle available again (now located at the drop-off).
// Maintenance and manual blocks are still supported on top of the lifecycle.
//
// Companies, vehicles and drivers are vd_entities rows (public-read/owner-
// write); requests live in vd_transport_requests (see the 20260718 transport
// migration for the RLS that lets offered suppliers read and respond).
// ============================================================================

export type SupplierCategory = 'gateway' | 'regional' | 'local'
export type TripClass = 'gateway' | 'regional' | 'local'

export type GeoPoint = { address: string; lat?: string; lng?: string }

/** Arrival details the guest provides so the transport partner can track the
 *  flight and meet the passengers at the pickup point. */
export type MeetAndGreetDetails = {
  flightNumber?: string
  airline?: string
  arrivalTime?: string
  nameBoard?: string
  contactPhone?: string
  luggage?: string
  childSeats?: string
  notes?: string
}

export const SUPPLIER_CATEGORIES: Record<SupplierCategory, {
  label: string
  description: string
  exampleBases: string[]
  typicalWork: string[]
}> = {
  gateway: {
    label: 'Gateway Operator',
    description: 'Based in a major city, connecting airports and cities to the mountains.',
    exampleBases: ['Johannesburg', 'Durban', 'Bloemfontein', 'Nelspruit'],
    typicalWork: ['Airport transfers', 'City to Drakensberg', 'Long-distance transfers'],
  },
  regional: {
    label: 'Regional Operator',
    description: 'Based inside a tourism region, moving guests around the greater area.',
    exampleBases: ['Winterton', 'Bergville', 'Underberg', 'Clarens'],
    typicalWork: ['Accommodation transfers', 'Trailhead transfers', 'Transfers between attractions', 'Day tours'],
  },
  local: {
    label: 'Local Operator',
    description: 'Operates inside one valley or local destination — short-distance transport and local mobility.',
    exampleBases: ['Royal Natal', 'Cathedral Peak', "Monk's Cowl", 'Giants Castle', 'Injisuthi'],
    typicalWork: ['Trailhead drops', 'Lodge shuttles', 'Local mobility'],
  },
}

// Geographic reference areas the marketplace reasons about. A point belongs
// to the nearest area whose radius contains it; coverage and trip
// classification are otherwise computed from live coordinates, never from a
// fixed route table.
export type TransportArea = {
  id: string
  name: string
  kind: 'city' | 'region' | 'valley'
  lat: number
  lng: number
  radiusKm: number
}

export const TRANSPORT_AREAS: TransportArea[] = [
  { id: 'johannesburg', name: 'Johannesburg', kind: 'city', lat: -26.2041, lng: 28.0473, radiusKm: 60 },
  { id: 'durban', name: 'Durban', kind: 'city', lat: -29.8587, lng: 31.0218, radiusKm: 50 },
  { id: 'bloemfontein', name: 'Bloemfontein', kind: 'city', lat: -29.0852, lng: 26.1596, radiusKm: 45 },
  { id: 'nelspruit', name: 'Nelspruit', kind: 'city', lat: -25.4753, lng: 30.9694, radiusKm: 45 },
  { id: 'pietermaritzburg', name: 'Pietermaritzburg', kind: 'city', lat: -29.6006, lng: 30.3794, radiusKm: 35 },
  { id: 'winterton', name: 'Winterton', kind: 'region', lat: -28.8130, lng: 29.5300, radiusKm: 30 },
  { id: 'bergville', name: 'Bergville', kind: 'region', lat: -28.7320, lng: 29.3620, radiusKm: 30 },
  { id: 'underberg', name: 'Underberg & Southern Berg', kind: 'region', lat: -29.7853, lng: 29.4970, radiusKm: 40 },
  { id: 'clarens', name: 'Clarens', kind: 'region', lat: -28.5140, lng: 28.4230, radiusKm: 35 },
  { id: 'estcourt', name: 'Estcourt', kind: 'region', lat: -29.0090, lng: 29.8790, radiusKm: 30 },
  { id: 'royal-natal', name: 'Royal Natal', kind: 'valley', lat: -28.6890, lng: 28.9490, radiusKm: 18 },
  { id: 'cathedral-peak', name: 'Cathedral Peak', kind: 'valley', lat: -28.9480, lng: 29.2010, radiusKm: 18 },
  { id: 'monks-cowl', name: "Monk's Cowl / Champagne Valley", kind: 'valley', lat: -29.0510, lng: 29.3990, radiusKm: 18 },
  { id: 'giants-castle', name: 'Giants Castle', kind: 'valley', lat: -29.2810, lng: 29.5210, radiusKm: 18 },
  { id: 'injisuthi', name: 'Injisuthi', kind: 'valley', lat: -29.1180, lng: 29.4370, radiusKm: 15 },
  { id: 'sani-pass', name: 'Sani Pass', kind: 'valley', lat: -29.5850, lng: 29.2870, radiusKm: 20 },
]

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10
}

export function pointCoords(point: GeoPoint | undefined | null): { lat: number; lng: number } | null {
  if (!point?.lat || !point?.lng) return null
  const lat = Number(point.lat)
  const lng = Number(point.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** Nearest reference area that contains the point (nearest-first tie break). */
export function areaForPoint(point: GeoPoint | undefined | null): TransportArea | null {
  const coords = pointCoords(point)
  if (!coords) return null
  let best: { area: TransportArea; distance: number } | null = null
  for (const area of TRANSPORT_AREAS) {
    const distance = haversineKm(coords.lat, coords.lng, area.lat, area.lng)
    if (distance <= area.radiusKm && (!best || distance < best.distance)) best = { area, distance }
  }
  return best?.area ?? null
}

/**
 * Trip classification drives supplier eligibility: long hauls from the
 * gateway cities belong to gateway operators, mid-range moves to regional
 * operators, short in-valley hops to local operators.
 */
export function classifyTrip(distanceKm: number | undefined, pickup: GeoPoint, dropoff: GeoPoint): TripClass {
  const pickupArea = areaForPoint(pickup)
  const dropArea = areaForPoint(dropoff)
  if (pickupArea?.kind === 'city' || dropArea?.kind === 'city') return 'gateway'
  const km = distanceKm ?? (() => {
    const a = pointCoords(pickup)
    const b = pointCoords(dropoff)
    return a && b ? haversineKm(a.lat, a.lng, b.lat, b.lng) : undefined
  })()
  if (km !== undefined && km > 130) return 'gateway'
  if (km !== undefined && km <= 30 && pickupArea?.kind === 'valley' && dropArea?.kind === 'valley' && pickupArea.id === dropArea.id) return 'local'
  if (km !== undefined && km <= 25) return 'local'
  return 'regional'
}

/** Which supplier categories may receive a trip of this class (native category first). */
export function eligibleCategories(tripClass: TripClass): SupplierCategory[] {
  if (tripClass === 'gateway') return ['gateway', 'regional']
  if (tripClass === 'regional') return ['regional', 'gateway', 'local']
  return ['local', 'regional']
}

// ── Transport companies ─────────────────────────────────────────────────────

export type CompanyStats = {
  completedTrips: number
  cancelledTrips: number
  acceptedOffers: number
  declinedOffers: number
  responseMinutesTotal: number
  responseCount: number
  ratingTotal: number
  ratingCount: number
}

export const EMPTY_STATS: CompanyStats = {
  completedTrips: 0, cancelledTrips: 0, acceptedOffers: 0, declinedOffers: 0,
  responseMinutesTotal: 0, responseCount: 0, ratingTotal: 0, ratingCount: 0,
}

/** A confirmed job on this company's board — visible to the dispatch scorer
 *  and the optimiser so follow-on work near an existing journey ranks first. */
export type OpenJob = {
  requestId: string
  date: string
  time?: string
  passengers: number
  pickupLat?: number
  pickupLng?: number
  dropLat?: number
  dropLng?: number
  dropAreaId?: string
}

export type TransportCompany = {
  id: string
  supplierId: string
  companyName: string
  category: SupplierCategory
  homeBase: GeoPoint
  serviceAreaIds: string[]
  operatingRadiusKm: number
  ratePerKm: number
  minimumFare: number
  contactPhone?: string
  description?: string
  status: string
  stats: CompanyStats
  openJobs: OpenJob[]
  createdAt: string
  updatedAt?: string
}

const COMPANY_KIND = 'transport_company'

// Optional client param — lets the public /transport/[slug] route (a
// session-less server render) resolve the operator's display name for a
// route without a signed-in supplier session. See lib/supabase-public.ts.
export async function getTransportCompanies(client?: SupabaseClient): Promise<TransportCompany[]> {
  const all = await listEntities<TransportCompany>(COMPANY_KIND, client)
  return all.map(c => ({ ...c, stats: { ...EMPTY_STATS, ...c.stats }, openJobs: c.openJobs ?? [] }))
}

// Owner-scoped read rather than pulling every transport company to find one.
// Optional client param — lets the public /transport/[slug] route (a
// session-less server render) resolve the operator's display name for a
// route without a signed-in supplier session. See lib/supabase-public.ts.
export async function getMyTransportCompany(supplierId: string, client?: SupabaseClient): Promise<TransportCompany | null> {
  const mine = await listEntitiesByOwner<TransportCompany>(COMPANY_KIND, supplierId, client)
  const c = mine[0]
  return c ? { ...c, stats: { ...EMPTY_STATS, ...c.stats }, openJobs: c.openJobs ?? [] } : null
}

export async function saveTransportCompany(
  supplierId: string,
  data: Omit<TransportCompany, 'id' | 'supplierId' | 'status' | 'stats' | 'openJobs' | 'createdAt'>,
): Promise<TransportCompany> {
  const existing = await getMyTransportCompany(supplierId)
  if (existing) {
    await updateEntity(COMPANY_KIND, existing.id, { ...data, updatedAt: new Date().toISOString() })
    return { ...existing, ...data }
  }
  const company: TransportCompany = {
    ...data,
    id: newEntityId('tco'),
    supplierId,
    status: 'active',
    stats: { ...EMPTY_STATS },
    openJobs: [],
    createdAt: new Date().toISOString(),
  }
  await insertEntity(COMPANY_KIND, company)
  return company
}

async function patchCompany(companyId: string, patch: Record<string, unknown>): Promise<void> {
  await updateEntity(COMPANY_KIND, companyId, { ...patch, updatedAt: new Date().toISOString() })
}

// ── Fleet: vehicles & drivers ───────────────────────────────────────────────

export type FleetStatus = 'available' | 'reserved' | 'on_trip' | 'maintenance' | 'blocked'

export type VehicleBlock = { id: string; from: string; to: string; reason: string }

export type TransportVehicle = SupplierEntity & {
  name?: string
  make?: string
  model?: string
  type?: string
  seats?: number
  capacity?: number
  registration?: string
  reg?: string
  status?: string
  /** Operational lifecycle state — the entity row itself stays 'active' so the
   *  dispatch scorer can read the fleet. Legacy rows without it map from status. */
  fleetStatus?: FleetStatus
  currentLocation?: GeoPoint
  blocks?: VehicleBlock[]
  activeRequestId?: string | null
}

export type TransportDriver = SupplierEntity & {
  name?: string
  fullName?: string
  licenseType?: string
  license?: string
  languages?: string
  status?: string
  dutyStatus?: 'available' | 'assigned' | 'off'
  activeRequestId?: string | null
}

export function vehicleFleetStatus(v: TransportVehicle): FleetStatus {
  if (v.fleetStatus) return v.fleetStatus
  if (v.status === 'maintenance') return 'maintenance'
  if (v.status === 'inactive') return 'blocked'
  return 'available'
}

export function vehicleSeats(v: TransportVehicle): number {
  return Number(v.seats ?? v.capacity ?? 0)
}

export function vehicleBlockedOn(v: TransportVehicle, date: string): VehicleBlock | null {
  return (v.blocks ?? []).find(b => b.from <= date && date <= b.to) ?? null
}

/** Available for a job on `date`: lifecycle-available, not in maintenance, no manual block. */
export function vehicleAvailableOn(v: TransportVehicle, date: string): boolean {
  return vehicleFleetStatus(v) === 'available' && !vehicleBlockedOn(v, date)
}

export function driverAvailable(d: TransportDriver): boolean {
  return (d.dutyStatus ?? 'available') === 'available' && d.status !== 'inactive'
}

export async function getSupplierVehicles(supplierId: string): Promise<TransportVehicle[]> {
  return getSupplierEntities<TransportVehicle>('vehicles', supplierId)
}

export async function getFleet(supplierId: string): Promise<{ vehicles: TransportVehicle[]; drivers: TransportDriver[] }> {
  const [vehicles, drivers] = await Promise.all([
    getSupplierEntities<TransportVehicle>('vehicles', supplierId),
    getSupplierEntities<TransportDriver>('drivers', supplierId),
  ])
  return { vehicles, drivers }
}

export async function setVehicleFleetStatus(vehicleId: string, fleetStatus: FleetStatus, extra: Partial<TransportVehicle> = {}): Promise<void> {
  await updateSupplierEntity('vehicles', vehicleId, { fleetStatus, ...extra })
}

export async function addVehicleBlock(vehicle: TransportVehicle, block: Omit<VehicleBlock, 'id'>): Promise<void> {
  const blocks = [...(vehicle.blocks ?? []), { ...block, id: newEntityId('blk') }]
  await updateSupplierEntity('vehicles', vehicle.id, { blocks })
}

export async function removeVehicleBlock(vehicle: TransportVehicle, blockId: string): Promise<void> {
  await updateSupplierEntity('vehicles', vehicle.id, { blocks: (vehicle.blocks ?? []).filter(b => b.id !== blockId) })
}

// ── Transport requests ──────────────────────────────────────────────────────

export type TransportRequestStatus =
  | 'pending'        // created, being scored
  | 'offered'        // top-ranked suppliers notified, waiting for acceptance
  | 'accepted'       // a supplier claimed it and reserved a vehicle
  | 'driver_assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'unassigned'     // every offered supplier declined — needs admin attention

export type OfferBreakdownLine = { factor: string; points: number; max: number; note?: string }

export type TransportOffer = {
  supplierId: string
  companyId: string
  companyName: string
  category: SupplierCategory
  score: number
  rank: number
  breakdown: OfferBreakdownLine[]
  offeredAt?: string
  respondedAt?: string
  response?: 'accepted' | 'declined'
}

export type TransportAssignment = {
  supplierId: string
  companyId: string
  companyName: string
  vehicleId: string
  vehicleName?: string
  driverId?: string
  driverName?: string
  acceptedAt: string
  driverAssignedAt?: string
  startedAt?: string
  completedAt?: string
}

export type TransportRequest = {
  id: string
  bookingId?: string
  bookingReference?: string
  userId: string
  customerName?: string
  status: TransportRequestStatus
  pickup: GeoPoint
  dropoff: GeoPoint
  date: string
  time?: string
  passengers: number
  shuttleType?: string
  distanceKm?: number
  durationMinutes?: number
  tripClass: TripClass
  quotedPrice: number
  /** Vehicle the customer picked at booking time — preselected in the
   *  supplier's accept flow. */
  requestedVehicleId?: string
  requestedVehicleName?: string
  /** Flight / arrival details for the partner's meet & greet. */
  meetAndGreet?: MeetAndGreetDetails
  offers: TransportOffer[]
  assignment?: TransportAssignment
  createdAt: string
  updatedAt?: string
}

type RequestRow = {
  id: string
  booking_id: string | null
  user_id: string
  status: string
  offered_supplier_ids: string[]
  assigned_supplier_id: string | null
  value: Record<string, unknown>
  created_at: string
  updated_at: string
}

function rowToRequest(r: RequestRow): TransportRequest {
  return {
    ...(r.value as unknown as TransportRequest),
    id: r.id,
    bookingId: r.booking_id ?? undefined,
    userId: r.user_id,
    status: r.status as TransportRequestStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** RLS scopes rows: customers their own, suppliers those offered/assigned to them, admins all. */
export async function getTransportRequests(): Promise<TransportRequest[]> {
  try {
    const { data } = await supabase
      .from('vd_transport_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as RequestRow[]).map(rowToRequest)
  } catch {}
  return []
}

export async function getTransportRequestById(id: string): Promise<TransportRequest | null> {
  try {
    const { data } = await supabase.from('vd_transport_requests').select('*').eq('id', id).maybeSingle()
    if (data) return rowToRequest(data as RequestRow)
  } catch {}
  return null
}

export async function insertTransportRequest(request: TransportRequest, offeredSupplierIds: string[]): Promise<void> {
  const { error } = await supabase.from('vd_transport_requests').insert({
    id: request.id,
    booking_id: request.bookingId ?? null,
    user_id: request.userId,
    status: request.status,
    offered_supplier_ids: offeredSupplierIds,
    assigned_supplier_id: null,
    value: request,
  })
  if (error) throw error
}

async function patchRequest(request: TransportRequest, columns: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabase
    .from('vd_transport_requests')
    .update({ status: request.status, value: request, updated_at: new Date().toISOString(), ...columns })
    .eq('id', request.id)
  if (error) throw error
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
// Vehicle availability updates automatically at every step — no manual
// calendar management:
//   accept → vehicle reserved · assign driver → driver on duty
//   start → vehicle on trip · complete → vehicle available at drop-off.

function offerFor(request: TransportRequest, supplierId: string): TransportOffer | undefined {
  return request.offers.find(o => o.supplierId === supplierId)
}

async function recordResponseStats(company: TransportCompany, offer: TransportOffer | undefined, accepted: boolean): Promise<void> {
  const stats = { ...EMPTY_STATS, ...company.stats }
  if (accepted) stats.acceptedOffers += 1
  else stats.declinedOffers += 1
  if (offer?.offeredAt) {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(offer.offeredAt).getTime()) / 60000))
    stats.responseMinutesTotal += minutes
    stats.responseCount += 1
  }
  await patchCompany(company.id, { stats })
}

/** Supplier accepts the booking opportunity, choosing which vehicle does the job. */
export async function acceptTransportRequest(
  request: TransportRequest,
  company: TransportCompany,
  vehicle: TransportVehicle,
): Promise<TransportRequest> {
  const now = new Date().toISOString()
  const offer = offerFor(request, company.supplierId)
  const updated: TransportRequest = {
    ...request,
    status: 'accepted',
    offers: request.offers.map(o => o.supplierId === company.supplierId
      ? { ...o, respondedAt: now, response: 'accepted' as const }
      : o),
    assignment: {
      supplierId: company.supplierId,
      companyId: company.id,
      companyName: company.companyName,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name ?? [vehicle.make, vehicle.model].filter(Boolean).join(' '),
      acceptedAt: now,
    },
  }
  await patchRequest(updated, { assigned_supplier_id: company.supplierId })

  // Vehicle reserved automatically.
  await setVehicleFleetStatus(vehicle.id, 'reserved', { activeRequestId: request.id })

  // Publish the job on the company board so dispatch & the optimiser can see
  // this company is already travelling into the drop-off region.
  const drop = pointCoords(request.dropoff)
  const pickupCoords = pointCoords(request.pickup)
  const openJobs: OpenJob[] = [...(company.openJobs ?? []), {
    requestId: request.id,
    date: request.date,
    time: request.time,
    passengers: request.passengers,
    pickupLat: pickupCoords?.lat,
    pickupLng: pickupCoords?.lng,
    dropLat: drop?.lat,
    dropLng: drop?.lng,
    dropAreaId: areaForPoint(request.dropoff)?.id,
  }]
  await patchCompany(company.id, { openJobs })
  await recordResponseStats({ ...company, openJobs }, offer, true)

  await notify(request.userId, 'booking',
    'Your transfer has a driver partner',
    `${company.companyName} accepted your transfer ${request.pickup.address} → ${request.dropoff.address} on ${request.date}.`,
    '/account')
  return updated
}

/** Supplier declines; the opportunity cascades to the next-ranked supplier. */
export async function declineTransportRequest(
  request: TransportRequest,
  company: TransportCompany,
): Promise<TransportRequest> {
  const now = new Date().toISOString()
  const offer = offerFor(request, company.supplierId)
  const offers = request.offers.map(o => o.supplierId === company.supplierId
    ? { ...o, respondedAt: now, response: 'declined' as const }
    : o)

  // Offer the job to the next-ranked supplier not yet notified.
  const next = offers.find(o => !o.offeredAt && !o.response)
  if (next) next.offeredAt = now

  const stillOpen = offers.some(o => o.offeredAt && !o.response)
  const updated: TransportRequest = { ...request, status: stillOpen ? 'offered' : 'unassigned', offers }
  await patchRequest(updated, {
    offered_supplier_ids: offers.filter(o => o.offeredAt).map(o => o.supplierId),
  })
  await recordResponseStats(company, offer, false)

  if (next) {
    await notify(next.supplierId, 'booking',
      'New transfer opportunity',
      `${request.pickup.address} → ${request.dropoff.address} on ${request.date} · ${request.passengers} pax · ${formatMoney(request.quotedPrice)}. You ranked #${next.rank} for this trip.`,
      '/supplier/jobs')
  }
  return updated
}

export async function assignDriverToRequest(request: TransportRequest, driver: TransportDriver): Promise<TransportRequest> {
  if (!request.assignment) throw new Error('Request has no assignment yet')
  const updated: TransportRequest = {
    ...request,
    status: 'driver_assigned',
    assignment: {
      ...request.assignment,
      driverId: driver.id,
      driverName: driver.fullName ?? driver.name ?? 'Driver',
      driverAssignedAt: new Date().toISOString(),
    },
  }
  await patchRequest(updated)
  await updateSupplierEntity('drivers', driver.id, { dutyStatus: 'assigned', activeRequestId: request.id })
  return updated
}

export async function startTrip(request: TransportRequest): Promise<TransportRequest> {
  if (!request.assignment) throw new Error('Request has no assignment yet')
  const updated: TransportRequest = {
    ...request,
    status: 'in_progress',
    assignment: { ...request.assignment, startedAt: new Date().toISOString() },
  }
  await patchRequest(updated)
  await setVehicleFleetStatus(request.assignment.vehicleId, 'on_trip')
  return updated
}

/** Trip completed: vehicle becomes available again at the drop-off location,
 *  the driver frees up, the job leaves the company board, reliability grows. */
export async function completeTrip(request: TransportRequest, company: TransportCompany): Promise<TransportRequest> {
  if (!request.assignment) throw new Error('Request has no assignment yet')
  const updated: TransportRequest = {
    ...request,
    status: 'completed',
    assignment: { ...request.assignment, completedAt: new Date().toISOString() },
  }
  await patchRequest(updated)

  await setVehicleFleetStatus(request.assignment.vehicleId, 'available', {
    activeRequestId: null,
    currentLocation: request.dropoff,
  })
  if (request.assignment.driverId) {
    await updateSupplierEntity('drivers', request.assignment.driverId, { dutyStatus: 'available', activeRequestId: null })
  }
  const stats = { ...EMPTY_STATS, ...company.stats, completedTrips: (company.stats?.completedTrips ?? 0) + 1 }
  await patchCompany(company.id, {
    stats,
    openJobs: (company.openJobs ?? []).filter(j => j.requestId !== request.id),
  })

  await notify(request.userId, 'info',
    'Transfer completed',
    `Your transfer ${request.pickup.address} → ${request.dropoff.address} with ${company.companyName} is complete. We hope you had a great ride!`,
    '/account')
  return updated
}

export async function cancelTransportRequest(request: TransportRequest, company?: TransportCompany | null): Promise<TransportRequest> {
  const updated: TransportRequest = { ...request, status: 'cancelled' }
  await patchRequest(updated)
  if (request.assignment) {
    await setVehicleFleetStatus(request.assignment.vehicleId, 'available', { activeRequestId: null })
    if (request.assignment.driverId) {
      await updateSupplierEntity('drivers', request.assignment.driverId, { dutyStatus: 'available', activeRequestId: null })
    }
    if (company) {
      await patchCompany(company.id, {
        stats: { ...EMPTY_STATS, ...company.stats, cancelledTrips: (company.stats?.cancelledTrips ?? 0) + 1 },
        openJobs: (company.openJobs ?? []).filter(j => j.requestId !== request.id),
      })
    }
  }
  return updated
}

// ── Derived company metrics used by scoring and dashboards ──────────────────

/** What this company charges for a trip, from its own rate card. */
export function companyTransferPrice(
  company: TransportCompany,
  distanceKm: number,
  passengers: number,
  shuttleType?: string,
): number {
  const ratePerKm = company.ratePerKm || 10
  const minimumFare = company.minimumFare || 350
  const base = Math.max(minimumFare, Math.round(distanceKm * ratePerKm))
  const extraPassengerFee = Math.round(distanceKm) * Math.max(0, passengers - 1)
  const privateFare = base + extraPassengerFee
  if (shuttleType === 'Shared Shuttle') {
    return Math.max(Math.round(minimumFare * 0.4), Math.round(privateFare * 0.45))
  }
  return privateFare
}

export function companyReliability(c: TransportCompany): number {
  const total = (c.stats?.completedTrips ?? 0) + (c.stats?.cancelledTrips ?? 0)
  if (total === 0) return 0.9 // neutral prior until history accumulates
  return (c.stats.completedTrips) / total
}

export function companyAvgResponseMinutes(c: TransportCompany): number | null {
  if (!c.stats?.responseCount) return null
  return Math.round(c.stats.responseMinutesTotal / c.stats.responseCount)
}

export function companyRating(c: TransportCompany): number {
  if (!c.stats?.ratingCount) return 4.0 // neutral prior
  return Math.round((c.stats.ratingTotal / c.stats.ratingCount) * 10) / 10
}
