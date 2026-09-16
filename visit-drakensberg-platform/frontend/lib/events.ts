import {
  getSupplierEntities, getSupplierEntity, addSupplierEntity, updateSupplierEntity, deleteSupplierEntity,
} from './supplier-entities'
import type { GraphFields } from './graph-fields'

// Events are a genuine destination-graph entity — not a filtered view of
// Activities or Tours (see docs/destination-graph/PHASE_A.md, "Events").
// They are created exclusively by suppliers via /supplier/events, so the
// public /events page is expected to show nothing until suppliers publish
// listings — that's the correct, honest state of an empty catalogue, not a
// bug to work around.
//
// Storage: uses the existing generic `supplier_events` entity kind
// (lib/supplier-entities.ts's `kindFor('events')`) rather than a new kind —
// app/supplier/events/page.tsx and app/events/page.tsx already read/write
// this kind via `getSupplierEntities<any>('events', ...)`. This module is a
// typed wrapper around the same underlying rows, not a new storage location,
// so no existing event data is orphaned by its introduction.
export type EventSession = {
  id: string
  starts_at: string
  ends_at: string
  status: 'active' | 'cancelled'
}

export type EventTicketType = {
  id: string
  name: string
  price: number
  description?: string
}

export type EventTicketCapacity = { total: number; sold: number }

// [sessionId][ticketTypeId] — mirrors the nested-jsonb capacity shape
// activities use for timeslots (value.slotBookings, 20260829_activity_
// timeslots.sql), so the same `for update`-locked RPC pattern applies here.
// `sold` is only ever written by vd_issue_tickets/vd_release_tickets — never
// set it directly through updateEvent().
export type EventCapacityMap = Record<string, Record<string, EventTicketCapacity>>

export type Event = {
  id: string
  supplierId: string
  title: string
  description: string
  event_type: 'event' | 'special'
  location: string
  /** Canonical region name (e.g. "Northern Drakensberg") — lets events
   *  participate in region pages and "nearby" recommendation modules the
   *  same way trails, properties and activities do. */
  region: string
  gpsLat: string
  gpsLng: string
  /** Earliest session's start/end — kept for list sort/display only; never
   *  the source of truth for capacity (see `sessions`/`capacity` below). */
  starts_at: string
  ends_at: string
  /** Legacy flat price/capacity from before ticket tiers existed. Kept only
   *  so very old rows still display something; a row with `ticketTypes` set
   *  ignores these in favour of the tier prices below. */
  ticket_price: number
  total_tickets: number
  tickets_sold: number
  /** Dated occurrences of this event (Wix-Events-style: one listing, many
   *  sessions to choose from at checkout). */
  sessions: EventSession[]
  /** Price tiers (e.g. General/VIP), shared across every session. */
  ticketTypes: EventTicketType[]
  /** Per-session, per-tier capacity — the only source of truth for how many
   *  tickets remain; mutated exclusively via vd_issue_tickets/vd_release_tickets. */
  capacity: EventCapacityMap
  is_published: boolean
  status: 'active' | 'draft'
  createdAt: string
  updatedAt?: string
} & GraphFields

const ENTITY = 'events'

/** Tickets already sold for one session/tier combination. */
export function ticketsSold(event: Pick<Event, 'capacity'>, sessionId: string, ticketTypeId: string): number {
  return event.capacity?.[sessionId]?.[ticketTypeId]?.sold ?? 0
}

/** Tickets still available for one session/tier combination. */
export function ticketsRemaining(event: Pick<Event, 'capacity'>, sessionId: string, ticketTypeId: string): number {
  const cap = event.capacity?.[sessionId]?.[ticketTypeId]
  if (!cap) return 0
  return Math.max(cap.total - cap.sold, 0)
}

/** Total remaining tickets across every tier for one session. */
export function sessionRemaining(event: Pick<Event, 'capacity'>, sessionId: string): number {
  const tiers = event.capacity?.[sessionId] ?? {}
  return Object.values(tiers).reduce((sum, c) => sum + Math.max(c.total - c.sold, 0), 0)
}

/** Cheapest ticket tier's price, for "From R___" display. */
export function eventFromPrice(event: Pick<Event, 'ticketTypes' | 'ticket_price'>): number {
  if (event.ticketTypes?.length) return Math.min(...event.ticketTypes.map(t => t.price))
  return event.ticket_price ?? 0
}

function newSubId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${uuid}`
}

/**
 * Adds a dated session to an event and persists it. Read-modify-write on the
 * event's editorial content (title, sessions list, tier list) — same
 * last-write-wins posture the rest of the supplier portal already accepts
 * for entity edits; `capacity[...].sold` is never touched here.
 */
export async function addEventSession(event: Event, session: Omit<EventSession, 'id'>): Promise<EventSession> {
  const newSession: EventSession = { id: newSubId('sess'), ...session }
  const sessions = [...(event.sessions ?? []), newSession]
  await updateEvent(event.id, { sessions })
  return newSession
}

export async function removeEventSession(event: Event, sessionId: string): Promise<void> {
  const sessions = (event.sessions ?? []).filter(s => s.id !== sessionId)
  const capacity = { ...(event.capacity ?? {}) }
  delete capacity[sessionId]
  await updateEvent(event.id, { sessions, capacity })
}

export async function addEventTicketType(event: Event, ticketType: Omit<EventTicketType, 'id'>): Promise<EventTicketType> {
  const newType: EventTicketType = { id: newSubId('tier'), ...ticketType }
  const ticketTypes = [...(event.ticketTypes ?? []), newType]
  await updateEvent(event.id, { ticketTypes })
  return newType
}

export async function removeEventTicketType(event: Event, ticketTypeId: string): Promise<void> {
  const ticketTypes = (event.ticketTypes ?? []).filter(t => t.id !== ticketTypeId)
  const capacity: EventCapacityMap = {}
  for (const [sessionId, tiers] of Object.entries(event.capacity ?? {})) {
    const { [ticketTypeId]: _removed, ...rest } = tiers
    capacity[sessionId] = rest
  }
  await updateEvent(event.id, { ticketTypes, capacity })
}

/** Sets how many tickets a session/tier combination can sell in total. Never
 *  touches `sold` — that only ever moves through vd_issue_tickets/vd_release_tickets. */
export async function setEventCapacity(event: Event, sessionId: string, ticketTypeId: string, total: number): Promise<void> {
  const capacity: EventCapacityMap = { ...(event.capacity ?? {}) }
  const forSession = { ...(capacity[sessionId] ?? {}) }
  const existing = forSession[ticketTypeId]
  forSession[ticketTypeId] = { total: Math.max(0, Math.floor(total)), sold: existing?.sold ?? 0 }
  capacity[sessionId] = forSession
  await updateEvent(event.id, { capacity })
}

export async function getEvents(): Promise<Event[]> {
  return getSupplierEntities<Event>(ENTITY)
}

export async function getPublishedEvents(): Promise<Event[]> {
  const all = await getSupplierEntities<Event>(ENTITY)
  return all.filter(e => e.is_published)
}

export async function getEventsBySupplier(supplierId: string): Promise<Event[]> {
  return getSupplierEntities<Event>(ENTITY, supplierId)
}

export async function getEventById(id: string): Promise<Event | null> {
  return getSupplierEntity<Event>(ENTITY, id)
}

export async function addEvent(e: Omit<Event, 'id' | 'createdAt'>): Promise<Event> {
  return addSupplierEntity<Event>(ENTITY, e)
}

export async function updateEvent(id: string, patch: Partial<Event>): Promise<void> {
  return updateSupplierEntity<Event>(ENTITY, id, patch)
}

export async function deleteEvent(id: string): Promise<void> {
  return deleteSupplierEntity(ENTITY, id)
}
