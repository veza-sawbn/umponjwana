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
  starts_at: string
  ends_at: string
  ticket_price: number
  total_tickets: number
  tickets_sold: number
  is_published: boolean
  status: 'active' | 'draft'
  createdAt: string
  updatedAt?: string
} & GraphFields

const ENTITY = 'events'

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
