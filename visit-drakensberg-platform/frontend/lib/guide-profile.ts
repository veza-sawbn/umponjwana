// Pure helpers behind the public guide profile (app/guides/[id]/GuideDetail.tsx)
// and the supplier's guide editor (app/supplier/guides/[id]/edit/page.tsx).
// Kept free of React and Supabase so they can be unit-tested directly.

/** One headed block of a guide's story, after the introduction. */
export type BioSection = { heading: string; body: string }

/** The editor offers this many "More sections" before hiding its add button. */
export const MAX_BIO_SECTIONS = 4

// Straight and curly double/single quotes around a nickname inside a name,
// e.g. Asanda “Charlie” Ndlovu. Single quotes need a space before them so an
// apostrophe inside a surname (O'Brien) is not read as an opening quote.
const QUOTED_NICKNAME = /(?:^|\s)(?:"([^"]+)"|“([^”]+)”|‘([^’]+)’|'([^']+)')(?=\s|$)/

/**
 * Splits a guide's name for the hero: a smaller first line and a large
 * surname, with the nickname shown separately.
 *
 * `knownAs` wins when the supplier filled it in. Rows saved before that field
 * existed often carry the nickname in quotes inside `name` itself, so the
 * quoted part is lifted out and used instead. `name` is never rewritten:
 * departures and custom-trip requests match guides by their exact name.
 */
export function splitGuideName(name: string, knownAs?: string): { first: string; last: string; knownAs: string } {
  const match = name.match(QUOTED_NICKNAME)
  const quoted = match ? (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim() : ''
  const bare = (match ? name.replace(match[0], ' ') : name).replace(/\s+/g, ' ').trim()
  const words = bare.split(' ').filter(Boolean)
  const last = words.length > 0 ? words[words.length - 1] : ''
  const first = words.slice(0, -1).join(' ')
  return { first, last, knownAs: (knownAs ?? '').trim() || quoted }
}

/**
 * Splits free text into paragraphs on blank lines. A single line break inside
 * a paragraph becomes a space, so text pasted from a document with hard
 * wraps still reads as one paragraph.
 */
export function toParagraphs(text?: string): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
}

/**
 * Trims the editor's sections and drops empty ones, so an "Add section" the
 * supplier clicked and never filled in is not saved or shown. A section with
 * a heading but no text is dropped too: a heading over nothing reads as a
 * rendering fault on the public page.
 */
export function cleanBioSections(sections?: BioSection[]): BioSection[] {
  return (sections ?? [])
    .map(s => ({ heading: (s?.heading ?? '').trim(), body: (s?.body ?? '').trim() }))
    .filter(s => s.body)
    .slice(0, MAX_BIO_SECTIONS)
}
