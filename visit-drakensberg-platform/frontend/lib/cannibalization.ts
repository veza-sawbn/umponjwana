/**
 * Cannibalisation Detector — data layer (Tool 8)
 *
 * Detects pairs of entities that compete for the same search intent by
 * comparing their SEO-relevant text fields with Jaccard token similarity.
 *
 * Also surfaces topic-map conflicts (same topic phrase, different canonical
 * entity) from Tool 9 (lib/topic-map.ts).
 *
 * Runs entirely client-side: no DB round-trips, no new tables.
 */

import type { TopicEntry } from './topic-map'

// ── Stopwords ─────────────────────────────────────────────────────────────────

/**
 * Generic English stopwords + domain-specific noise words that appear in
 * nearly every Drakensberg entity and contribute nothing to identity.
 */
const STOPWORDS = new Set([
  // English function words
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'did',
  'use', 'way', 'she', 'from', 'they', 'that', 'this', 'with', 'have',
  'will', 'your', 'more', 'been', 'when', 'then', 'than', 'into', 'some',
  'also', 'just', 'over', 'such', 'only', 'both', 'here', 'there', 'what',
  'very', 'even', 'most', 'give', 'each', 'make', 'like', 'know', 'take',
  'much', 'many', 'time', 'other', 'about', 'after', 'these', 'those',
  'their', 'would', 'could', 'which', 'while', 'where', 'being', 'would',
  'during', 'before', 'within', 'through', 'should', 'whether',
  // Domain-specific noise
  'drakensberg', 'visit', 'berg', 'kwazulunatal', 'kwazulu', 'natal', 'south',
  'africa', 'african', 'mountain', 'mountains',
])

// ── Tokeniser ─────────────────────────────────────────────────────────────────

/**
 * Tokenise text into a set of meaningful stems.
 * - Lower-case
 * - Strip punctuation / numerals
 * - Remove tokens shorter than 3 characters
 * - Remove stopwords
 */
export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t))
  return new Set(tokens)
}

// ── Jaccard similarity ────────────────────────────────────────────────────────

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 * Returns 0 when both sets are empty.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  const intersection = new Set([...a].filter(t => b.has(t)))
  const union = new Set([...a, ...b])
  return intersection.size / union.size
}

/**
 * Shared tokens between two sets (the intersection, ordered for display).
 */
export function sharedTokens(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter(t => b.has(t)).sort()
}

// ── Entity input type ─────────────────────────────────────────────────────────

export type OverlapEntity = {
  id: string
  kind: 'trail' | 'property' | 'activity' | 'region'
  kindLabel: string
  name: string
  /** Concatenated SEO text: title + description + region + tags */
  seoText: string
  /** Canonical public URL path */
  path: string
  /** SEO health score 0–100 */
  score: number
  /** Edit path inside admin console */
  editPath: string
}

// ── Overlap pair ──────────────────────────────────────────────────────────────

export type OverlapConfidenceLevel = 'high' | 'medium' | 'low'

export type OverlapPair = {
  /** Stable synthetic key: sorted by id */
  pairKey: string
  entityA: OverlapEntity
  entityB: OverlapEntity
  /** Jaccard similarity 0–1 */
  confidence: number
  confidenceLevel: OverlapConfidenceLevel
  /** Tokens the two entities share */
  sharedTerms: string[]
  /** Source of the signal */
  source: 'text-similarity' | 'topic-conflict'
  /** Topic phrase, only when source === 'topic-conflict' */
  topic?: string
}

function classifyConfidence(score: number): OverlapConfidenceLevel {
  if (score >= 0.5) return 'high'
  if (score >= 0.35) return 'medium'
  return 'low'
}

// ── Detector ─────────────────────────────────────────────────────────────────

/**
 * Compute pairwise Jaccard overlap for all indexable entities.
 *
 * O(N²) in the number of entities. Drakensberg has < 500 entities total,
 * so this comfortably runs in < 10 ms client-side.
 *
 * @param entities   All indexable entities with seoText populated
 * @param threshold  Minimum Jaccard score to include (default 0.30)
 */
export function detectOverlaps(
  entities: OverlapEntity[],
  threshold = 0.30,
): OverlapPair[] {
  const tokenSets = entities.map(e => tokenize(e.seoText))
  const pairs: OverlapPair[] = []

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const confidence = jaccardSimilarity(tokenSets[i], tokenSets[j])
      if (confidence < threshold) continue

      const eA = entities[i]
      const eB = entities[j]
      const pairKey = [eA.id, eB.id].sort().join('|')

      pairs.push({
        pairKey,
        entityA: eA,
        entityB: eB,
        confidence,
        confidenceLevel: classifyConfidence(confidence),
        sharedTerms: sharedTokens(tokenSets[i], tokenSets[j]),
        source: 'text-similarity',
      })
    }
  }

  return pairs.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Convert topic-map conflicts (same topic phrase owned by multiple canonical
 * entities) into OverlapPairs so they surface in the same UI.
 *
 * Topic-map conflicts always get confidence = 1.0 because they are an explicit
 * admin-declared collision, not an inferred one.
 */
export function overlapsFromTopicConflicts(
  conflicts: Array<{ topic: string; entries: TopicEntry[] }>,
  entityLookup: Map<string, OverlapEntity>,
): OverlapPair[] {
  const pairs: OverlapPair[] = []

  for (const { topic, entries } of conflicts) {
    // Each conflict can involve > 2 entries; emit a pair for every unique combination.
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const eA = entityLookup.get(entries[i].canonicalEntity.id)
        const eB = entityLookup.get(entries[j].canonicalEntity.id)
        if (!eA || !eB) continue

        const pairKey = [eA.id, eB.id].sort().join('|')
        pairs.push({
          pairKey,
          entityA: eA,
          entityB: eB,
          confidence: 1.0,
          confidenceLevel: 'high',
          sharedTerms: [topic],
          source: 'topic-conflict',
          topic,
        })
      }
    }
  }

  return pairs
}

/**
 * Merge text-similarity pairs and topic-conflict pairs, de-duplicating by
 * pairKey. Topic conflicts take precedence (they are authoritative signals).
 */
export function mergeOverlapPairs(
  textPairs: OverlapPair[],
  topicPairs: OverlapPair[],
): OverlapPair[] {
  const seen = new Map<string, OverlapPair>()
  for (const p of topicPairs) seen.set(p.pairKey, p)
  for (const p of textPairs) {
    if (!seen.has(p.pairKey)) seen.set(p.pairKey, p)
  }
  return [...seen.values()].sort((a, b) => b.confidence - a.confidence)
}

// ── Dismissal storage key ─────────────────────────────────────────────────────

export const DISMISSED_PAIRS_KEY = 'seo_dismissed_overlap_pairs'

export function getDismissedPairKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_PAIRS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function dismissPairKey(key: string): void {
  try {
    const current = getDismissedPairKeys()
    current.add(key)
    localStorage.setItem(DISMISSED_PAIRS_KEY, JSON.stringify([...current]))
  } catch {}
}

export function undismissPairKey(key: string): void {
  try {
    const current = getDismissedPairKeys()
    current.delete(key)
    localStorage.setItem(DISMISSED_PAIRS_KEY, JSON.stringify([...current]))
  } catch {}
}
