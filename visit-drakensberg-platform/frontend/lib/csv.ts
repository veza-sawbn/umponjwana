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
