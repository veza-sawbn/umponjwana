import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

/**
 * Suspension is enforced by RLS, and RLS only bites when the read carries no
 * privileged session.
 *
 * supabase/tests/suspension_hides_listings_test.sql proves the database half:
 * for all twelve supplier-owned entity kinds, a suspended, rejected or
 * never-approved supplier's rows are invisible to anon and to a signed-in
 * customer. What it cannot prove is that the app *asks* as one of them.
 *
 * The public read policy on vd_entities is OR-combined with policies that key
 * on the reader — "Admins read all entities", "Owners read own entities", the
 * managed-ops policies — so a catalog read made through the visitor's own
 * session returns a suspended supplier's listings to an admin, an ops agent,
 * or the supplier themselves. That is how suspended operators kept showing up
 * on /activities and in the shuttle picker: not a policy gap, a client choice.
 *
 * So every public surface must pass publicSupabase (lib/supabase-public.ts).
 * This test is the thing that notices when a new page forgets — twice now the
 * fix has been applied page by page and a later page reintroduced it.
 */

const ROOT = path.resolve(__dirname, '..')

/** Domain getters that read vd_entities, i.e. anything a supplier can own. */
const CATALOG_GETTERS = [
  'getActivities', 'getActivityById',
  'getProperties', 'getPropertyById', 'getRoomsByProperty',
  'getTours', 'getTourById',
  'getDepartures', 'getUpcomingExperiences',
  'getOperators', 'getOperatorById', 'getGuidesByOperator', 'getDirectoryGuides', 'getGuideById',
  'getTransportCompanies', 'getFleet', 'getSupplierVehicles',
  'getPublishedRoutes', 'getNearbyRoutes',
  'getPublishedPackages', 'getPackageById',
  'rankSuppliers',
]

/**
 * Surfaces a visitor can reach. The consoles are deliberately excluded: an
 * admin listing suspended suppliers is the console doing its job.
 */
const PUBLIC_DIRS = ['app', 'components']
const EXCLUDED = [
  'app/admin', 'app/supplier', 'app/operations', 'app/api',
  'components/admin', 'components/operations', 'components/editor',
]

/**
 * Reads that are session-bound on purpose. Each entry needs a reason, so an
 * exception is a decision somebody made rather than one that crept in.
 */
const ALLOWED: Record<string, string> = {
  'app/account/itinerary/page.tsx':
    "the visitor's own booked trip — names must still resolve if a supplier is suspended after booking",
  'app/itinerary/[id]/print/page.tsx':
    'same: a printed itinerary for a trip already paid for',
  'app/checkout/page.tsx':
    'resolves an item already in the cart; changing this read changes checkout semantics, tracked separately',
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const entry of entries) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** The text between the parens of a call starting at `open`. */
function argsOf(source: string, open: number): string {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++
    else if (source[i] === ')') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return source.slice(open + 1)
}

type Offence = { file: string; line: number; text: string }

function findSessionBoundReads(): Offence[] {
  const files = PUBLIC_DIRS.flatMap(d => walk(path.join(ROOT, d)))
  const offences: Offence[] = []

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/')
    if (EXCLUDED.some(x => rel.startsWith(x))) continue
    if (ALLOWED[rel]) continue

    const source = readFileSync(file, 'utf8')
    const lines = source.split('\n')

    for (const getter of CATALOG_GETTERS) {
      const re = new RegExp(`\\b${getter}\\s*\\(`, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(source)) !== null) {
        const open = m.index + m[0].length - 1
        const lineNo = source.slice(0, m.index).split('\n').length
        const line = lines[lineNo - 1] ?? ''
        const trimmed = line.trim()

        // Declarations, imports and prose are not reads.
        if (/^(\*|\/\/|import\b)/.test(trimmed)) continue
        if (/\b(function|const|let)\s+$/.test(source.slice(Math.max(0, m.index - 30), m.index))) continue

        const args = argsOf(source, open)
        // A client is being threaded through — publicSupabase directly, or a
        // `client` the caller passed in.
        if (/\bpublicSupabase\b|\bclient\b/.test(args)) continue

        offences.push({ file: rel, line: lineNo, text: trimmed.slice(0, 100) })
      }
    }
  }
  return offences
}

describe('public catalog reads are session-less', () => {
  it('no public page or component reads the catalog through the visitor session', () => {
    const offences = findSessionBoundReads()
    const report = offences.map(o => `  ${o.file}:${o.line}  ${o.text}`).join('\n')
    expect(
      offences,
      offences.length
        ? `These public reads would return a suspended supplier's listings to an admin, ` +
          `an ops agent or the supplier themselves. Pass publicSupabase, or add the file to ` +
          `ALLOWED with a reason:\n${report}`
        : '',
    ).toEqual([])
  })

  it('actually detects a session-bound read', () => {
    // Guards the guard: a matcher that silently matches nothing would make
    // this suite pass for ever.
    const sample = `
      import { getTransportCompanies } from '@/lib/transport'
      const companies = await getTransportCompanies()
    `
    const open = sample.indexOf('getTransportCompanies()') + 'getTransportCompanies'.length
    expect(argsOf(sample, open)).toBe('')
    expect(/\bpublicSupabase\b|\bclient\b/.test(argsOf(sample, open))).toBe(false)
  })
})
