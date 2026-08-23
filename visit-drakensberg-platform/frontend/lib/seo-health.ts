/** Inputs accepted by computeSeoHealth — a subset of any entity's fields. */
export type SeoHealthInput = {
  seoTitle?: string | null
  seoDescription?: string | null
  slug?: string | null
  hasImage?: boolean
  contentLength?: number   // character count of body/description
  region?: string | null
  status?: string | null   // 'published' | 'active' | 'draft' | undefined
  robotsIndex?: boolean
}

export type SeoHealthResult = {
  score: number          // 0–100
  critical: string[]     // blocks indexing or causes penalties
  warnings: string[]     // degrades ranking potential
  good: string[]         // confirmed present / correct
}

/**
 * Pure computation — no I/O. Returns a 0–100 SEO health score plus
 * categorised diagnostic messages for display in admin entity editors.
 */
export function computeSeoHealth(entity: SeoHealthInput): SeoHealthResult {
  const critical: string[] = []
  const warnings: string[] = []
  const good: string[] = []
  let score = 0

  const title = entity.seoTitle ?? ''
  const desc  = entity.seoDescription ?? ''

  // ── seoTitle presence (20 pts) ──────────────────────────────────────────
  if (title) {
    score += 20
    good.push('SEO title set')
  } else {
    critical.push('Missing SEO title')
  }

  // ── seoTitle length (15 pts) ────────────────────────────────────────────
  if (title) {
    if (title.length >= 30 && title.length <= 60) {
      score += 15
      good.push('SEO title length optimal (30–60 chars)')
    } else {
      warnings.push(`SEO title is ${title.length} chars — aim for 30–60`)
    }
  }

  // ── seoDescription presence (20 pts) ────────────────────────────────────
  if (desc) {
    score += 20
    good.push('Meta description set')
  } else {
    critical.push('Missing meta description')
  }

  // ── seoDescription length (15 pts) ──────────────────────────────────────
  if (desc) {
    if (desc.length >= 100 && desc.length <= 160) {
      score += 15
      good.push('Meta description length optimal (100–160 chars)')
    } else {
      warnings.push(`Meta description is ${desc.length} chars — aim for 100–160`)
    }
  }

  // ── Slug (10 pts) ────────────────────────────────────────────────────────
  if (entity.slug) {
    score += 10
    good.push('URL slug present')
  } else {
    critical.push('No URL slug — cannot generate canonical URL')
  }

  // ── Robots index (5 pts) ─────────────────────────────────────────────────
  if (entity.robotsIndex !== false) {
    score += 5
    good.push('Page is indexable')
  } else {
    warnings.push('Page set to noindex')
  }

  // ── Featured image (10 pts) ──────────────────────────────────────────────
  if (entity.hasImage) {
    score += 10
    good.push('Featured image present')
  } else {
    warnings.push('No featured image — add one for rich OG / social previews')
  }

  // ── Content length (5 pts) ───────────────────────────────────────────────
  if ((entity.contentLength ?? 0) > 100) {
    score += 5
    good.push('Content length sufficient')
  } else {
    warnings.push('Content too short — aim for at least 100 characters')
  }

  return { score, critical, warnings, good }
}

/** Colour class for a score value (for use with Tailwind). */
export function scoreColor(score: number): { badge: string; text: string } {
  if (score >= 75) return { badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600' }
  if (score >= 50) return { badge: 'bg-amber-100 text-amber-700', text: 'text-amber-600' }
  return { badge: 'bg-red-100 text-red-600', text: 'text-red-500' }
}
