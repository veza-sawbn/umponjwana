'use client'

/**
 * Tool 12: Sitemap Control — /admin/seo/sitemap
 *
 * Read-only diagnostic view of what is and isn't in the sitemap.
 * Mirrors the logic in app/sitemap.ts to compute accurate counts:
 *   - Static routes (hardcoded in sitemap.ts)
 *   - Editorial story slugs (hardcoded in sitemap.ts)
 *   - Dynamic entity pages (trails, properties, activities, packages,
 *     tours, regions, reserves, towns, routes)
 *
 * For each entity type it surfaces:
 *   Total published / active · With a real slug · Using UUID fallback · Noindex
 *
 * "Slug gap" entries mean the sitemap is currently advertising a UUID URL
 * (/hikes/trail-abc123) instead of a readable canonical (/hikes/tugela-falls).
 * Editing the slug in the entity editor fixes it immediately.
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { getTrails } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import { getPackages } from '@/lib/packages'
import { getTours } from '@/lib/tours'
import { getRegions } from '@/lib/regions'

// ── Constants mirrored from app/sitemap.ts ─────────────────────────────────

const STATIC_ROUTE_COUNT = 19   // matches STATIC_ROUTES array length in sitemap.ts
const STORY_SLUG_COUNT   = 6    // matches STORY_SLUGS array length in sitemap.ts

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

// ── Types ─────────────────────────────────────────────────────────────────────

type EntitySummary = {
  /** Display label for this type */
  label: string
  /** URL prefix on the public site */
  pathPrefix: string
  /** Edit route inside admin */
  editPath: string
  total: number
  withSlug: number
  uuidFallback: number
  noindex: number
  recently: SlimEntity[]      // changed in last 14 days
  slugGaps: SlimEntity[]      // published/active but no real slug
}

type SlimEntity = {
  id: string
  name: string
  slug: string | undefined
  updatedAt: string | undefined
  editPath: string
  publicPath: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
  // vd_entities ID patterns like "trail-abc123" or "prop-abc123"
  /^(trail|prop|act|tour|pkg)-[a-z0-9]+$/i.test(s)

function isRecent(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < FOURTEEN_DAYS_MS
}

function statCard(value: number, label: string, accent?: string) {
  return (
    <div className="bg-white border border-gray-200 p-5">
      <p className={labelCls}>{label}</p>
      <p className={`font-sans text-3xl font-semibold tabular-nums ${accent ?? 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}

// ── Section: per-type table row ───────────────────────────────────────────────

function TypeRow({
  summary,
  expanded,
  onToggle,
}: {
  summary: EntitySummary
  expanded: boolean
  onToggle: () => void
}) {
  const health = summary.total === 0
    ? null
    : Math.round(((summary.total - summary.uuidFallback - summary.noindex) / summary.total) * 100)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="font-sans text-sm font-medium text-gray-800 w-28 shrink-0">
          {summary.label}
        </span>
        <span className="font-sans text-sm tabular-nums text-gray-600 w-14">{summary.total}</span>
        <span className="font-sans text-sm tabular-nums text-emerald-600 w-14">{summary.withSlug}</span>
        <span className={`font-sans text-sm tabular-nums w-14 ${summary.uuidFallback > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
          {summary.uuidFallback}
        </span>
        <span className={`font-sans text-sm tabular-nums w-14 ${summary.noindex > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
          {summary.noindex}
        </span>
        <span className="font-sans text-sm tabular-nums text-sky-600 w-14">
          {summary.recently.length > 0 ? summary.recently.length : '—'}
        </span>
        <div className="flex-1 flex items-center gap-2">
          {health !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${health >= 75 ? 'bg-emerald-500' : health >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${health}%` }}
                />
              </div>
              <span className="font-sans text-[11px] text-gray-400 tabular-nums">{health}%</span>
            </div>
          )}
        </div>
        {(summary.slugGaps.length > 0 || summary.recently.length > 0)
          ? expanded ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
                     : <ChevronDown size={14} className="text-gray-400 shrink-0" />
          : <span className="w-[14px] shrink-0" />
        }
      </button>

      {expanded && (summary.slugGaps.length > 0 || summary.recently.length > 0) && (
        <div className="border-t border-gray-50 bg-[#F7F5F2] px-4 py-4 space-y-4">

          {/* Slug gaps */}
          {summary.slugGaps.length > 0 && (
            <div>
              <p className={labelCls}>Slug gaps — using UUID as URL ({summary.slugGaps.length})</p>
              <div className="space-y-1">
                {summary.slugGaps.slice(0, 10).map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-3 bg-white border border-amber-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-gray-800 font-medium truncate">{e.name}</p>
                      <p className="font-sans text-[11px] text-gray-400 truncate">
                        {e.publicPath}
                      </p>
                    </div>
                    <Link
                      href={e.editPath}
                      className="shrink-0 font-sans text-[11px] text-[#2d6a4f] hover:underline flex items-center gap-1"
                    >
                      Add slug <ExternalLink size={10} />
                    </Link>
                  </div>
                ))}
                {summary.slugGaps.length > 10 && (
                  <p className="font-sans text-xs text-gray-400 px-1">
                    +{summary.slugGaps.length - 10} more — edit entity to add slug
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recently changed */}
          {summary.recently.length > 0 && (
            <div>
              <p className={labelCls}>Updated in last 14 days ({summary.recently.length})</p>
              <div className="space-y-1">
                {summary.recently.map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-3 bg-white border border-sky-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-gray-800 font-medium truncate">{e.name}</p>
                      <p className="font-sans text-[11px] text-gray-400 truncate">
                        {e.updatedAt ? new Date(e.updatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '—'}
                        {' · '}{e.publicPath}
                      </p>
                    </div>
                    <Link
                      href={e.editPath}
                      className="shrink-0 font-sans text-[11px] text-[#2d6a4f] hover:underline flex items-center gap-1"
                    >
                      Edit <ExternalLink size={10} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SitemapControlPage() {
  const [loading, setLoading] = useState(true)
  const [summaries, setSummaries] = useState<EntitySummary[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpanded = (label: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [trails, properties, activities, packages, tours, regions] = await Promise.all([
          getTrails(),
          getProperties(),
          getActivities(),
          getPackages(),
          getTours(),
          getRegions(),
        ])

        // ── Trails ─────────────────────────────────────────────────────────
        const publishedTrails = trails.filter(t => t.status === 'published')
        const trailSummary: EntitySummary = {
          label: 'Trails',
          pathPrefix: '/hikes',
          editPath: '/admin/trails',
          total: publishedTrails.length,
          withSlug: publishedTrails.filter(t => t.slug && !isUUID(t.slug)).length,
          uuidFallback: publishedTrails.filter(t => !t.slug || isUUID(t.slug)).length,
          noindex: publishedTrails.filter(t => t.robotsIndex === false).length,
          recently: publishedTrails
            .filter(t => isRecent(undefined))   // trails don't have updatedAt — skip
            .map(t => ({
              id: t.id, name: t.name, slug: t.slug,
              updatedAt: undefined,
              editPath: `/admin/trails/${t.id}`,
              publicPath: `/hikes/${t.slug || t.id}`,
            })),
          slugGaps: publishedTrails
            .filter(t => t.robotsIndex !== false && (!t.slug || isUUID(t.slug)))
            .map(t => ({
              id: t.id, name: t.name, slug: t.slug,
              updatedAt: undefined,
              editPath: `/admin/trails/${t.id}`,
              publicPath: `/hikes/${t.slug || t.id}`,
            })),
        }

        // ── Properties ─────────────────────────────────────────────────────
        const activeProps = properties.filter(p => p.status === 'active')
        const propSummary: EntitySummary = {
          label: 'Stays',
          pathPrefix: '/stays',
          editPath: '/admin/properties',
          total: activeProps.length,
          withSlug: activeProps.filter(p => p.slug && !isUUID(p.slug)).length,
          uuidFallback: activeProps.filter(p => !p.slug || isUUID(p.slug)).length,
          noindex: activeProps.filter(p => p.robotsIndex === false).length,
          recently: activeProps
            .filter(p => isRecent(p.createdAt))
            .map(p => ({
              id: p.id, name: p.name, slug: p.slug,
              updatedAt: p.createdAt,
              editPath: `/admin/properties/${p.id}`,
              publicPath: `/stays/${p.slug || p.id}`,
            })),
          slugGaps: activeProps
            .filter(p => p.robotsIndex !== false && (!p.slug || isUUID(p.slug)))
            .map(p => ({
              id: p.id, name: p.name, slug: p.slug,
              updatedAt: p.createdAt,
              editPath: `/admin/properties/${p.id}`,
              publicPath: `/stays/${p.slug || p.id}`,
            })),
        }

        // ── Activities ─────────────────────────────────────────────────────
        const activeActs = activities.filter(a => a.status === 'active')
        const actSummary: EntitySummary = {
          label: 'Activities',
          pathPrefix: '/activities',
          editPath: '/admin/activities',
          total: activeActs.length,
          withSlug: activeActs.filter(a => a.slug && !isUUID(a.slug)).length,
          uuidFallback: activeActs.filter(a => !a.slug || isUUID(a.slug)).length,
          noindex: activeActs.filter(a => a.robotsIndex === false).length,
          recently: activeActs
            .filter(a => isRecent(a.createdAt))
            .map(a => ({
              id: a.id, name: a.name, slug: a.slug,
              updatedAt: a.createdAt,
              editPath: `/admin/activities/${a.id}`,
              publicPath: `/activities/${a.slug || a.id}`,
            })),
          slugGaps: activeActs
            .filter(a => a.robotsIndex !== false && (!a.slug || isUUID(a.slug)))
            .map(a => ({
              id: a.id, name: a.name, slug: a.slug,
              updatedAt: a.createdAt,
              editPath: `/admin/activities/${a.id}`,
              publicPath: `/activities/${a.slug || a.id}`,
            })),
        }

        // ── Packages ───────────────────────────────────────────────────────
        const publishedPkgs = packages.filter(p => p.packageStatus === 'published')
        const pkgSummary: EntitySummary = {
          label: 'Packages',
          pathPrefix: '/packages',
          editPath: '/admin/packages',
          total: publishedPkgs.length,
          withSlug: publishedPkgs.filter(p => p.slug && !isUUID(p.slug)).length,
          uuidFallback: publishedPkgs.filter(p => !p.slug || isUUID(p.slug)).length,
          noindex: publishedPkgs.filter(p => p.robotsIndex === false).length,
          recently: publishedPkgs
            .filter(p => isRecent(p.updatedAt ?? p.createdAt))
            .map(p => ({
              id: p.id, name: p.title, slug: p.slug,
              updatedAt: p.updatedAt ?? p.createdAt,
              editPath: `/admin/packages/${p.id}`,
              publicPath: `/packages/${p.slug || p.id}`,
            })),
          slugGaps: publishedPkgs
            .filter(p => p.robotsIndex !== false && (!p.slug || isUUID(p.slug)))
            .map(p => ({
              id: p.id, name: p.title, slug: p.slug,
              updatedAt: p.updatedAt ?? p.createdAt,
              editPath: `/admin/packages/${p.id}`,
              publicPath: `/packages/${p.slug || p.id}`,
            })),
        }

        // ── Tours ──────────────────────────────────────────────────────────
        const activeTours = tours.filter(t => t.status === 'active')
        const tourSummary: EntitySummary = {
          label: 'Tours',
          pathPrefix: '/tours',
          editPath: '/admin/tours',
          total: activeTours.length,
          withSlug: activeTours.filter(t => t.slug && !isUUID(t.slug)).length,
          uuidFallback: activeTours.filter(t => !t.slug || isUUID(t.slug)).length,
          noindex: activeTours.filter(t => t.robotsIndex === false).length,
          recently: activeTours
            .filter(t => isRecent(t.createdAt))
            .map(t => ({
              id: t.id, name: t.name, slug: t.slug,
              updatedAt: t.createdAt,
              editPath: `/admin/tours/${t.id}`,
              publicPath: `/tours/${t.slug || t.id}`,
            })),
          slugGaps: activeTours
            .filter(t => t.robotsIndex !== false && (!t.slug || isUUID(t.slug)))
            .map(t => ({
              id: t.id, name: t.name, slug: t.slug,
              updatedAt: t.createdAt,
              editPath: `/admin/tours/${t.id}`,
              publicPath: `/tours/${t.slug || t.id}`,
            })),
        }

        // ── Regions ────────────────────────────────────────────────────────
        // Regions always have slugs — they're the source of truth for the
        // destination graph; the sitemap always includes them.
        const regionSummary: EntitySummary = {
          label: 'Regions',
          pathPrefix: '/regions',
          editPath: '/admin/regions',
          total: regions.length,
          withSlug: regions.filter(r => !!r.slug).length,
          uuidFallback: regions.filter(r => !r.slug).length,
          noindex: 0,
          recently: [],
          slugGaps: [],
        }

        setSummaries([trailSummary, propSummary, actSummary, pkgSummary, tourSummary, regionSummary])
      } catch (err) {
        console.error('Failed to load sitemap data', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const dynamic = summaries.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        withSlug: acc.withSlug + s.withSlug,
        uuidFallback: acc.uuidFallback + s.uuidFallback,
        noindex: acc.noindex + s.noindex,
        recent: acc.recent + s.recently.length,
      }),
      { total: 0, withSlug: 0, uuidFallback: 0, noindex: 0, recent: 0 },
    )
    const sitemapTotal = STATIC_ROUTE_COUNT + STORY_SLUG_COUNT + dynamic.total
    const sitemapClean = STATIC_ROUTE_COUNT + STORY_SLUG_COUNT + dynamic.withSlug
    return { ...dynamic, sitemapTotal, sitemapClean }
  }, [summaries])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/seo" className="font-sans text-xs text-gray-400 hover:text-gray-600">
            ← SEO Console
          </Link>
        </div>
        <h1 className="font-display italic text-2xl text-gray-900">Sitemap Control</h1>
        <p className="font-sans text-sm text-gray-500 mt-0.5">
          Diagnostic view of what's in the sitemap — URLs, slug coverage, and recently changed pages.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-sans text-sm">Loading sitemap data…</span>
          </div>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statCard(totals.sitemapTotal, 'Total sitemap URLs')}
              {statCard(totals.sitemapClean, 'With canonical slug', 'text-emerald-600')}
              {statCard(totals.uuidFallback, 'UUID fallback URLs', totals.uuidFallback > 0 ? 'text-amber-600' : 'text-gray-400')}
              {statCard(totals.noindex, 'Excluded (noindex)', totals.noindex > 0 ? 'text-red-600' : 'text-gray-400')}
            </div>

            {/* Explanation of static routes */}
            <div className="bg-white border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-sans text-sm text-gray-700 font-medium mb-0.5">
                    {STATIC_ROUTE_COUNT} static routes + {STORY_SLUG_COUNT} editorial stories — always in sitemap
                  </p>
                  <p className="font-sans text-xs text-gray-400">
                    These are hardcoded in <code className="bg-gray-100 px-1">app/sitemap.ts</code> and always included regardless of DB state.
                    Dynamic entity pages below are controlled by their status and robotsIndex flag.
                  </p>
                </div>
              </div>
            </div>

            {/* UUID fallback warning */}
            {totals.uuidFallback > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-sans text-sm text-amber-800 font-medium mb-0.5">
                    {totals.uuidFallback} entities are advertising UUID URLs
                  </p>
                  <p className="font-sans text-xs text-amber-700">
                    The sitemap correctly uses <code className="bg-amber-100 px-1">slug ∥ id</code> — the same URL the live page serves at —
                    but UUID-style paths are hard for search engines to understand. Add a slug to each entity to claim a
                    keyword-rich canonical URL. Expand any type below to see which entities need slugs.
                  </p>
                </div>
              </div>
            )}

            {/* Per-type breakdown table */}
            <div className="bg-white border border-gray-200 overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                <span className={`${labelCls} mb-0 w-28 shrink-0`}>Type</span>
                <span className={`${labelCls} mb-0 w-14`}>Total</span>
                <span className={`${labelCls} mb-0 w-14 text-emerald-500`}>Slug</span>
                <span className={`${labelCls} mb-0 w-14 text-amber-500`}>UUID</span>
                <span className={`${labelCls} mb-0 w-14 text-red-500`}>Noindex</span>
                <span className={`${labelCls} mb-0 w-14 text-sky-500`}>Recent</span>
                <span className={`${labelCls} mb-0 flex-1`}>Slug coverage</span>
              </div>
              {summaries.map(s => (
                <TypeRow
                  key={s.label}
                  summary={s}
                  expanded={expanded.has(s.label)}
                  onToggle={() => toggleExpanded(s.label)}
                />
              ))}
            </div>

            {/* All-clear or action needed */}
            {totals.uuidFallback === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <p className="font-sans text-sm text-emerald-800">
                  All published entities have real slugs — the sitemap is advertising clean canonical URLs.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 p-4">
                <p className={labelCls}>Quick actions</p>
                <div className="flex flex-wrap gap-2">
                  {summaries.filter(s => s.slugGaps.length > 0).map(s => (
                    <Link
                      key={s.label}
                      href={s.editPath}
                      className="font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 hover:bg-[#2d6a4f] hover:text-white transition-colors"
                    >
                      Fix {s.slugGaps.length} {s.label.toLowerCase()} slug{s.slugGaps.length !== 1 ? 's' : ''} →
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Footer: link to sitemap.ts for reference */}
            <p className="font-sans text-xs text-gray-400 text-center">
              The live sitemap is served at{' '}
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600"
              >
                /sitemap.xml
              </a>
              . To add new static routes or stories, edit{' '}
              <code className="bg-gray-100 px-1">app/sitemap.ts</code>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
