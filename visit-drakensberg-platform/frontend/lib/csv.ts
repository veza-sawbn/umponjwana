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

const HEADER_ALIASES: Record<string, keyof CsvContactRow> = {
  name: 'name', 'full name': 'name', fullname: 'name', guest: 'name', customer: 'name',
  email: 'email', 'email address': 'email',
  phone: 'phone', 'phone number': 'phone', mobile: 'phone', cell: 'phone', tel: 'phone', telephone: 'phone',
}

/** Parses a CSV with a header row into {name, email, phone} rows. Column
 *  order and case don't matter; unrecognised columns are ignored. Rows with
 *  neither a name nor an email are dropped — nothing useful to import. */
export function parseContactsCsv(text: string): CsvContactRow[] {
  const table = parseCsv(text)
  if (table.length === 0) return []

  const header = table[0].map(h => h.trim().toLowerCase())
  const colIndex: Partial<Record<keyof CsvContactRow, number>> = {}
  header.forEach((h, i) => {
    const key = HEADER_ALIASES[h]
    if (key && colIndex[key] === undefined) colIndex[key] = i
  })

  return table.slice(1)
    .map(r => ({
      name: (colIndex.name !== undefined ? r[colIndex.name] : '')?.trim() ?? '',
      email: (colIndex.email !== undefined ? r[colIndex.email] : '')?.trim() ?? '',
      phone: (colIndex.phone !== undefined ? r[colIndex.phone] : '')?.trim() ?? '',
    }))
    .filter(r => r.name || r.email)
}
