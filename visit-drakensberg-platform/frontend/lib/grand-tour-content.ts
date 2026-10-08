import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './auth'
import { GRAND_TOUR_STAGES, type GrandTourStage, type GrandTourHighlight } from './grand-tour'

// The editable words and pictures of /grand-tour: hero, introduction, the
// stages with their highlights, and the "how booking works" band. Admins
// edit it at /admin/grand-tour; it is stored as one JSON row in site_content
// (public read, admin write — 20260704_secure_data_layer.sql), and the
// built-in route in lib/grand-tour.ts is the default until someone saves.
//
// Highlight ids are what day tours point at (Activity.grandTour.highlightIds)
// and stage ids are what stage features point at (vd_grand_tour_features), so
// the editor keeps existing ids when text changes and mints new ones only for
// new rows. Deleting a highlight simply drops it from any tour that visited it.

export const GRAND_TOUR_CONTENT_KEY = 'grand_tour_page'

export type GrandTourContent = {
  hero: { eyebrow: string; title: string; subtitle: string; image: string; imageAlt: string }
  intro: { kicker: string; heading: string; body: string }
  stages: GrandTourStage[]
  howItWorks: {
    kicker: string
    heading: string
    steps: { title: string; text: string }[]
    supplierLine: string
    supplierCta: string
  }
}

export const DEFAULT_GRAND_TOUR_CONTENT: GrandTourContent = {
  hero: {
    eyebrow: '',
    title: 'Grand Tour Drakensberg',
    subtitle: 'An itinerary along the Dragon’s back, with day tours you can join from your hotel.',
    image: GRAND_TOUR_STAGES[0].image,
    imageAlt: 'The Amphitheatre in the Northern Drakensberg',
  },
  intro: {
    kicker: 'The route',
    heading: 'A wall of basalt from horizon to horizon, one stage at a time.',
    body: 'The Grand Tour follows the uKhahlamba-Drakensberg, a UNESCO World Heritage Site, from the Amphitheatre in the north to Garden Castle in the south. Drive it yourself, or join a day tour at any stage. Many collect you from your hotel, so you can explore the Southern Berg while staying in Champagne Valley.',
  },
  stages: GRAND_TOUR_STAGES,
  howItWorks: {
    kicker: 'How booking works',
    heading: 'From your hotel to the escarpment',
    steps: [
      { title: 'Choose a departure', text: 'Pick a day tour, a date and the hotel you’re staying at. Seats are held while you check out.' },
      { title: 'Get your tickets', text: 'Once payment clears, every seat gets its own QR ticket in My Tickets and in your receipt email.' },
      { title: 'Scan and board', text: 'Be at reception for your pickup time. Your guide scans each ticket before the bus leaves.' },
    ],
    supplierLine: 'Run day tours in the Drakensberg? List with Visit Drakensberg and we’ll feature them on the Grand Tour.',
    supplierCta: 'List your day tour',
  },
}

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

/** URL-safe id: lower-case letters, digits and dashes, as vd_grand_tour_features.stage_id requires. */
export function contentId(text: string): string {
  const base = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item'
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

function normaliseHighlight(raw: unknown): GrandTourHighlight | null {
  const h = raw as Partial<GrandTourHighlight> | null
  // A highlight with no name is an unfinished row in the editor, not content.
  if (!h || typeof h.id !== 'string' || !h.id || !str(h.name, '').trim()) return null
  return { id: h.id, name: str(h.name, ''), blurb: str(h.blurb, ''), ...(h.fact ? { fact: str(h.fact, '') } : {}) }
}

function normaliseStage(raw: unknown, index: number): GrandTourStage | null {
  const s = raw as Partial<GrandTourStage> | null
  if (!s || typeof s.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(s.id)) return null
  return {
    id: s.id,
    number: index + 1, // always the stage's position, so reordering renumbers
    area: str(s.area, ''),
    regionSlug: str(s.regionSlug, ''),
    name: str(s.name, ''),
    kicker: str(s.kicker, ''),
    intro: str(s.intro, ''),
    image: str(s.image, ''),
    ...(s.legFromPrevious ? { legFromPrevious: str(s.legFromPrevious, '') } : {}),
    highlights: Array.isArray(s.highlights) ? s.highlights.map(normaliseHighlight).filter((h): h is GrandTourHighlight => !!h) : [],
  }
}

/** Stored JSON merged over the defaults, with stages validated and renumbered. */
export function normaliseGrandTourContent(raw: unknown): GrandTourContent {
  const d = DEFAULT_GRAND_TOUR_CONTENT
  const r = (raw ?? {}) as Partial<GrandTourContent>
  const stages = Array.isArray(r.stages)
    ? r.stages.map(normaliseStage).filter((s): s is GrandTourStage => !!s).map((s, i) => ({ ...s, number: i + 1 }))
    : d.stages
  const steps = Array.isArray(r.howItWorks?.steps)
    ? r.howItWorks!.steps.map((st, i) => ({ title: str(st?.title, d.howItWorks.steps[i]?.title ?? ''), text: str(st?.text, d.howItWorks.steps[i]?.text ?? '') }))
    : d.howItWorks.steps
  return {
    hero: { ...d.hero, ...(r.hero ?? {}) },
    intro: { ...d.intro, ...(r.intro ?? {}) },
    stages: stages.length > 0 ? stages : d.stages,
    howItWorks: { ...d.howItWorks, ...(r.howItWorks ?? {}), steps },
  }
}

/** The live content, or the defaults when nothing is saved or the read fails. */
export async function getGrandTourContent(client: SupabaseClient = supabase): Promise<GrandTourContent> {
  try {
    const { data } = await client.from('site_content').select('value').eq('key', GRAND_TOUR_CONTENT_KEY).maybeSingle()
    return normaliseGrandTourContent(data?.value)
  } catch {
    return DEFAULT_GRAND_TOUR_CONTENT
  }
}

/** Admin only — site_content's write policy refuses anyone else. */
export async function saveGrandTourContent(content: GrandTourContent): Promise<void> {
  const value = normaliseGrandTourContent(content)
  const { error } = await supabase.from('site_content').upsert(
    { key: GRAND_TOUR_CONTENT_KEY, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw new Error(error.message || 'Could not save the Grand Tour page.')
}
