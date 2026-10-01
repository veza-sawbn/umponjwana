// Minimal, dependency-free CSV parser — good enough for a small hand-edited
// or spreadsheet-exported contact list, not a general-purpose CSV library.
// Handles quoted fields, embedded commas/newlines inside quotes, and "" as
// an escaped quote. CRLF and LF line endings both work.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  // Last field/row if the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  return rows.filter(r => r.some(c => c.trim() !== ''))
}

export type CsvContactRow = { name: string; email: string; phone: string }

// Exports vary a lot more than a single "name"/"email"/"phone" column each —
// Wix's contact export in particular splits "First Name"/"Last Name" and
// gives every extra address its own numbered column ("Email 1", "Email 2",
// "Phone 1", …). Every header is classified by role rather than matched to
// one fixed column, so all of that is recognised without the file needing
// to be reshaped first.
type ColRole = 'firstName' | 'lastName' | 'name' | 'email' | 'phone'

function classifyHeader(raw: string): ColRole | null {
  const h = raw.trim().toLowerCase()
  if (/^first\s*name$/.test(h)) return 'firstName'
  if (/^last\s*name$/.test(h)) return 'lastName'
  if (/^(full\s*name|name|guest|customer)$/.test(h)) return 'name'
  if (/^email(\s*(address|\d+))?$/.test(h)) return 'email'
  if (/^(phone|mobile|cell|tel|telephone)(\s*(number|\d+))?$/.test(h)) return 'phone'
  return null
}

/** Trailing number in a header like "Email 2" (2) or "Email" (0) — used only
 *  to prefer the lower-numbered column when a row has more than one filled
 *  in, e.g. both "Email 1" and "Email 2" populated. */
function headerRank(raw: string): number {
  const m = raw.trim().match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : 0
}

function firstNonEmpty(row: string[], indexes: number[]): string {
  for (const i of indexes) {
    const v = row[i]?.trim()
    if (v) return v
  }
  return ''
}

/** Parses a CSV with a header row into {name, email, phone} rows. Column
 *  order and case don't matter; unrecognised columns are ignored. A First
 *  Name/Last Name split is joined into one name; repeated "Email N"/
 *  "Phone N" columns (Wix-style) all feed the same field, preferring the
 *  lowest-numbered one that's actually filled in for a given row. Rows with
 *  neither a name nor an email are dropped — nothing useful to import. */
export function parseContactsCsv(text: string): CsvContactRow[] {
  const table = parseCsv(text)
  if (table.length === 0) return []

  const header = table[0]
  let firstNameIdx = -1
  let lastNameIdx = -1
  const nameIdx: number[] = []
  const emailIdx: number[] = []
  const phoneIdx: number[] = []

  header
    .map((h, i) => ({ i, role: classifyHeader(h), rank: headerRank(h) }))
    .sort((a, b) => a.rank - b.rank)
    .forEach(({ i, role }) => {
      if (role === 'firstName' && firstNameIdx === -1) firstNameIdx = i
      else if (role === 'lastName' && lastNameIdx === -1) lastNameIdx = i
      else if (role === 'name') nameIdx.push(i)
      else if (role === 'email') emailIdx.push(i)
      else if (role === 'phone') phoneIdx.push(i)
    })

  return table.slice(1)
    .map(r => {
      const split = [firstNameIdx, lastNameIdx].map(i => (i !== -1 ? r[i]?.trim() : '')).filter(Boolean).join(' ')
      return {
        name: split || firstNonEmpty(r, nameIdx),
        email: firstNonEmpty(r, emailIdx),
        phone: firstNonEmpty(r, phoneIdx),
      }
    })
    .filter(r => r.name || r.email)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Directory contacts — the platform's own outreach list, compiled from the
 * regional tourism directories. A different shape from the per-supplier
 * address-book CSV above: one row per establishment, with the multi-valued
 * columns ("Source Site(s)", "Category", emails, phones, socials …) packed
 * into pipe- or semicolon-separated cells, which are split back out here so
 * the import can segment on them. See vd_import_directory_contacts() in
 * supabase/migrations/20260913_directory_contacts_segmentation.sql.
 * ──────────────────────────────────────────────────────────────────────────── */

export type DirectoryContactRow = {
  establishment: string
  contactPerson: string
  emails: string[]
  phones: string[]
  websites: string[]
  socials: string[]
  address: string
  bookingUrl: string
  sourceListingUrls: string[]
  sourceSites: string[]
  categories: string[]
  regions: string[]
  contactStatus: string
  /** ISO yyyy-mm-dd, or '' when the cell is blank or unparseable. */
  verifiedOn: string
  priority: '' | 'high' | 'medium' | 'low'
  outreachStatus: DirectoryOutreachStatus
  lastContacted: string
  followUpDate: string
  owner: string
  outreachNotes: string
  dataNotes: string
}

export type DirectoryOutreachStatus =
  'not_contacted' | 'contacted' | 'in_conversation' | 'converted' | 'declined' | 'unreachable'

/** Header lookup that ignores case, spacing and punctuation, so
 *  "Source Site(s)", "source sites" and "Source_Sites" all resolve. */
function normaliseHeader(h: string) {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

const DIRECTORY_HEADER_ALIASES: Record<string, keyof DirectoryContactRow> = {
  establishment: 'establishment', business: 'establishment', businessname: 'establishment', name: 'establishment',
  sourcesites: 'sourceSites', sourcesite: 'sourceSites', source: 'sourceSites',
  category: 'categories', categories: 'categories',
  region: 'regions', regions: 'regions', area: 'regions',
  contactperson: 'contactPerson', contact: 'contactPerson',
  email: 'emails', emails: 'emails', emailaddress: 'emails',
  phone: 'phones', phones: 'phones', telephone: 'phones', mobile: 'phones',
  website: 'websites', websites: 'websites', web: 'websites',
  social: 'socials', socials: 'socials', socialmedia: 'socials',
  address: 'address',
  bookingdirectoryurl: 'bookingUrl', bookingurl: 'bookingUrl', directoryurl: 'bookingUrl',
  sourcelistingurls: 'sourceListingUrls', sourcelistingurl: 'sourceListingUrls', listingurl: 'sourceListingUrls',
  contactstatus: 'contactStatus',
  verifiedon: 'verifiedOn', verified: 'verifiedOn',
  priority: 'priority',
  outreachstatus: 'outreachStatus', status: 'outreachStatus',
  lastcontacted: 'lastContacted',
  followupdate: 'followUpDate', followup: 'followUpDate',
  owner: 'owner', assignedto: 'owner',
  outreachnotes: 'outreachNotes', notes: 'outreachNotes',
  datanotes: 'dataNotes',
}

/** Pipes separate whole listings, semicolons separate values within one —
 *  both are just separators once the cell is split for segmentation. */
function splitList(value: string, semicolons = true): string[] {
  const parts = (value || '').split(semicolons ? /\s*[|;]\s*/ : /\s*\|\s*/)
  return [...new Set(parts.map(p => p.trim()).filter(Boolean))]
}

/** yyyy-mm-dd out of an ISO cell or anything Date can read; '' otherwise.
 *  Deliberately strict about the common dd/mm/yyyy-vs-mm/dd/yyyy ambiguity:
 *  a slashed date is only accepted when the first part can't be a month. */
function toIsoDate(value: string): string {
  const v = (value || '').trim()
  if (!v) return ''
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const slashed = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (slashed) {
    const [, a, b, y] = slashed
    if (Number(a) > 12) return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
    return ''
  }
  const parsed = new Date(v)
  return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function toOutreachStatus(value: string): DirectoryOutreachStatus {
  const v = (value || '').trim().toLowerCase()
  if (/converted|listed|signed|onboard/.test(v)) return 'converted'
  if (/declin|not interested|no thanks|rejected/.test(v)) return 'declined'
  if (/unreachable|bounced|no contact/.test(v)) return 'unreachable'
  if (/conversation|in progress|negotiat|replied|responded/.test(v)) return 'in_conversation'
  if (/^contacted|emailed|called|reached out/.test(v)) return 'contacted'
  return 'not_contacted'
}

function toPriority(value: string): '' | 'high' | 'medium' | 'low' {
  const v = (value || '').trim().toLowerCase()
  if (/^(high|1|a|urgent)$/.test(v)) return 'high'
  if (/^(medium|med|2|b|normal)$/.test(v)) return 'medium'
  if (/^(low|3|c)$/.test(v)) return 'low'
  return ''
}

/** True when the file looks like the master directory compile rather than
 *  the name/email/phone address-book CSV — used by the import UI to pick a
 *  parser instead of asking which kind of file this is. */
export function isDirectoryContactsCsv(text: string): boolean {
  const [header] = parseCsv(text)
  if (!header) return false
  const keys = header.map(normaliseHeader)
  return keys.includes('establishment') && (keys.includes('sourcesites') || keys.includes('sourcelistingurls'))
}

/** Parses the master directory CSV. Rows with no establishment name are
 *  dropped — that name is the row's identity on import (see the unique index
 *  on lower(establishment)), so a nameless row has nothing to upsert against. */
export function parseDirectoryContactsCsv(text: string): DirectoryContactRow[] {
  const table = parseCsv(text)
  if (table.length === 0) return []

  const columns = new Map<keyof DirectoryContactRow, number>()
  table[0].forEach((h, i) => {
    const field = DIRECTORY_HEADER_ALIASES[normaliseHeader(h)]
    if (field && !columns.has(field)) columns.set(field, i)
  })
  if (!columns.has('establishment')) return []

  const cell = (row: string[], field: keyof DirectoryContactRow) => {
    const i = columns.get(field)
    return i === undefined ? '' : (row[i] ?? '').trim()
  }

  return table.slice(1)
    .map(r => ({
      establishment: cell(r, 'establishment'),
      contactPerson: cell(r, 'contactPerson'),
      emails: splitList(cell(r, 'emails')),
      phones: splitList(cell(r, 'phones')),
      websites: splitList(cell(r, 'websites'), false),
      socials: splitList(cell(r, 'socials'), false),
      address: cell(r, 'address'),
      bookingUrl: splitList(cell(r, 'bookingUrl'), false)[0] ?? '',
      sourceListingUrls: splitList(cell(r, 'sourceListingUrls'), false),
      sourceSites: splitList(cell(r, 'sourceSites')),
      categories: splitList(cell(r, 'categories')),
      regions: splitList(cell(r, 'regions')),
      contactStatus: cell(r, 'contactStatus'),
      verifiedOn: toIsoDate(cell(r, 'verifiedOn')),
      priority: toPriority(cell(r, 'priority')),
      outreachStatus: toOutreachStatus(cell(r, 'outreachStatus')),
      lastContacted: toIsoDate(cell(r, 'lastContacted')),
      followUpDate: toIsoDate(cell(r, 'followUpDate')),
      owner: cell(r, 'owner'),
      outreachNotes: cell(r, 'outreachNotes'),
      dataNotes: cell(r, 'dataNotes'),
    }))
    .filter(r => r.establishment)
}
