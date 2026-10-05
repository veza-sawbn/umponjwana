// Personalisation for campaign email — the merge-tag engine.
//
// A template's subject, preheader and body may carry tags such as
// {{first_name}} or {{favourite_destination|the berg}}. renderMergeTags()
// fills them from one recipient's CRM record plus the campaign's own details
// (offer, deadline, promo code… — see vd_email_campaigns.merge_values), so the
// admin builder's live preview shows the email exactly as that person would
// read it, and a future ESP send renders each recipient through the same
// function rather than a second copy of the rules.
//
// Client-safe on purpose: no Node API, no Supabase import. The campaign
// builder is a client component and renders the personalised preview itself
// before handing the result to app/api/admin/campaigns/preview for the shell.
//
// Values are HTML-escaped when rendering the body. They come from customer
// profiles (a customer chooses their own name) and from admin-typed campaign
// fields, and neither should be able to inject markup into an email that
// goes to someone else.

export type MergeContact = {
  id: string
  fullName: string
  email: string
  country: string | null
  city: string | null
  lifecycleStage: string
  interests: string[]
  favouriteDestinations: string[]
  favouriteActivities: string[]
  tripCount: number
  upcomingTravel: string | null
}

export type MergeTagDef = {
  key: string
  label: string
  /** Shown beside the tag in the builder, and used when no contact is picked. */
  sample: string
}

/** Every tag the engine fills from a recipient's record. */
export const CONTACT_MERGE_TAGS: MergeTagDef[] = [
  { key: 'first_name', label: 'First name', sample: 'Thandi' },
  { key: 'last_name', label: 'Last name', sample: 'Dlamini' },
  { key: 'full_name', label: 'Full name', sample: 'Thandi Dlamini' },
  { key: 'email', label: 'Email address', sample: 'thandi@example.com' },
  { key: 'city', label: 'City / province', sample: 'Durban' },
  { key: 'country', label: 'Country', sample: 'South Africa' },
  { key: 'favourite_destination', label: 'Favourite destination', sample: 'Royal Natal' },
  { key: 'favourite_activity', label: 'Favourite activity', sample: 'Hiking' },
  { key: 'interests', label: 'Interests', sample: 'hiking, birding' },
  { key: 'trip_count', label: 'Trips booked', sample: '2' },
  { key: 'upcoming_travel', label: 'Next trip date', sample: '14 July 2027' },
  { key: 'lifecycle_stage', label: 'Lifecycle stage', sample: 'returning customer' },
]

const CONTACT_KEYS = new Set(CONTACT_MERGE_TAGS.map(t => t.key))

/** Campaign-level field keys: lowercase snake_case, and never shadowing a contact tag. */
export const CAMPAIGN_FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/

export function campaignFieldKeyError(key: string): string | null {
  if (!CAMPAIGN_FIELD_KEY.test(key)) return 'Use lowercase letters, numbers and underscores, starting with a letter.'
  if (CONTACT_KEYS.has(key)) return `"${key}" is already filled from each contact's profile.`
  return null
}

/** Turns "offer name" or "Promo-Code" into a usable key: offer_name, promo_code. */
export function toCampaignFieldKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[0-9_]+/, '').slice(0, 40)
}

// {{ key }} or {{ key | fallback }}. The fallback may not contain braces.
const TAG = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|\s*([^{}]*?)\s*)?\}\}/g

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** The flat key → value map a single recipient renders against. */
export function buildMergeValues(
  contact: MergeContact | null,
  campaignFields: Record<string, string> = {},
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [k, v] of Object.entries(campaignFields)) {
    if (CAMPAIGN_FIELD_KEY.test(k) && !CONTACT_KEYS.has(k)) values[k] = v ?? ''
  }
  if (!contact) {
    for (const t of CONTACT_MERGE_TAGS) values[t.key] = t.sample
    return values
  }
  // fullName falls back to the email address upstream when a profile has no
  // name; a greeting of "Hi thandi@example.com" is worse than the fallback.
  const name = contact.fullName.includes('@') ? '' : contact.fullName.trim()
  const parts = name.split(/\s+/).filter(Boolean)
  values.first_name = parts[0] ?? ''
  values.last_name = parts.length > 1 ? parts.slice(1).join(' ') : ''
  values.full_name = name
  values.email = contact.email
  values.city = contact.city ?? ''
  values.country = contact.country ?? ''
  values.favourite_destination = contact.favouriteDestinations[0] ?? ''
  values.favourite_activity = contact.favouriteActivities[0] ?? ''
  values.interests = contact.interests.join(', ')
  values.trip_count = String(contact.tripCount)
  values.upcoming_travel = contact.upcomingTravel ? formatDate(contact.upcomingTravel) : ''
  values.lifecycle_stage = contact.lifecycleStage.replace(/_/g, ' ')
  return values
}

/**
 * Fills every {{tag}} in `text`. A tag whose value is empty uses its inline
 * fallback ({{first_name|there}}), else renders as nothing. A tag the engine
 * doesn't know is left in place verbatim so the preview shows it as a to-do
 * rather than silently swallowing a typo.
 */
export function renderMergeTags(
  text: string,
  values: Record<string, string>,
  opts: { html: boolean },
): string {
  return text.replace(TAG, (whole, rawKey: string, fallback: string | undefined) => {
    const key = rawKey.toLowerCase()
    if (!(key in values)) return whole
    const value = values[key]?.trim() ? values[key] : (fallback ?? '')
    return opts.html ? escapeHtml(value) : value
  })
}

export type MergeTagIssue = { key: string; kind: 'unknown' | 'empty' }

/**
 * What the builder warns about for one recipient: tags nothing fills
 * ("unknown" — a typo, or a campaign field not yet added) and tags that
 * render blank for this person because they have no value and no fallback.
 */
export function findMergeTagIssues(texts: string[], values: Record<string, string>): MergeTagIssue[] {
  const issues = new Map<string, MergeTagIssue>()
  for (const text of texts) {
    for (const m of text.matchAll(TAG)) {
      const key = m[1].toLowerCase()
      const hasFallback = m[2] !== undefined && m[2].trim() !== ''
      if (!(key in values)) issues.set(key, { key, kind: 'unknown' })
      else if (!values[key]?.trim() && !hasFallback && !issues.has(key)) issues.set(key, { key, kind: 'empty' })
    }
  }
  return Array.from(issues.values())
}

/** Distinct tag keys used anywhere in the given texts, in first-seen order. */
export function usedMergeTags(texts: string[]): string[] {
  const seen = new Set<string>()
  for (const text of texts) for (const m of text.matchAll(TAG)) seen.add(m[1].toLowerCase())
  return Array.from(seen)
}
