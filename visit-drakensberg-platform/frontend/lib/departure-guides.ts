// A departure's guides live in its `guide` text field — the one every page,
// email and itinerary already reads — as names joined with " + ", lead
// guide first (e.g. "Sipho Dlamini + Thabo Ndlovu"). These helpers turn that
// string into a list and back, so a departure can carry several guides
// without changing what anything downstream displays.

const SEPARATORS = /\s*(?:\+|,|&|\band\b)\s*/i

/** "Sipho Dlamini + Thabo Ndlovu" → ["Sipho Dlamini", "Thabo Ndlovu"]. */
export function splitGuides(value: string | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of (value ?? '').split(SEPARATORS)) {
    const name = raw.replace(/\s+/g, ' ').trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out
}

/** ["Sipho Dlamini", "Thabo Ndlovu"] → "Sipho Dlamini + Thabo Ndlovu". */
export function joinGuides(names: string[]): string {
  return splitGuides(names.join(' + ')).join(' + ')
}

/** Whether two guide strings name the same guides in the same order. */
export function sameGuides(a: string | null | undefined, b: string | null | undefined): boolean {
  return joinGuides(splitGuides(a)) === joinGuides(splitGuides(b))
}

/** Whether `name` is one of the guides on a departure (case-insensitive). */
export function hasGuide(value: string | null | undefined, name: string | null | undefined): boolean {
  const n = (name ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  return !!n && splitGuides(value).some(g => g.toLowerCase() === n)
}

/** "Lead Guide" for one guide, "Guides" when a departure has several. */
export function guidesLabel(value: string | null | undefined): string {
  return splitGuides(value).length > 1 ? 'Guides' : 'Lead Guide'
}
