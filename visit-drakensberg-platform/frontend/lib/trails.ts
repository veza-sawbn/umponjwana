import { supabase } from './auth'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { GpxAnalysis, TrailCrux, TrailGrade, TrailWaypoint } from './gpx'
import type { GraphFields } from './graph-fields'
import type { Season, SeasonTopic } from './seasons'

export type TrailDay = {
  label: string
  distance: string
  elevation: string
  difficulty: 'Easy' | 'Moderate' | 'Strenuous' | 'Extreme'
  notes?: string
}

// Day hikes and multi-day hikes are grouped by duration; speciality walks are
// grouped by theme instead (heritage, birding, star gazing, …) regardless of
// how long they take, so they get their own category rather than being
// inferred from `is_multi_day`.
export type TrailCategory = 'day_hike' | 'multi_day_hike' | 'speciality_walk'

export const SPECIALITY_WALK_TYPES = [
  'Heritage Walk', 'Birding Walk', 'Star Gazing', 'Cultural Walk', 'Photography Walk', 'Wildflower Walk',
] as const

export type Trail = {
  id: string
  name: string
  region: string
  /** Nature reserve this trail falls within (Reserve.id, lib/reserves.ts). Empty/absent = unassigned. */
  reserveId?: string
  difficulty: 'Easy' | 'Moderate' | 'Strenuous' | 'Extreme'
  distance: string
  duration: string
  elevation: string
  status: 'published' | 'draft'
  featured: boolean
  image: string
  gallery: string[]
  description: string
  trailhead: string
  permit_required: boolean
  permit_cost: number
  what_to_bring: string[]
  highlights?: string[]
  is_multi_day: boolean
  days: TrailDay[]
  // Falls back to `is_multi_day` via trailCategory() for trails saved before
  // this field existed — see trailCategory().
  category?: TrailCategory
  // Only meaningful when category is 'speciality_walk'.
  speciality_type?: string
  park?: string
  visibility?: 'public' | 'private'
  trail_type?: string
  distance_override_km?: number
  gpx?: { fileName?: string; uploadedAt?: string; raw?: string; metadata?: GpxAnalysis['metadata'] }
  analytics?: GpxAnalysis
  manual_overrides?: Partial<Record<keyof GpxAnalysis['statistics'] | 'difficulty' | 'duration' | 'distance' | 'elevation', string | number>>
  automatic_grade?: TrailGrade
  manual_grade?: TrailGrade
  grade_override_reason?: string
  admin_notes?: string
  cruxes?: TrailCrux[]
  waypoints?: TrailWaypoint[]
  generated_at?: string
  /** Which seasons this trail suits — powers the region "When to Go"
   *  module and /regions/[slug]/[season] pages. See lib/seasons.ts. */
  seasons?: Season[]
  /** Which season-page topic groups ("By Water", "In the Mountains", …)
   *  this trail should appear under. See lib/seasons.ts. */
  topics?: SeasonTopic[]
} & GraphFields

export const DEFAULT_TRAILS: Trail[] = [
  {
    id: 'tugela-falls',
    name: 'Tugela Falls Circuit',
    region: 'Royal Natal National Park',
    difficulty: 'Strenuous',
    distance: '14 km',
    duration: '6–8 hours',
    elevation: '+1200m',
    status: 'published',
    featured: true,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
      'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    ],
    description: 'One of the most dramatic hikes in Africa, the Tugela Falls Circuit climbs from the Mahai campsite in Royal Natal National Park to the base and top of the Tugela Falls — the second highest waterfall in the world at 948m. The route ascends the iconic chain ladder to reach the Amphitheatre plateau, with panoramic views across the full Berg escarpment and into Lesotho.',
    trailhead: 'Sentinel Car Park, Royal Natal National Park',
    permit_required: true,
    permit_cost: 80,
    what_to_bring: ['Layers (summit wind is significant)', '3L water minimum', 'Snacks and lunch', 'Hiking poles', 'Rain jacket', 'Headlamp for early starts', 'Park entry permit'],
    highlights: ['Chain ladder ascent to the Amphitheatre plateau', 'Tugela Falls — the second highest waterfall in the world', 'Panoramic views across the escarpment into Lesotho'],
    trail_type: 'Out and back',
    is_multi_day: false,
    days: [],
  },
  {
    id: 'amphitheatre',
    name: 'Amphitheatre via Chain Ladder',
    region: 'Royal Natal National Park',
    difficulty: 'Moderate',
    distance: '8 km',
    duration: '4–5 hours',
    elevation: '+780m',
    status: 'published',
    featured: true,
    image: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=800&q=80',
    gallery: [],
    description: 'The classic Drakensberg hike. The chain ladder ascent to the Amphitheatre plateau is a rite of passage for visitors to the Northern Drakensberg. From the top, the views across the escarpment are unmatched anywhere in southern Africa.',
    trailhead: 'Tendele Camp',
    permit_required: false,
    permit_cost: 0,
    what_to_bring: ['2L water', 'Snacks', 'Sun protection', 'Light jacket'],
    highlights: ['The iconic chain ladders', 'Views over the Amphitheatre wall', 'Escarpment-edge lookout points'],
    trail_type: 'Out and back',
    is_multi_day: false,
    days: [],
  },
  {
    id: 'cathedral-peak',
    name: 'Cathedral Peak Summit',
    region: 'Northern Drakensberg',
    difficulty: 'Strenuous',
    distance: '16 km',
    duration: '8 hours',
    elevation: '+1500m',
    status: 'published',
    featured: false,
    image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80',
    gallery: [],
    description: 'The iconic pyramid summit of Cathedral Peak rewards fit hikers with 360-degree views across both the escarpment and the foothills. The route requires route-finding skills on the upper section — a guide is highly recommended.',
    trailhead: 'Cathedral Peak Hotel Trailhead',
    permit_required: false,
    permit_cost: 0,
    what_to_bring: ['3L water', 'Full lunch', 'Emergency shelter', 'Navigation tools', 'Crampons in winter'],
    is_multi_day: false,
    days: [],
  },
  {
    id: 'giants-castle',
    name: "Giant's Castle via Meander",
    region: 'Central Drakensberg',
    difficulty: 'Moderate',
    distance: '18 km',
    duration: '7–9 hours',
    elevation: '+985m',
    status: 'published',
    featured: false,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    gallery: [],
    description: 'A traverse past the famous lammergeier hide and San rock art sites. The route winds through high altitude grassland with sweeping views of the escarpment.',
    trailhead: "Giant's Castle Rest Camp",
    permit_required: true,
    permit_cost: 100,
    what_to_bring: ['3L water', 'Warm layers', 'Lunch', 'Binoculars for lammergeier'],
    is_multi_day: false,
    days: [],
  },
  {
    id: 'grand-traverse',
    name: 'Drakensberg Grand Traverse',
    region: 'Central Drakensberg',
    difficulty: 'Strenuous',
    distance: '210 km',
    duration: '14–18 days',
    elevation: '+16000m total',
    status: 'published',
    featured: true,
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
    gallery: [],
    description: "The holy grail of South African hiking — a continuous traverse of the entire Drakensberg escarpment from Sentinel Peak in the north to Bushman's Nek in the south. A serious multi-day expedition requiring full wilderness self-sufficiency.",
    trailhead: 'Sentinel Car Park, Royal Natal',
    permit_required: true,
    permit_cost: 200,
    what_to_bring: ['Full camping kit', 'Navigation map & compass', '4L water capacity', 'Emergency beacon', 'Bear canister for food', 'All meals self-catered'],
    trail_type: 'Point to point',
    is_multi_day: true,
    days: [
      { label: 'Day 1: Sentinel to Ifidi Pass', distance: '15 km', elevation: '+900m', difficulty: 'Strenuous', notes: 'Ascend via Chain Ladder, camp on the plateau.' },
      { label: 'Day 2: Ifidi to Mlambonja Buttress', distance: '18 km', elevation: '+600m', difficulty: 'Moderate', notes: 'Long plateau traverse, stunning views into Lesotho.' },
      { label: 'Day 3: Mlambonja to Cathedral Ridge', distance: '12 km', elevation: '+750m', difficulty: 'Strenuous', notes: 'Technical scrambling required on Cathedral ridge section.' },
      { label: 'Day 4: Rest Day at Twins Cave', distance: '0 km', elevation: '0m', difficulty: 'Easy', notes: 'Cave shelter. Explore nearby San rock art panels.' },
      { label: 'Day 5: Cathedral to Ndedema Gorge', distance: '20 km', elevation: '+400m', difficulty: 'Moderate', notes: 'Descend into the gorge — highest concentration of San art in the Berg.' },
    ],
  },
  {
    id: 'fairy-glen',
    name: 'Fairy Glen Waterfall Walk',
    region: 'Central Drakensberg',
    difficulty: 'Easy',
    distance: '5 km',
    duration: '2 hours',
    elevation: '+240m',
    status: 'published',
    featured: false,
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
    gallery: [],
    description: 'A gentle introductory walk through indigenous forest and fynbos to a beautiful waterfall pool. Ideal for families with children and visitors new to the Berg.',
    trailhead: 'Champagne Castle Hotel',
    permit_required: false,
    permit_cost: 0,
    what_to_bring: ['1.5L water', 'Comfortable shoes', 'Swimwear in summer'],
    is_multi_day: false,
    days: [],
  },
]

/** A trail's category, defaulting older trails without one to day/multi-day by duration. */
export function trailCategory(trail: Trail): TrailCategory {
  return trail.category ?? (trail.is_multi_day ? 'multi_day_hike' : 'day_hike')
}

/** Starting point of a trail: the GPX Start waypoint if present, otherwise the first track point. */
export function trailStartPoint(trail: Trail): { lat: number; lng: number } | null {
  const start = (trail.waypoints ?? trail.analytics?.waypoints)?.find(w => w.category === 'Start')
  if (start && Number.isFinite(start.lat) && Number.isFinite(start.lon)) return { lat: start.lat, lng: start.lon }
  const p = trail.analytics?.points?.[0]
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { lat: p.lat, lng: p.lon } : null
}

// Accepts an optional Supabase client so Server Components can pass a
// session-less client (lib/supabase-public.ts) — see lib/regions.ts's
// getRegions() for the same pattern. Existing callers are unaffected.
export async function getTrails(client: SupabaseClient = supabase): Promise<Trail[]> {
  try {
    const { data } = await client
      .from('site_content')
      .select('value')
      .eq('key', 'trails')
      .maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) {
      return data.value.items as Trail[]
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_TRAILS
}

export async function saveTrails(trails: Trail[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'trails', value: { items: trails }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}
