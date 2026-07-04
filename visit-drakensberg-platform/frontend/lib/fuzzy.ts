// Lightweight fuzzy text matching for search: tolerates typos (edit
// distance scaled to word length) and partial matches, no dependencies.

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = curr
  }
  return prev[b.length]
}

function maxEdits(len: number): number {
  if (len <= 3) return 0
  if (len <= 5) return 1
  return 2
}

/**
 * Score how well `query` matches `text`. 0 = no match; higher = better.
 * Every query token must match somewhere in the text (as a prefix,
 * substring, or within typo distance of a word).
 */
export function fuzzyScore(query: string, text: string): number {
  const q = normalize(query).trim()
  if (!q) return 1
  const t = normalize(text)
  if (t.includes(q)) return 100 // exact phrase
  const qTokens = q.split(/\s+/)
  const tWords = t.split(/\s+/).filter(Boolean)
  let score = 0
  for (const token of qTokens) {
    let best = 0
    for (const word of tWords) {
      if (word === token) { best = 10; break }
      if (word.startsWith(token)) { best = Math.max(best, 8); continue }
      if (word.includes(token)) { best = Math.max(best, 6); continue }
      const dist = levenshtein(token, word)
      if (dist <= maxEdits(token.length)) best = Math.max(best, 5 - dist)
    }
    if (best === 0) return 0 // every token must match something
    score += best
  }
  return score
}

/** Filter + rank a list by fuzzy match across the given text fields. */
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  const q = query.trim()
  if (!q) return items
  return items
    .map(item => ({ item, score: fuzzyScore(q, getText(item)) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item)
}
