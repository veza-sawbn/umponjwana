/**
 * Quality Checklist — data layer (Tool 14)
 *
 * Two kinds of check:
 *   automatic — derived deterministically from entity fields (pass/fail/warn)
 *   manual    — require human judgment; state stored in localStorage per entity
 *
 * Checklist state is never persisted to Supabase — this is a pre-publish
 * workflow aid, not an audit log.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckCategory = 'content' | 'seo' | 'technical' | 'ux'

export type AutoCheckResult = 'pass' | 'fail' | 'warn'

export type AutoCheck = {
  id: string
  category: CheckCategory
  label: string
  /** One-line explanation shown on hover / in expanded view */
  guidance: string
  result: AutoCheckResult
  /** Optional detail — e.g. the actual character count */
  detail?: string
  /** Link to fix the issue — relative admin path */
  fixPath?: string
}

export type ManualCheck = {
  id: string
  category: CheckCategory
  label: string
  /** Hint shown below the checkbox */
  guidance: string
}

export type ChecklistResult = {
  auto: AutoCheck[]
  manual: ManualCheck[]
  /** 0–100, computed from auto checks only */
  score: number
  readyToPublish: boolean
}

// ── Generic entity shape ───────────────────────────────────────────────────────

/**
 * Normalised view of any entity — only the fields the checklist cares about.
 * Callers map their native type to this before calling `runChecklist`.
 */
export type ChecklistEntity = {
  id: string
  kind: 'trail' | 'property' | 'activity' | 'region'
  name: string
  slug: string | undefined | null
  status: string
  description: string | undefined | null
  region: string | undefined | null
  hasImage: boolean
  hasOgImage: boolean
  seoTitle: string | undefined | null
  seoDescription: string | undefined | null
  robotsIndex: boolean | undefined | null
  relatedCount: number      // relatedTrailIds + relatedPropertyIds + relatedActivityIds
  focusTopic: string | undefined | null
  /** Admin edit path */
  editPath: string
}

// ── Automatic checks ──────────────────────────────────────────────────────────

function len(s: string | undefined | null): number {
  return s?.trim().length ?? 0
}

export function runAutoChecks(entity: ChecklistEntity): AutoCheck[] {
  const checks: AutoCheck[] = []
  const ep = entity.editPath

  // ── Content ──────────────────────────────────────────────────────────────
  checks.push({
    id: 'content-name',
    category: 'content',
    label: 'Name / title is present',
    guidance: 'Every published page must have a recognisable name.',
    result: len(entity.name) > 0 ? 'pass' : 'fail',
    fixPath: ep,
  })

  const descLen = len(entity.description)
  checks.push({
    id: 'content-description',
    category: 'content',
    label: 'Description is present and meaningful',
    guidance: 'Aim for at least 150 characters. Short descriptions hurt content quality signals.',
    result: descLen >= 150 ? 'pass' : descLen >= 50 ? 'warn' : 'fail',
    detail: descLen > 0 ? `${descLen} chars` : 'Missing',
    fixPath: ep,
  })

  checks.push({
    id: 'content-image',
    category: 'content',
    label: 'Featured image is set',
    guidance: 'Pages without images rank lower and get poor social-share previews.',
    result: entity.hasImage ? 'pass' : 'fail',
    fixPath: ep,
  })

  checks.push({
    id: 'content-region',
    category: 'content',
    label: 'Region is assigned',
    guidance: 'Region drives internal linking, sitemap grouping, and destination graph placement.',
    result: entity.kind === 'region'
      ? 'pass'                                    // regions are themselves geographic
      : len(entity.region) > 0 ? 'pass' : 'warn',
    fixPath: ep,
  })

  // ── SEO ──────────────────────────────────────────────────────────────────
  const titleLen = len(entity.seoTitle)
  checks.push({
    id: 'seo-title',
    category: 'seo',
    label: 'SEO title is set (30–60 chars)',
    guidance: 'Title tags below 30 chars are too short; above 60 chars Googletruncates them.',
    result: titleLen >= 30 && titleLen <= 60
      ? 'pass'
      : titleLen > 0 ? 'warn' : 'fail',
    detail: titleLen > 0 ? `${titleLen} chars` : 'Missing',
    fixPath: ep,
  })

  const descSeoLen = len(entity.seoDescription)
  checks.push({
    id: 'seo-description',
    category: 'seo',
    label: 'Meta description is set (100–160 chars)',
    guidance: 'Google often rewrites descriptions outside this range, undermining click-through copy.',
    result: descSeoLen >= 100 && descSeoLen <= 160
      ? 'pass'
      : descSeoLen > 0 ? 'warn' : 'fail',
    detail: descSeoLen > 0 ? `${descSeoLen} chars` : 'Missing',
    fixPath: ep,
  })

  const hasSlug = len(entity.slug) > 0 && !entity.slug?.match(/^[0-9a-f-]{36}$/)
  checks.push({
    id: 'seo-slug',
    category: 'seo',
    label: 'Canonical URL slug is set (not UUID)',
    guidance: 'Keyword slugs are indexed correctly and are shareable. UUID paths appear in the sitemap but carry no keyword signal.',
    result: hasSlug ? 'pass' : entity.slug ? 'warn' : 'fail',
    detail: entity.slug ?? 'No slug',
    fixPath: ep,
  })

  checks.push({
    id: 'seo-indexable',
    category: 'seo',
    label: 'Page is set to index (robotsIndex ≠ false)',
    guidance: 'Setting robotsIndex: false sends a noindex directive. Only set this deliberately.',
    result: entity.robotsIndex === false ? 'fail' : 'pass',
    fixPath: ep,
  })

  checks.push({
    id: 'seo-focus-topic',
    category: 'seo',
    label: 'Focus topic / keyword is set',
    guidance: 'A focus topic feeds the Topic Map and Cannibalisation Detector. It helps track which page owns each keyword.',
    result: len(entity.focusTopic) > 0 ? 'pass' : 'warn',
    fixPath: ep,
  })

  checks.push({
    id: 'seo-internal-links',
    category: 'seo',
    label: 'At least one related entity is linked',
    guidance: 'Related entities create inbound links that lift both pages out of the orphan zone.',
    result: entity.relatedCount >= 2
      ? 'pass'
      : entity.relatedCount === 1 ? 'warn' : 'fail',
    detail: `${entity.relatedCount} linked`,
    fixPath: ep,
  })

  // ── Technical ────────────────────────────────────────────────────────────
  const isLive = ['active', 'published'].includes(entity.status)
  checks.push({
    id: 'tech-status',
    category: 'technical',
    label: 'Status is active / published',
    guidance: 'Unpublished entities appear in the admin but are not served to visitors or crawlers.',
    result: isLive ? 'pass' : 'warn',
    detail: entity.status,
    fixPath: ep,
  })

  checks.push({
    id: 'tech-og-image',
    category: 'technical',
    label: 'OG image is set (social sharing preview)',
    guidance: 'Without an OG image the link preview on social media shows a placeholder. Falls back to featured image if both are set.',
    result: entity.hasOgImage || entity.hasImage ? 'pass' : 'warn',
    fixPath: ep,
  })

  return checks
}

// ── Manual checks ─────────────────────────────────────────────────────────────

export const MANUAL_CHECKS: ManualCheck[] = [
  // Content
  {
    id: 'manual-proofread',
    category: 'content',
    label: 'Content has been proofread',
    guidance: 'Check spelling, grammar, and that facts (distances, prices, opening hours) are accurate.',
  },
  {
    id: 'manual-images-alt',
    category: 'content',
    label: 'Images are compressed and have alt text',
    guidance: 'Large images slow Core Web Vitals. Alt text improves accessibility and image-search indexing.',
  },
  // SEO
  {
    id: 'manual-redirects',
    category: 'seo',
    label: 'Redirects from old URLs are in place',
    guidance: 'If this page replaced an older URL, add a 301 redirect in the Redirect Manager.',
  },
  {
    id: 'manual-schema',
    category: 'technical',
    label: 'Structured data (JSON-LD) is correct',
    guidance: 'Validate with Google\'s Rich Results Test. Especially important for trails (Hike schema) and accommodation (LodgingBusiness).',
  },
  {
    id: 'manual-mobile',
    category: 'ux',
    label: 'Mobile layout reviewed in browser DevTools',
    guidance: 'Resize to 375 px width. Check text sizes, tap targets, and that images don\'t overflow.',
  },
  {
    id: 'manual-cta',
    category: 'ux',
    label: 'A clear call-to-action is visible above the fold',
    guidance: 'Every page should direct the visitor to one primary action — book, enquire, or explore more.',
  },
  {
    id: 'manual-contact',
    category: 'ux',
    label: 'Contact / booking information is accurate',
    guidance: 'Phone numbers, email addresses, and prices go stale. Confirm they are current.',
  },
]

// ── Score ─────────────────────────────────────────────────────────────────────

/**
 * Score from 0–100 based on auto-checks only.
 * fail = 0 pts, warn = 0.5 pts, pass = 1 pt (normalised to 100).
 */
export function computeChecklistScore(auto: AutoCheck[]): number {
  if (auto.length === 0) return 0
  const total = auto.reduce((sum, c) => {
    if (c.result === 'pass') return sum + 1
    if (c.result === 'warn') return sum + 0.5
    return sum
  }, 0)
  return Math.round((total / auto.length) * 100)
}

/**
 * Ready to publish = no auto-check failures (warns are acceptable).
 */
export function isReadyToPublish(auto: AutoCheck[]): boolean {
  return auto.every(c => c.result !== 'fail')
}

// ── Full run ──────────────────────────────────────────────────────────────────

export function runChecklist(entity: ChecklistEntity): ChecklistResult {
  const auto = runAutoChecks(entity)
  const score = computeChecklistScore(auto)
  return {
    auto,
    manual: MANUAL_CHECKS,
    score,
    readyToPublish: isReadyToPublish(auto),
  }
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'seo_quality_checklist'

type StoredState = Record<string, Record<string, boolean>>

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveState(state: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export function getManualCheckState(entityId: string): Record<string, boolean> {
  return loadState()[entityId] ?? {}
}

export function setManualCheck(entityId: string, checkId: string, value: boolean): void {
  const state = loadState()
  state[entityId] = { ...(state[entityId] ?? {}), [checkId]: value }
  saveState(state)
}
