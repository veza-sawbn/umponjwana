'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pin, X } from 'lucide-react'
import { getTrailSummaries, type Trail } from '@/lib/trails'
import { getActivities, type Activity } from '@/lib/activities'
import { SEASONS, SEASON_META, type Season } from '@/lib/seasons'
import type { SeasonalItem } from '@/lib/modules'
import {
  activeSeason, itemRef, seasonCopy, seasonFor, selectSeasonalItems, type SeasonalPicksConfig,
} from '@/lib/seasonal-picks'

/**
 * Admin → Website → "Recommended This Season": full control over the
 * homepage band — on/off, which season it shows, its copy (per-season blurb),
 * card count, auto-fill from season tags, hand-picked listings per season
 * (ordered), and listings excluded everywhere. The live preview below runs
 * the same selection the homepage does (lib/seasonal-picks.ts).
 */

const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
const textareaCls = `${inputCls} resize-none`

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="font-sans text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-[#F7F5F2] border border-gray-200">
      <div>
        <p className="font-sans text-sm font-medium text-gray-800">{label}</p>
        <p className="font-sans text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`w-11 h-6 transition-colors relative shrink-0 ${on ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

function itemLabel(entry: SeasonalItem) {
  return entry.item.name
}

function itemMeta(entry: SeasonalItem) {
  const kind = entry.kind === 'trail' ? 'Trail' : 'Activity'
  const live = entry.kind === 'trail' ? entry.item.status === 'published' : entry.item.status === 'active'
  return `${kind}${entry.item.region ? ` · ${entry.item.region}` : ''}${live ? '' : ' · not live'}`
}

export default function SeasonalPicksEditor({ value, onChange }: {
  value: SeasonalPicksConfig
  onChange: (next: SeasonalPicksConfig) => void
}) {
  const [trails, setTrails] = useState<Trail[] | null>(null)
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const current = activeSeason(value)
  const [tab, setTab] = useState<Season>(current)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getTrailSummaries().then(setTrails).catch(() => setTrails([]))
    getActivities().then(setActivities).catch(() => setActivities([]))
  }, [])

  const loading = trails === null || activities === null
  const allItems = useMemo<SeasonalItem[]>(() => [
    ...(trails ?? []).map(item => ({ kind: 'trail' as const, item })),
    ...(activities ?? []).map(item => ({ kind: 'activity' as const, item })),
  ], [trails, activities])
  const byRef = useMemo(() => new Map(allItems.map(e => [itemRef(e), e])), [allItems])

  const set = <K extends keyof SeasonalPicksConfig>(key: K, v: SeasonalPicksConfig[K]) => onChange({ ...value, [key]: v })

  const pinned = value.pinned[tab] ?? []
  const setPinned = (refs: string[]) => onChange({ ...value, pinned: { ...value.pinned, [tab]: refs } })
  const move = (i: number, d: -1 | 1) => {
    const next = [...pinned]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setPinned(next)
  }
  const toggleExcluded = (ref: string) =>
    set('excluded', value.excluded.includes(ref) ? value.excluded.filter(r => r !== ref) : [...value.excluded, ref])

  const q = query.trim().toLowerCase()
  const searchResults = q
    ? allItems.filter(e => !pinned.includes(itemRef(e)) && itemLabel(e).toLowerCase().includes(q)).slice(0, 8)
    : []
  // Listings tagged for the tab's season — what auto-fill draws from.
  const tagged = allItems.filter(e => (e.item.seasons ?? []).includes(tab))
  const preview = loading ? [] : selectSeasonalItems(value, tab, trails!, activities!)
  const copy = seasonCopy(value, tab)

  return (
    <div className="space-y-5">
      <h2 className="font-display italic text-2xl text-[#000000] mb-6">Recommended This Season</h2>

      <Toggle
        label="Show on homepage"
        desc="Turn the whole “Recommended this season” band on or off"
        on={value.enabled}
        onChange={on => set('enabled', on)}
      />

      <Field
        label="Season shown"
        hint={value.season_mode === 'auto'
          ? `Follows the calendar — currently ${SEASON_META[seasonFor(new Date())].label}.`
          : 'Pinned: the homepage shows this season until you switch back to Automatic.'}
      >
        <div className="flex flex-wrap gap-2 mt-1">
          {(['auto', ...SEASONS] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { set('season_mode', s); if (s !== 'auto') setTab(s) }}
              className={`px-3 py-1.5 font-sans text-xs border transition-colors ${value.season_mode === s ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}
            >
              {s === 'auto' ? 'Automatic' : SEASON_META[s].label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Eyebrow" hint="Leave blank for “Season · months”.">
          <input value={value.eyebrow} onChange={e => set('eyebrow', e.target.value)} placeholder={`${SEASON_META[current].label} · ${SEASON_META[current].range}`} className={inputCls} />
        </Field>
        <Field label="Heading">
          <input value={value.heading} onChange={e => set('heading', e.target.value)} placeholder="Recommended this season" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Max cards shown">
          <input type="number" min={1} max={24} value={value.max_cards} onChange={e => set('max_cards', Math.max(1, Math.min(24, Number(e.target.value) || 1)))} className={inputCls} />
        </Field>
        <Field label="Listing types">
          <div className="flex flex-wrap gap-2 mt-1">
            {([['include_trails', 'Trails'], ['include_activities', 'Activities']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => set(key, !value[key])}
                className={`px-3 py-1.5 font-sans text-xs border transition-colors ${value[key] ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Toggle
        label="Auto-fill from season tags"
        desc="After your picks, fill remaining slots with live listings tagged for the season"
        on={value.auto_fill}
        onChange={on => set('auto_fill', on)}
      />
      <Toggle
        label="Region season links"
        desc="Show “Region in season →” links under the cards"
        on={value.show_region_links}
        onChange={on => set('show_region_links', on)}
      />

      {/* ── Per-season settings ── */}
      <div className="pt-6 border-t border-gray-100">
        <div className="flex flex-wrap gap-0 border-b border-gray-200 mb-5">
          {SEASONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { setTab(s); setQuery('') }}
              className={`px-4 py-2.5 font-sans text-sm -mb-px border-b-2 transition-colors ${tab === s ? 'border-[#2d6a4f] text-[#2d6a4f] font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {SEASON_META[s].label}
              {s === current && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[#C9A96E]">live</span>}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          <Field label={`${SEASON_META[tab].label} blurb`} hint="Leave blank to use the default shown as the placeholder.">
            <textarea
              value={value.blurbs[tab] ?? ''}
              onChange={e => onChange({ ...value, blurbs: { ...value.blurbs, [tab]: e.target.value } })}
              placeholder={SEASON_META[tab].blurb}
              rows={2}
              className={textareaCls}
            />
          </Field>

          <Field label={`Hand-picked for ${SEASON_META[tab].label.toLowerCase()} (shown first, in this order)`}>
            {loading ? (
              <p className="flex items-center gap-2 font-sans text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading listings…</p>
            ) : (
              <div className="space-y-2">
                {pinned.length === 0 && <p className="font-sans text-xs text-gray-400">No hand-picked listings yet.</p>}
                {pinned.map((ref, i) => {
                  const entry = byRef.get(ref)
                  return (
                    <div key={ref} className="flex items-center gap-3 border border-gray-200 px-3 py-2">
                      <Pin size={12} className="text-[#C9A96E] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm text-gray-800 truncate">{entry ? itemLabel(entry) : ref}</p>
                        <p className="font-sans text-xs text-gray-400">{entry ? itemMeta(entry) : 'Listing no longer exists'}</p>
                      </div>
                      <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === pinned.length - 1} className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-30"><ArrowDown size={14} /></button>
                      <button type="button" aria-label="Remove" onClick={() => setPinned(pinned.filter(r => r !== ref))} className="p-1 text-gray-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  )
                })}
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search trails and activities to add…"
                  className={inputCls}
                />
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 divide-y divide-gray-100">
                    {searchResults.map(e => (
                      <button
                        key={itemRef(e)}
                        type="button"
                        onClick={() => { setPinned([...pinned, itemRef(e)]); setQuery('') }}
                        className="w-full text-left px-3 py-2 hover:bg-[#F7F5F2]"
                      >
                        <p className="font-sans text-sm text-gray-800">{itemLabel(e)}</p>
                        <p className="font-sans text-xs text-gray-400">{itemMeta(e)}</p>
                      </button>
                    ))}
                  </div>
                )}
                {q && searchResults.length === 0 && <p className="font-sans text-xs text-gray-400">No matching listings.</p>}
              </div>
            )}
          </Field>

          {!loading && (
            <Field label={`Tagged for ${SEASON_META[tab].label.toLowerCase()} (${tagged.length})`} hint="Listings whose own season tags include this season. Hide one to keep it out of this band everywhere.">
              {tagged.length === 0 ? (
                <p className="font-sans text-xs text-gray-400">No listings are tagged for this season. Tag them on the trail or activity edit pages.</p>
              ) : (
                <div className="border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {tagged.map(e => {
                    const ref = itemRef(e)
                    const hidden = value.excluded.includes(ref)
                    return (
                      <div key={ref} className={`flex items-center gap-3 px-3 py-2 ${hidden ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-sm text-gray-800 truncate">{itemLabel(e)}</p>
                          <p className="font-sans text-xs text-gray-400">{itemMeta(e)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExcluded(ref)}
                          className="inline-flex items-center gap-1.5 font-sans text-xs text-gray-500 hover:text-[#2d6a4f]"
                        >
                          {hidden ? <><EyeOff size={13} /> Hidden</> : <><Eye size={13} /> Shown</>}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </Field>
          )}

          {!loading && (
            <Field label={`Preview — ${SEASON_META[tab].label}`}>
              <div className="bg-[#F7F5F2] border border-gray-200 p-4">
                <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gray-400">{copy.eyebrow}</p>
                <p className="font-sans font-semibold text-lg text-gray-900 mt-1">{copy.heading}</p>
                <p className="font-sans text-sm text-gray-500 mt-1">{copy.blurb}</p>
                {!value.enabled ? (
                  <p className="font-sans text-xs text-gray-400 mt-3">The band is switched off and won’t show on the homepage.</p>
                ) : preview.length === 0 ? (
                  <p className="font-sans text-xs text-gray-400 mt-3">Nothing qualifies, so the band will be hidden for this season.</p>
                ) : (
                  <ol className="mt-3 space-y-1 list-decimal list-inside">
                    {preview.map(e => (
                      <li key={itemRef(e)} className="font-sans text-sm text-gray-700">
                        {itemLabel(e)} <span className="text-xs text-gray-400">({e.kind === 'trail' ? 'Trail' : 'Activity'}{pinned.includes(itemRef(e)) ? ', hand-picked' : ''})</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Field>
          )}
        </div>
      </div>
    </div>
  )
}
