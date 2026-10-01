import { supabase } from './auth'
import { fetchAllRows } from './customers-admin'
import type { DirectoryContactRow, DirectoryOutreachStatus } from './csv'

/* ────────────────────────────────────────────────────────────────────────────
 * Directory contacts — the platform's own supplier-acquisition address book
 * (establishments compiled from Clarens.co.za, Drakensberg Experience,
 * Drakensberg.org and Midlands Meander), plus the segmentation computed over
 * it. See supabase/migrations/20260913_directory_contacts_segmentation.sql.
 *
 * Admin-only by virtue of what it reads: vd_directory_contacts and both
 * segment tables carry is_admin() policies and nothing else, so a supplier or
 * visitor session sees an empty list rather than someone else's prospects.
 *
 * Distinct from the platform's two other contact books:
 *   - lib/customers-admin.ts   registered customers, segmented on order history
 *   - lib/supplier-contacts.ts one supplier's own guests
 * ──────────────────────────────────────────────────────────────────────────── */

export type { DirectoryOutreachStatus }

export type DirectoryContact = {
  id: string
  establishment: string
  contactPerson: string | null
  email: string | null
  emails: string[]
  phone: string | null
  phones: string[]
  websites: string[]
  socials: string[]
  address: string | null
  bookingUrl: string | null
  sourceListingUrls: string[]
  sourceSites: string[]
  categories: string[]
  regions: string[]
  sectors: string[]
  contactStatus: string | null
  verifiedOn: string | null
  priority: 'high' | 'medium' | 'low' | null
  outreachStatus: DirectoryOutreachStatus
  lastContacted: string | null
  followUpDate: string | null
  owner: string | null
  outreachNotes: string
  dataNotes: string
  updatedAt: string
}

export type ContactSegment = {
  id: string
  name: string
  description: string
  group: string
  isGenerated: boolean
  sortOrder: number
  count: number
}

export const OUTREACH_STATUSES: { value: DirectoryOutreachStatus; label: string }[] = [
  { value: 'not_contacted',   label: 'Not Contacted' },
  { value: 'contacted',       label: 'Contacted' },
  { value: 'in_conversation', label: 'In Conversation' },
  { value: 'converted',       label: 'Converted' },
  { value: 'declined',        label: 'Declined' },
  { value: 'unreachable',     label: 'Unreachable' },
]

const OUTREACH_VALUES = new Set(OUTREACH_STATUSES.map(s => s.value))

/** Sentinel the RPC reads as "clear this date" — a null argument there means
 *  "leave it as it is", which a plain null can't distinguish from a clear. */
const CLEAR_DATE = '1900-01-01'

function rowToContact(r: any): DirectoryContact {
  return {
    id: r.id,
    establishment: r.establishment,
    contactPerson: r.contact_person,
    email: r.email,
    emails: r.emails ?? [],
    phone: r.phone,
    phones: r.phones ?? [],
    websites: r.websites ?? [],
    socials: r.socials ?? [],
    address: r.address,
    bookingUrl: r.booking_url,
    sourceListingUrls: r.source_listing_urls ?? [],
    sourceSites: r.source_sites ?? [],
    categories: r.categories ?? [],
    regions: r.regions ?? [],
    sectors: r.sectors ?? [],
    contactStatus: r.contact_status,
    verifiedOn: r.verified_on,
    priority: r.priority ?? null,
    outreachStatus: OUTREACH_VALUES.has(r.outreach_status) ? r.outreach_status : 'not_contacted',
    lastContacted: r.last_contacted,
    followUpDate: r.follow_up_date,
    owner: r.owner,
    outreachNotes: r.outreach_notes ?? '',
    dataNotes: r.data_notes ?? '',
    updatedAt: r.updated_at,
  }
}

/** Paginated: the compiled list is already ~600 rows and grows with every
 *  directory added, well past PostgREST's default 1000-row response cap. */
export async function getDirectoryContacts(): Promise<DirectoryContact[]> {
  const rows = await fetchAllRows<any>(
    (from, to) => supabase.from('vd_directory_contacts').select('*').order('establishment').range(from, to),
    'vd_directory_contacts',
  )
  return rows.map(rowToContact)
}

/** Segment definitions with their computed member counts, plus the raw
 *  membership so the table can filter to one segment without a round trip. */
export async function getContactSegments(): Promise<{
  segments: ContactSegment[]
  membersBySegment: Map<string, Set<string>>
}> {
  const [defs, members] = await Promise.all([
    supabase.from('vd_contact_segments').select('*').order('sort_order').order('name'),
    fetchAllRows<any>(
      (from, to) => supabase.from('vd_contact_segment_members').select('segment_id, contact_id').range(from, to),
      'vd_contact_segment_members',
    ),
  ])
  if (defs.error) {
    console.error('[directory-contacts] segment fetch failed:', defs.error)
    return { segments: [], membersBySegment: new Map() }
  }

  const membersBySegment = new Map<string, Set<string>>()
  for (const m of members) {
    const set = membersBySegment.get(m.segment_id) ?? new Set<string>()
    set.add(m.contact_id)
    membersBySegment.set(m.segment_id, set)
  }

  const segments: ContactSegment[] = (defs.data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    group: s.segment_group ?? 'Other',
    isGenerated: !!s.is_generated,
    sortOrder: s.sort_order ?? 100,
    count: membersBySegment.get(s.id)?.size ?? 0,
  }))
  return { segments, membersBySegment }
}

/** Bulk import/refresh from the master CSV. Directory fields are refreshed
 *  from the file; outreach progress already recorded against a row is kept
 *  (see the upsert in the migration), so re-importing a newer compile is
 *  safe at any point in an outreach campaign. Segments are recomputed by the
 *  same RPC, so membership is never stale on return. */
export async function importDirectoryContacts(
  rows: DirectoryContactRow[],
): Promise<{ imported: number; error: string | null }> {
  // Chunked so one oversized request can't fail the whole import: 600 rows of
  // 20 columns each is a few hundred KB of JSON in a single RPC body.
  const CHUNK = 150
  let imported = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await supabase.rpc('vd_import_directory_contacts', {
      p_rows: rows.slice(i, i + CHUNK),
    })
    if (error) return { imported, error: error.message }
    imported += Number(data) || 0
  }
  return { imported, error: null }
}

export async function recomputeContactSegments(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('vd_recompute_contact_segments', {})
  return { error: error?.message ?? null }
}

/** Updates the outreach fields of one contact. Every field is optional and
 *  an omitted one is left untouched; pass null for a date to clear it. */
export async function setDirectoryOutreach(
  id: string,
  patch: {
    outreachStatus?: DirectoryOutreachStatus
    priority?: 'high' | 'medium' | 'low' | null
    owner?: string | null
    lastContacted?: string | null
    followUpDate?: string | null
    outreachNotes?: string
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('vd_set_directory_outreach', {
    p_id: id,
    p_outreach_status: patch.outreachStatus ?? null,
    // '' is the clear signal for these two; undefined leaves them alone.
    p_priority: patch.priority === undefined ? null : (patch.priority ?? ''),
    p_owner: patch.owner === undefined ? null : (patch.owner ?? ''),
    p_last_contacted: patch.lastContacted === undefined ? null : (patch.lastContacted || CLEAR_DATE),
    p_follow_up_date: patch.followUpDate === undefined ? null : (patch.followUpDate || CLEAR_DATE),
    p_outreach_notes: patch.outreachNotes ?? null,
  })
  return { error: error?.message ?? null }
}
