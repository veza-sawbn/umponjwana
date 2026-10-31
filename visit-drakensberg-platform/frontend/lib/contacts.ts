import { supabase } from './auth'
import { fetchAllRows } from './customers-admin'

/* ────────────────────────────────────────────────────────────────────────────
 * The platform contact book (vd_contacts) — one list of everyone we can
 * invoice, the way Wix keeps one contact list for the whole site. See
 * supabase/migrations/20261031_platform_contacts.sql.
 *
 * Filled from: the Wix import, registered visitor accounts, every customer an
 * invoice is generated for (automatically, by a database trigger), CSV imports
 * from the admin Contacts page, and contacts added there by hand.
 *
 * Staff-only by RLS. The pure helpers below (search, grouping, avatar) are
 * what the New Invoice picker and the Contacts page share.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ContactSource = 'imported' | 'account' | 'invoice' | 'manual'

export type Contact = {
  id: string
  name: string
  email: string | null
  phone: string
  userId: string | null
  isCompany: boolean
  company: string
  vatNumber: string
  registrationNumber: string
  address: string
  sources: ContactSource[]
  invoiceCount: number
  lastInvoicedAt: string | null
  createdAt: string
}

export const SOURCE_LABEL: Record<ContactSource, string> = {
  imported: 'Imported',
  account: 'Account',
  invoice: 'Invoiced',
  manual: 'Added by hand',
}

function rowToContact(r: any): Contact {
  return {
    id: r.id,
    name: r.name ?? '',
    email: r.email ?? null,
    phone: r.phone ?? '',
    userId: r.user_id ?? null,
    isCompany: !!r.is_company,
    company: r.company ?? '',
    vatNumber: r.vat_number ?? '',
    registrationNumber: r.registration_number ?? '',
    address: r.address ?? '',
    sources: Array.isArray(r.sources) ? r.sources : [],
    invoiceCount: r.invoice_count ?? 0,
    lastInvoicedAt: r.last_invoiced_at ?? null,
    createdAt: r.created_at,
  }
}

/**
 * Every contact. Paginated: the book is already past PostgREST's 1000-row
 * single-response cap once a full Wix export is imported.
 * Returns null when the table is missing (migration not applied yet), so the
 * caller can fall back rather than show an empty book as if it were real.
 */
export async function getContacts(): Promise<Contact[] | null> {
  const probe = await supabase.from('vd_contacts').select('id').limit(1)
  if (probe.error) {
    console.error('[contacts] vd_contacts unavailable:', probe.error.message)
    return null
  }
  const rows = await fetchAllRows<any>(
    (from, to) => supabase.from('vd_contacts').select('*').order('name').order('id').range(from, to),
    'vd_contacts',
  )
  return rows.map(rowToContact)
}

export type ContactInput = {
  name: string
  email?: string
  phone?: string
  isCompany?: boolean
  company?: string
  vatNumber?: string
  registrationNumber?: string
  address?: string
}

/** Add a contact by hand (merges into an existing one with the same email/phone). */
export async function saveContact(input: ContactInput): Promise<string> {
  const { data, error } = await supabase.rpc('vd_save_contact', { p_contact: input })
  if (error) throw new Error(error.message)
  return data as string
}

/** Bulk import (e.g. a Wix export). Fills blanks only; returns rows filed. */
export async function importContacts(rows: { name: string; email: string; phone: string }[]): Promise<number> {
  // One call per chunk keeps each request well under the gateway's body limit.
  const CHUNK = 1000
  let total = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await supabase.rpc('vd_import_contacts', { p_rows: rows.slice(i, i + CHUNK) })
    if (error) throw new Error(error.message)
    total += (data as number) ?? 0
  }
  return total
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/** What the list shows as the contact's name: name, else company, else email, else phone. */
export function contactLabel(c: Pick<Contact, 'name' | 'company' | 'email' | 'phone'>): string {
  return c.name.trim() || c.company.trim() || c.email || c.phone.trim() || 'Unnamed contact'
}

/** The line under the name: whatever the label didn't already use. */
export function contactDetail(c: Pick<Contact, 'name' | 'company' | 'email' | 'phone'>): string {
  const label = contactLabel(c)
  return [c.email, c.phone.trim()].filter(v => v && v !== label).join(' · ')
}

/** A–Z section letter for the list, '#' for numbers and anything else (Wix does the same). */
export function contactInitial(c: Pick<Contact, 'name' | 'company' | 'email' | 'phone'>): string {
  const ch = contactLabel(c).trim().charAt(0).toUpperCase()
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return /^[A-Z]$/.test(base) ? base : '#'
}

/** Avatar text: up to two initials of a name, or the first character otherwise. */
export function avatarText(c: Pick<Contact, 'name' | 'company' | 'email' | 'phone'>): string {
  const label = contactLabel(c).trim()
  const words = label.split(/\s+/).filter(w => /^\p{L}/u.test(w))
  if (c.name.trim() && words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  return label.charAt(0).toUpperCase() || '?'
}

const AVATAR_COLOURS = ['#7B5BD6', '#F5AF19', '#18B0E0', '#C33D97', '#2d6a4f', '#E2684A', '#3F7FE0', '#8B6914']

/** A stable colour per contact, like Wix's coloured circles. */
export function avatarColour(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length]
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Search by name, company, email or phone. Every word typed must match
 * somewhere; a query with digits also matches phone numbers regardless of
 * spaces, dashes or a leading +.
 */
export function searchContacts<T extends Contact>(contacts: T[], query: string): T[] {
  const words = fold(query).trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return contacts
  const queryDigits = query.replace(/\D/g, '')
  return contacts.filter(c => {
    const hay = fold(`${c.name} ${c.company} ${c.email ?? ''} ${c.phone}`)
    if (words.every(w => hay.includes(w))) return true
    return queryDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(queryDigits)
  })
}

/** Sorted A–Z by label, '#' (numbers and the like) last — Wix puts it first; last reads better for us. */
export function sortContacts<T extends Contact>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => {
    const ia = contactInitial(a), ib = contactInitial(b)
    if (ia !== ib) return ia === '#' ? 1 : ib === '#' ? -1 : ia.localeCompare(ib)
    return contactLabel(a).localeCompare(contactLabel(b), 'en', { sensitivity: 'base', numeric: true })
  })
}

/** Sorted contacts split into lettered sections. */
export function groupContacts<T extends Contact>(contacts: T[]): { letter: string; contacts: T[] }[] {
  const groups: { letter: string; contacts: T[] }[] = []
  for (const c of sortContacts(contacts)) {
    const letter = contactInitial(c)
    const last = groups[groups.length - 1]
    if (last && last.letter === letter) last.contacts.push(c)
    else groups.push({ letter, contacts: [c] })
  }
  return groups
}
