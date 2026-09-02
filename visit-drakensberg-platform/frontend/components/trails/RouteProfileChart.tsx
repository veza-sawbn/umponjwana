'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Home } from 'lucide-react'
import type { Trail } from '@/lib/trails'
import type { GpxPoint, TrailWaypoint } from '@/lib/gpx'
import MapboxRouteMap from './MapboxRouteMap'

// Clean, GPX-driven height profile: elevation over distance, x-axis in km,
// y-axis in metres with gridlines, and named waypoints marked along the
// curve with leader lines — the same "hike-guide profile" convention as a
// printed trail-guide elevation diagram (numbered points of interest keyed
// off the trail's own GPX waypoints), plus a draggable circular marker that
// reads off elevation at any point along the route. Deliberately a single
// trail-green fill throughout — no colour-coding by slope/gradient.
// "Map View" is a plain, pannable/zoomable Mapbox map (MapboxRouteMap) with
// the route drawn on it. Renders for any trail with GPX track data — day
// hike, multi-day, or speciality walk alike.

const VIEW_W = 640
const VIEW_H = 260
const PAD_LEFT = 8
const PAD_RIGHT = 10
const PAD_TOP = 96 // label lane for angled waypoint names
const PAD_BOTTOM = 28
const MIN_LABEL_GAP_PX = 42 // viewBox units — skip a label if it would crowd the previous one

type WaypointMark = { id: string; name: string; category: TrailWaypoint['category']; distanceKm: number; ele: number }

function nearestPoint(points: GpxPoint[], km: number): GpxPoint {
  let lo = 0, hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].distanceKm < km) lo = mid + 1
    else hi = mid
  }
  return points[lo]
}

/** "Nice" round tick step (1/2/5 × 10^n) for an axis spanning `range` over roughly `count` ticks. */
function niceStep(range: number, count: number): number {
  if (range <= 0) return 1
  const rough = range / count
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * mag
}

function fmtKm(km: number) { return `${km.toFixed(km < 10 ? 1 : 0)} km` }
function fmtM(m: number) { return `${Math.round(m)} m` }

export default function RouteProfileChart({ trail }: { trail: Trail }) {
  const analysis = trail.analytics
  const points = analysis?.points ?? []
  const [view, setView] = useState<'elevation' | 'route'>('elevation')
  const [dragging, setDragging] = useState(false)
  const [scrubKm, setScrubKm] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  const totalKm = analysis?.statistics.totalDistanceKm || points[points.length - 1]?.distanceKm || 0
  const minE = analysis?.statistics.minimumElevationM ?? Math.min(...points.map(p => p.ele))
  const maxE = analysis?.statistics.maximumElevationM ?? Math.max(...points.map(p => p.ele))

  const xForKm = useCallback(
    (km: number) => PAD_LEFT + (totalKm ? km / totalKm : 0) * (VIEW_W - PAD_LEFT - PAD_RIGHT),
    [totalKm],
  )
  const yForEle = useCallback(
    (ele: number) => VIEW_H - PAD_BOTTOM - ((ele - minE) / (maxE - minE || 1)) * (VIEW_H - PAD_TOP - PAD_BOTTOM),
    [minE, maxE],
  )

  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' }
    const line = points.map((p, i) => `${i ? 'L' : 'M'} ${xForKm(p.distanceKm).toFixed(1)} ${yForEle(p.ele).toFixed(1)}`).join(' ')
    const area = `${line} L ${xForKm(totalKm).toFixed(1)} ${VIEW_H - PAD_BOTTOM} L ${xForKm(0).toFixed(1)} ${VIEW_H - PAD_BOTTOM} Z`
    return { linePath: line, areaPath: area }
  }, [points, totalKm, xForKm, yForEle])

  const rawWaypoints = trail.waypoints ?? analysis?.waypoints ?? []

  // Waypoints projected onto the drawn curve — snapped to the nearest track
  // point (by lat/lon) so a marker always sits exactly on the plotted line
  // rather than at the waypoint's own (possibly slightly off) recorded
  // elevation. Numbered in distance order, same convention as a trail-guide
  // profile diagram keyed to numbered points on a map.
  const waypointMarks: WaypointMark[] = useMemo(() => {
    const wps = rawWaypoints
    if (!points.length || !wps.length) return []
    return wps
      .map(w => {
        let best = points[0], bestD = Infinity
        for (const p of points) {
          const d = (p.lat - w.lat) ** 2 + (p.lon - w.lon) ** 2
          if (d < bestD) { bestD = d; best = p }
        }
        return { id: w.id, name: w.name, category: w.category, distanceKm: best.distanceKm, ele: best.ele }
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [trail.waypoints, analysis?.waypoints, points])

  // Thin out labels (not markers) that would overlap at this chart width —
  // every waypoint still gets a numbered dot, only crowded labels are hidden.
  const labelledIds = useMemo(() => {
    let lastX = -Infinity
    const ids = new Set<string>()
    for (const m of waypointMarks) {
      const x = xForKm(m.distanceKm)
      if (x - lastX < MIN_LABEL_GAP_PX) continue
      lastX = x
      ids.add(m.id)
    }
    return ids
  }, [waypointMarks, xForKm])

  const eStep = niceStep(maxE - minE, 4)
  const eTicks = useMemo(() => {
    if (!Number.isFinite(eStep) || eStep <= 0) return []
    const start = Math.ceil(minE / eStep) * eStep
    const out: number[] = []
    for (let v = start; v <= maxE + 0.01; v += eStep) out.push(v)
    return out
  }, [minE, maxE, eStep])

  if (points.length === 0 || totalKm === 0) return null

  const current = nearestPoint(points, scrubKm)
  const markerPos = { x: xForKm(current.distanceKm), y: yForEle(current.ele) }

  function scrubFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // The SVG stretches its VIEW_W-wide viewBox uniformly across rect.width
    // (preserveAspectRatio="none"), so a pointer position first needs to be
    // expressed in that same viewBox space before the chart's left/right
    // padding can be subtracted out — the plotted line only runs from
    // PAD_LEFT to VIEW_W - PAD_RIGHT, not edge to edge.
    const xInViewBox = ((clientX - rect.left) / rect.width) * VIEW_W
    const plotWidth = VIEW_W - PAD_LEFT - PAD_RIGHT
    const ratio = Math.max(0, Math.min(1, (xInViewBox - PAD_LEFT) / plotWidth))
    setScrubKm(ratio * totalKm)
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    scrubFromClientX(e.clientX)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    scrubFromClientX(e.clientX)
  }
  function onPointerUp(e: React.PointerEvent) {
    setDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  const tickCount = 5
  const ticks = Array.from({ length: tickCount }, (_, i) => (totalKm / (tickCount - 1)) * i)

  return (
    <div className="bg-white border border-gray-200 p-4">
      {/* View toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-[#F7F5F2] p-1">
          {(['elevation', 'route'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`font-sans text-xs px-3 py-1.5 transition-colors ${
                view === v ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:text-[#2d6a4f]'
              }`}
            >
              {v === 'elevation' ? 'Elevation Profile' : 'Map View'}
            </button>
          ))}
        </div>
        {view === 'elevation' && (
          <div className="text-right">
            <p className="font-display italic text-lg text-[#2d6a4f] leading-none">{fmtM(current.ele)}</p>
            <p className="font-sans text-[10px] text-gray-400">at {fmtKm(current.distanceKm)}</p>
          </div>
        )}
      </div>

      {view === 'route' ? (
        <MapboxRouteMap points={points} waypoints={rawWaypoints} />
      ) : (
        <>
          <div className="flex gap-2">
            {/* Y-axis altitude labels — plain HTML so figures never get
                skewed by the SVG's non-uniform (preserveAspectRatio="none")
                stretch. */}
            <div className="relative w-9 shrink-0 h-56 sm:h-72">
              <span className="absolute top-0 left-0 font-sans text-[8px] tracking-[0.1em] uppercase text-gray-300">Alt. m</span>
              {eTicks.map((e, i) => (
                <span
                  key={i}
                  className="absolute right-0 -translate-y-1/2 font-sans text-[9px] text-gray-400 whitespace-nowrap"
                  style={{ top: `${(yForEle(e) / VIEW_H) * 100}%` }}
                >
                  {Math.round(e).toLocaleString()}
                </span>
              ))}
            </div>

            {/* Draggable chart */}
            <div
              ref={trackRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="relative flex-1 min-w-0 touch-none cursor-ew-resize select-none h-56 sm:h-72"
            >
              <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="rp-elev-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.03" />
                  </linearGradient>
                  {/* Faint diagonal hatch over the fill — texture only, one
                      colour, no slope/gradient colour-coding. */}
                  <pattern id="rp-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="7" stroke="#2d6a4f" strokeWidth="1" opacity="0.16" />
                  </pattern>
                </defs>

                {/* Gridlines */}
                {ticks.map((km, i) => (
                  <line key={`ex-${i}`} x1={xForKm(km)} x2={xForKm(km)} y1={PAD_TOP} y2={VIEW_H - PAD_BOTTOM}
                    stroke="#00000010" strokeWidth="1" />
                ))}
                {eTicks.map((e, i) => (
                  <line key={`ey-${i}`} x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={yForEle(e)} y2={yForEle(e)}
                    stroke="#00000010" strokeWidth="1" />
                ))}

                <path d={areaPath} fill="url(#rp-elev-grad)" />
                <path d={areaPath} fill="url(#rp-hatch)" />
                <path d={linePath} fill="none" stroke="#2d6a4f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                {/* Waypoint leader ticks — the labels/markers themselves are
                    HTML-overlaid below, so their text is never stretched. */}
                {waypointMarks.map(m => {
                  const x = xForKm(m.distanceKm)
                  const y = yForEle(m.ele)
                  return (
                    <line key={m.id} x1={x} x2={x} y1={PAD_TOP - 4} y2={y}
                      stroke={m.category === 'Peak' || m.category === 'Summit' ? '#C9A96E' : '#00000030'}
                      strokeWidth="1" strokeDasharray="2 2" />
                  )
                })}

                {/* Scrub guide + marker */}
                <line x1={markerPos.x} x2={markerPos.x} y1={PAD_TOP} y2={VIEW_H - PAD_BOTTOM}
                  stroke="#C9A96E" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx={markerPos.x} cy={markerPos.y} r={dragging ? 8 : 6.5} fill="#C9A96E" stroke="#fff" strokeWidth="2" />
              </svg>

              {/* Waypoint markers + angled name labels (HTML overlay —
                  immune to the SVG's non-uniform stretch, so rotated text
                  stays crisp). */}
              {waypointMarks.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {waypointMarks.map((m, i) => {
                    const leftPct = (xForKm(m.distanceKm) / VIEW_W) * 100
                    const topPct = (yForEle(m.ele) / VIEW_H) * 100
                    const isPeak = m.category === 'Peak' || m.category === 'Summit'
                    const isHut = m.category === 'Shelter'
                    return (
                      <div key={m.id}>
                        {isHut ? (
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 bg-[#2d6a4f] text-white rounded-full p-1 shadow-sm"
                            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          >
                            <Home size={9} strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div
                            className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full text-white font-sans font-semibold ${isPeak ? 'bg-[#C9A96E]' : 'bg-[#2d6a4f]'}`}
                            style={{ left: `${leftPct}%`, top: `${topPct}%`, width: 13, height: 13, fontSize: 7 }}
                          >
                            {i + 1}
                          </div>
                        )}
                        {labelledIds.has(m.id) && (
                          <div
                            className={`hidden sm:block absolute font-sans whitespace-nowrap ${isPeak ? 'text-[#8a6d3b] font-medium' : 'text-gray-600'}`}
                            style={{
                              left: `${leftPct}%`,
                              top: `${((PAD_TOP - 6) / VIEW_H) * 100}%`,
                              fontSize: 10,
                              transform: 'translateX(-2px) rotate(-55deg)',
                              transformOrigin: 'left bottom',
                            }}
                          >
                            {m.name}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* x-axis distance labels */}
          <div className="flex justify-between font-sans text-[10px] text-gray-400 mt-1 pl-11 pr-1">
            {ticks.map((km, i) => <span key={i}>{fmtKm(km)}</span>)}
          </div>
        </>
      )}

      <p className="font-sans text-xs text-gray-400 mt-2">
        {view === 'elevation'
          ? 'Drag the marker — or tap anywhere on the chart — to read elevation at any distance along the trail. Numbered points mark waypoints along the route.'
          : 'Pan and zoom to explore the route.'}
      </p>
    </div>
  )
}
