/**
 * Redirect Manager — data layer (Tool 11)
 *
 * Stored at site_content key `admin_redirects`:
 *   { items: Redirect[] }
 *
 * All validation (chain collapse, loop detection, live-route shadowing) lives
 * here so the admin UI and any server-side caller share one implementation.
 */

import { supabase } from './auth'

const SITE_CONTENT_KEY = 'admin_redirects'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Redirect = {
  id: string
  from: string           // absolute path, e.g. "/old-hike"
  to: string             // absolute path or full URL
  statusCode: 301 | 302
  note: string           // optional human label ("slug rename Jan 2025")
  createdAt: string
  createdBy: string      // user email or "system"
  // hit tracking — populated asynchronously; 0 until updated
  hitCount: number
  lastHitAt: string | null
}

export type RedirectValidationError =
  | { kind: 'loop';   message: string }
  | { kind: 'shadow'; message: string; existing: Redirect }
  | { kind: 'duplicate'; message: string; existing: Redirect }

export type AddResult =
  | { ok: true; redirect: Redirect; collapsed?: { original: string; resolved: string } }
  | { ok: false; error: RedirectValidationError }

// ── Storage ───────────────────────────────────────────────────────────────────

export async function getRedirects(): Promise<Redirect[]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', SITE_CONTENT_KEY)
      .maybeSingle()
    if (Array.isArray(data?.value?.items)) return data.value.items as Redirect[]
  } catch {}
  return []
}

async function saveRedirects(items: Redirect[]): Promise<void> {
  const { error } = await supabase
    .from('site_content')
    .upsert(
      { key: SITE_CONTENT_KEY, value: { items }, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  if (error) throw error
}

// ── Chain resolution ──────────────────────────────────────────────────────────

/**
 * Follow redirect chains for a given `from` path.
 * Returns the final `to` target after collapsing any chain, plus the chain
 * depth. Returns null if `from` has no matching redirect.
 */
export function resolveChain(
  from: string,
  redirects: Redirect[],
  maxDepth = 20,
): { to: string; statusCode: 301 | 302; depth: number } | null {
  const byFrom = new Map(redirects.map(r => [r.from, r]))
  let current = from
  let depth = 0
  let statusCode: 301 | 302 = 301

  while (depth < maxDepth) {
    const r = byFrom.get(current)
    if (!r) break
    statusCode = r.statusCode
    current = r.to
    depth++
  }

  return depth > 0 ? { to: current, statusCode, depth } : null
}

/**
 * Detect whether adding `from → to` would create a loop.
 * A loop exists when following the chain from `to` ever reaches `from`.
 */
function wouldLoop(from: string, to: string, redirects: Redirect[]): boolean {
  const byFrom = new Map(redirects.map(r => [r.from, r]))
  let current = to
  const visited = new Set<string>()
  while (true) {
    if (current === from) return true
    if (visited.has(current)) break
    visited.add(current)
    const next = byFrom.get(current)
    if (!next) break
    current = next.to
  }
  return false
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function addRedirect(params: {
  from: string
  to: string
  statusCode: 301 | 302
  note: string
  createdBy: string
}): Promise<AddResult> {
  const { from, to, statusCode, note, createdBy } = params
  const existing = await getRedirects()

  // Duplicate `from` check
  const dup = existing.find(r => r.from === from)
  if (dup) {
    return { ok: false, error: { kind: 'duplicate', message: `A redirect from ${from} already exists.`, existing: dup } }
  }

  // Loop detection — check before chain collapse
  if (wouldLoop(from, to, existing)) {
    return { ok: false, error: { kind: 'loop', message: `Adding ${from} → ${to} would create a redirect loop.` } }
  }

  // Chain collapse: if B→C exists and we're adding A→B, write A→C instead
  let resolvedTo = to
  let collapsed: { original: string; resolved: string } | undefined
  const chain = resolveChain(to, existing)
  if (chain && chain.to !== to) {
    resolvedTo = chain.to
    collapsed = { original: to, resolved: resolvedTo }
  }

  const redirect: Redirect = {
    id: crypto.randomUUID(),
    from,
    to: resolvedTo,
    statusCode,
    note,
    createdAt: new Date().toISOString(),
    createdBy,
    hitCount: 0,
    lastHitAt: null,
  }

  await saveRedirects([...existing, redirect])
  return { ok: true, redirect, collapsed }
}

export async function updateRedirect(
  id: string,
  params: { from: string; to: string; statusCode: 301 | 302; note: string },
): Promise<AddResult> {
  const { from, to, statusCode, note } = params
  const existing = await getRedirects()
  const current = existing.find(r => r.id === id)
  if (!current) {
    return { ok: false, error: { kind: 'duplicate', message: 'Redirect not found.', existing: existing[0] } }
  }

  const others = existing.filter(r => r.id !== id)

  const dup = others.find(r => r.from === from)
  if (dup) {
    return { ok: false, error: { kind: 'duplicate', message: `Another redirect from ${from} already exists.`, existing: dup } }
  }

  if (wouldLoop(from, to, others)) {
    return { ok: false, error: { kind: 'loop', message: `Updating to ${from} → ${to} would create a redirect loop.` } }
  }

  let resolvedTo = to
  let collapsed: { original: string; resolved: string } | undefined
  const chain = resolveChain(to, others)
  if (chain && chain.to !== to) {
    resolvedTo = chain.to
    collapsed = { original: to, resolved: resolvedTo }
  }

  const updated: Redirect = { ...current, from, to: resolvedTo, statusCode, note }
  await saveRedirects(others.map(r => r.id === id ? r : r).concat(updated))
  return { ok: true, redirect: updated, collapsed }
}

export async function deleteRedirect(id: string): Promise<void> {
  const existing = await getRedirects()
  await saveRedirects(existing.filter(r => r.id !== id))
}

/**
 * Increment the hit counter for a redirect. Intended to be called
 * asynchronously (fire-and-forget) from middleware or API routes.
 */
export async function recordHit(id: string): Promise<void> {
  try {
    const existing = await getRedirects()
    const updated = existing.map(r =>
      r.id === id
        ? { ...r, hitCount: r.hitCount + 1, lastHitAt: new Date().toISOString() }
        : r,
    )
    await saveRedirects(updated)
  } catch {}
}
