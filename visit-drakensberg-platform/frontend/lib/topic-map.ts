/**
 * Topic Map — data layer (Tool 9)
 *
 * Stored at site_content key `admin_topic_map`:
 *   { items: TopicEntry[] }
 *
 * One canonical entity per topic, zero or more supporting entities.
 * Feeds Tool 8 (cannibalisation detector): a second entity claiming a
 * mapped topic is flagged as a potential conflict.
 */

import { supabase } from './auth'

const SITE_CONTENT_KEY = 'admin_topic_map'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TopicEntityKind = 'trail' | 'property' | 'activity' | 'region'

export type TopicEntityRef = {
  kind: TopicEntityKind
  id: string
  /** Display label — denormalised at write time; refreshed on read */
  label: string
  /** Canonical path, e.g. /hikes/tugela-falls or /regions/north-berg */
  path: string
}

export type TopicEntry = {
  id: string
  topic: string              // the search phrase, e.g. "tugela falls"
  canonicalEntity: TopicEntityRef
  supportingEntities: TopicEntityRef[]
  notes: string
  createdAt: string
  updatedAt: string
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function getTopicMap(): Promise<TopicEntry[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', SITE_CONTENT_KEY)
      .maybeSingle()
    if (Array.isArray(data?.value?.items)) return data.value.items as TopicEntry[]
  } catch {}
  return []
}

async function saveTopicMap(items: TopicEntry[]): Promise<void> {
  const { error } = await supabase
    .from('site_content')
    .upsert(
      { key: SITE_CONTENT_KEY, value: { items }, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  if (error) throw error
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function addTopicEntry(params: Omit<TopicEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<TopicEntry> {
  const existing = await getTopicMap()
  const now = new Date().toISOString()
  const entry: TopicEntry = {
    ...params,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  await saveTopicMap([...existing, entry])
  return entry
}

export async function updateTopicEntry(
  id: string,
  params: Omit<TopicEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TopicEntry> {
  const existing = await getTopicMap()
  const current = existing.find(e => e.id === id)
  if (!current) throw new Error(`Topic entry ${id} not found`)
  const updated: TopicEntry = {
    ...current,
    ...params,
    id,
    updatedAt: new Date().toISOString(),
  }
  await saveTopicMap(existing.map(e => (e.id === id ? updated : e)))
  return updated
}

export async function deleteTopicEntry(id: string): Promise<void> {
  const existing = await getTopicMap()
  await saveTopicMap(existing.filter(e => e.id !== id))
}

/**
 * Given an entity id, return all topic entries where it appears
 * (as canonical or supporting). Used by Tool 8 to find conflicts.
 */
export function entriesForEntity(id: string, entries: TopicEntry[]): TopicEntry[] {
  return entries.filter(
    e =>
      e.canonicalEntity.id === id ||
      e.supportingEntities.some(s => s.id === id),
  )
}

/**
 * Detect topic entries where more than one entity competes for the
 * same canonical slot (same topic string, different canonical entity).
 * Returns pairs of conflicting entries.
 */
export function detectTopicConflicts(
  entries: TopicEntry[],
): Array<{ topic: string; entries: TopicEntry[] }> {
  const byTopic = new Map<string, TopicEntry[]>()
  for (const entry of entries) {
    const key = entry.topic.toLowerCase().trim()
    byTopic.set(key, [...(byTopic.get(key) ?? []), entry])
  }
  const conflicts: Array<{ topic: string; entries: TopicEntry[] }> = []
  for (const [topic, group] of byTopic) {
    if (group.length > 1) conflicts.push({ topic, entries: group })
  }
  return conflicts
}
