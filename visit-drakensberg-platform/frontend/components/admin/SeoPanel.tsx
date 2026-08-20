'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { computeSeoHealth, scoreColor } from '@/lib/seo-health'

const SITE_HOST = 'visitdrakensberg.com'

type Props = {
  seoTitle: string
  seoDescription: string
  robotsIndex?: boolean
  /** Fallback name shown in SERP preview when seoTitle is empty. */
  previewTitle?: string
  /** URL slug for SERP preview. */
  previewSlug?: string
  /** URL base path, e.g. 'hikes', 'packages', 'regions'. */
  urlBase?: string
  /** Whether the entity has a featured image (for health score). */
  hasImage?: boolean
  /** Character length of entity body/description (for health score). */
  contentLength?: number
  /** Entity publish status (for health score). */
  status?: string | null
  onChangeSeoTitle: (v: string) => void
  onChangeSeoDescription: (v: string) => void
  onChangeRobotsIndex?: (v: boolean) => void
}

function charCountColor(len: number, min: number, max: number): string {
  if (len === 0) return 'text-gray-400'
  if (len >= min && len <= max) return 'text-emerald-600'
  if (len < min) return 'text-amber-500'
  return 'text-red-500'
}

export function SeoPanel({
  seoTitle,
  seoDescription,
  robotsIndex,
  previewTitle,
  previewSlug,
  urlBase,
  hasImage,
  contentLength,
  status,
  onChangeSeoTitle,
  onChangeSeoDescription,
  onChangeRobotsIndex,
}: Props) {
  const [open, setOpen] = useState(false)

  const health = computeSeoHealth({
    seoTitle,
    seoDescription,
    slug: previewSlug,
    hasImage,
    contentLength,
    status,
    robotsIndex,
  })
  const { badge } = scoreColor(health.score)

  const displayTitle = seoTitle || previewTitle || 'Untitled'
  const pathParts = [urlBase, previewSlug].filter(Boolean)
  const displayUrl = pathParts.length
    ? `${SITE_HOST} › ${pathParts.join(' › ')}`
    : SITE_HOST

  const inputCls =
    'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  return (
    <div className="border-t border-gray-100 pt-6">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">SEO</p>
          <span className={`font-sans text-[10px] font-semibold px-2 py-0.5 ${badge}`}>
            {health.score}/100
          </span>
          {health.critical.length > 0 && (
            <span className="font-sans text-[10px] text-red-500">
              {health.critical.length} critical
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={14} className="text-gray-400" />
          : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {/* SERP preview */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">
              Search Preview
            </p>
            <p className="font-sans text-[13px] text-[#1a0dab] leading-tight mb-0.5 truncate">
              {displayTitle}
            </p>
            <p className="font-sans text-[12px] text-[#006621] mb-1 truncate">{displayUrl}</p>
            <p className="font-sans text-[12px] text-gray-500 leading-snug line-clamp-2">
              {seoDescription || <span className="text-gray-300 italic">No meta description — search engines will pick a snippet from the page.</span>}
            </p>
          </div>

          {/* seoTitle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls} style={{ marginBottom: 0 }}>SEO Title</label>
              <span className={`font-sans text-[10px] tabular-nums ${charCountColor(seoTitle.length, 30, 60)}`}>
                {seoTitle.length}/60
              </span>
            </div>
            <input
              value={seoTitle}
              onChange={e => onChangeSeoTitle(e.target.value)}
              className={inputCls}
              placeholder="Overrides the page title in search results (50–60 chars ideal)"
            />
            <p className="font-sans text-[10px] text-gray-400 mt-1">
              Leave blank to use the entity's title field.
            </p>
          </div>

          {/* seoDescription */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls} style={{ marginBottom: 0 }}>Meta Description</label>
              <span className={`font-sans text-[10px] tabular-nums ${charCountColor(seoDescription.length, 100, 160)}`}>
                {seoDescription.length}/160
              </span>
            </div>
            <textarea
              value={seoDescription}
              onChange={e => onChangeSeoDescription(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Shown in search results below the title (100–160 chars ideal)"
            />
          </div>

          {/* Noindex toggle */}
          {onChangeRobotsIndex !== undefined && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={robotsIndex !== false}
                onChange={e => onChangeRobotsIndex(e.target.checked)}
                className="accent-[#2d6a4f]"
              />
              <span className="font-sans text-sm text-gray-700">Indexable (allow search engines to index this page)</span>
            </label>
          )}

          {/* Diagnostics */}
          {(health.critical.length > 0 || health.warnings.length > 0) && (
            <div className="space-y-1.5">
              {health.critical.map(msg => (
                <p key={msg} className="font-sans text-[11px] text-red-500 flex gap-1.5">
                  <span>●</span>{msg}
                </p>
              ))}
              {health.warnings.map(msg => (
                <p key={msg} className="font-sans text-[11px] text-amber-600 flex gap-1.5">
                  <span>●</span>{msg}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
