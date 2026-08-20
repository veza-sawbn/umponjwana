/**
 * Internal Link Suggestions — data layer (Tool 3)
 *
 * Given a source entity, returns other entities that would make good
 * internal link targets, ranked by relevance.
 *
 * Three signal sources (combined into a single relevance score):
 *   1. Same region — structural proximity
 *   2. Fuzzy name match — catches "Cathedral Peak" → "Cathedral Peak Trail"
 *   3. Topic overlap — shared focusTopic or tokenised seoTitle terms
 *
 * Runs entirely client-side. No new DB tables.
 */

import { fuzzyScore } from './fuzzy'
import { tokenize } from './cannibalization'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SuggestionEntity = {
  id: string
  kind: 'trail' | 'property' | 'activity' | 'region'
  kindLabel: string
  name: string
  slug: string | undefined | null
  region: string | undefined | null
  status: string
  seoTitle: string | undefined | null
  seoDescription: string | undefined | null
  focusTopic: string | undefined | null
  path: string
  editPath: string
}

export type SuggestionSignal = 'same-region' | 'name-match' | 'topic-overlap'

export type LinkSuggestion = {
  entity: SuggestionEntity
  /** 0–1, combined from the three signals */
  relevance: number
  /** Signals that contributed to the score */
  signals: SuggestionSignal[]
  /** Human-readable reason for the suggestion */
  reason: string
}

// ── Scorer ────────────────────────────────────────────────────────────────────

/**
 * Normalise region names for comparison:
 * "North Berg" and "Northern Drakensberg" both map to "north".
 */
function regionKey(r: string | undefined | null): string {
  if (!r) return ''
  return r.toLowerCase().replace(/[^a-z]/g, ' ').trim().split(/\s+/)[0] ?? ''
}

function topicOverlap(a: SuggestionEntity, b: SuggestionEntity): number {
  const aText = [a.name, a.seoTitle, a.focusTopic].filter(Boolean).join(' ')
  const bText = [b.name, b.seoTitle, b.focusTopic].filter(Boolean).join(' ')
  const aTok = tokenize(aText)
  const bTok = tokenize(bText)
  if (aTok.size === 0 || bTok.size === 0) return 0
  const shared = [...aTok].filter(t => bTok.has(t)).length
  return shared / Math.max(aTok.size, bTok.size)
}

/**
 * Score a single candidate against the source entity.
 * Returns null if it doesn't clear the minimum threshold on any signal.
 */
function score(
  source: SuggestionEntity,
  candidate: SuggestionEntity,
  minRelevance = 0.10,
): LinkSuggestion | null {
  if (candidate.id === source.id) return null

  const signals: SuggestionSignal[] = []
  const reasons: string[] = []
  let relevance = 0

  // Signal 1: same region (0.35 weight)
  const sameRegion =
    regionKey(source.region) !== '' &&
    regionKey(source.region) === regionKey(candidate.region)
  if (sameRegion) {
    signals.push('same-region')
    reasons.push(`both in ${candidate.region}`)
    relevance += 0.35
  }

  // Signal 2: fuzzy name match (0.40 weight)
  const nameScore = Math.max(
    fuzzyScore(source.name, candidate.name),
    fuzzyScore(candidate.name, source.name),
  )
  if (nameScore > 0.3) {
    signals.push('name-match')
    reasons.push('name similarity')
    relevance += nameScore * 0.40
  }

  // Signal 3: topic / keyword overlap (0.40 weight)
  const topicScore = topicOverlap(source, candidate)
  if (topicScore > 0.15) {
    signals.push('topic-overlap')
    reasons.push('shared keywords')
    relevance += topicScore * 0.40
  }

  if (relevance < minRelevance || signals.length === 0) return null

  // Clamp to 1.0 and remove duplicate signal labels
  const uniqueSignals = [...new Set(signals)]
  return {
    entity: candidate,
    relevance: Math.min(relevance, 1.0),
    signals: uniqueSignals,
    reason: reasons.filter((v, i, a) => a.indexOf(v) === i).join(' · '),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate ranked internal link suggestions for a source entity.
 *
 * @param source      The entity being edited
 * @param candidates  All other entities (different kinds welcome)
 * @param limit       Maximum suggestions to return (default 20)
 */
export function getSuggestedLinks(
  source: SuggestionEntity,
  candidates: SuggestionEntity[],
  limit = 20,
): LinkSuggestion[] {
  const results: LinkSuggestion[] = []

  for (const candidate of candidates) {
    // Skip self and entities of the same kind unless they have a region match
    // (same-kind suggestions can still be valid: "also consider this trail")
    const s = score(source, candidate)
    if (s) results.push(s)
  }

  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
}

// ── Dismissal ─────────────────────────────────────────────────────────────────

const DISMISSED_KEY = 'seo_dismissed_link_suggestions'

type DismissedMap = Record<string, string[]> // sourceId → [candidateId, ...]

function loadDismissed(): DismissedMap {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function getDismissedForSource(sourceId: string): Set<string> {
  return new Set(loadDismissed()[sourceId] ?? [])
}

export function dismissSuggestion(sourceId: string, candidateId: string): void {
  try {
    const map = loadDismissed()
    map[sourceId] = [...new Set([...(map[sourceId] ?? []), candidateId])]
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map))
  } catch {}
}

export function restoreSuggestion(sourceId: string, candidateId: string): void {
  try {
    const map = loadDismissed()
    map[sourceId] = (map[sourceId] ?? []).filter(id => id !== candidateId)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map))
  } catch {}
}
