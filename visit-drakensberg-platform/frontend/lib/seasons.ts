// Season + topic vocabulary for the "When to Go" region module and its
// linked /regions/[slug]/[season] pages — see docs/destination-graph/PHASE_I.md.
//
// Both are additive facets on Trail and Activity (`seasons`/`topics`
// fields), not new entities — same principle used throughout the
// destination graph work. Topic is a *new*, purpose-built vocabulary
// rather than a reuse of ACTIVITY_CATEGORIES or Trail's own
// TrailCategory/SPECIALITY_WALK_TYPES: those two taxonomies already exist,
// serve different UIs (the /activities filter tabs; hike duration
// grouping), and don't overlap cleanly with each other — Trail has no
// category field compatible with Activity's at all. A season page needs to
// mix both entity kinds under the same heading ("By Water" listing both a
// trail and an activity), which needs one vocabulary both kinds can tag
// into, hence a dedicated `topics` field on each.

export type Season = 'summer' | 'autumn' | 'winter' | 'spring'

export const SEASONS: Season[] = ['summer', 'autumn', 'winter', 'spring']

export const SEASON_META: Record<Season, { label: string; range: string; blurb: string; tint: string }> = {
  // Southern Hemisphere ranges — this is the Drakensberg, South Africa.
  summer: {
    label: 'Summer', range: 'Dec – Feb',
    blurb: 'Green grasslands, full waterfalls, afternoon thunderstorms.',
    tint: '45,90,63', // pine wash
  },
  autumn: {
    label: 'Autumn', range: 'Mar – May',
    blurb: 'Golden grass, clear air, the calmest hiking weather.',
    tint: '138,105,53', // gold/amber wash
  },
  winter: {
    label: 'Winter', range: 'Jun – Aug',
    blurb: 'Crisp, dry, and the clearest views of the year.',
    tint: '52,68,82', // slate wash
  },
  spring: {
    label: 'Spring', range: 'Sep – Nov',
    blurb: 'Wildflowers, mild days, and the birds are back.',
    tint: '74,114,81', // sage wash
  },
}

export type SeasonTopic = 'water' | 'mountains' | 'wildlife' | 'culture' | 'family' | 'adventure'

export const SEASON_TOPICS: SeasonTopic[] = ['water', 'mountains', 'wildlife', 'culture', 'family', 'adventure']

export const SEASON_TOPIC_META: Record<SeasonTopic, { label: string; description: string }> = {
  water: {
    label: 'By Water',
    description: "Experiences built around the region's rivers, waterfalls and pools.",
  },
  mountains: {
    label: 'In the Mountains',
    description: 'High-altitude hikes and outings on the escarpment and peaks.',
  },
  wildlife: {
    label: 'Wildlife & Nature',
    description: 'Birding, game viewing and other wildlife encounters.',
  },
  culture: {
    label: 'Culture & Heritage',
    description: 'Rock art, heritage sites and local history.',
  },
  family: {
    label: 'Family & Leisure',
    description: 'Easier-going experiences suited to visitors of all ages.',
  },
  adventure: {
    label: 'Adventure',
    description: 'Higher-energy activities for visitors chasing an adrenaline hit.',
  },
}

export function isSeason(value: string): value is Season {
  return (SEASONS as string[]).includes(value)
}
