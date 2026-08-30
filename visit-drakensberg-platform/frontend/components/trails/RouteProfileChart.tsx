'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Trail } from '@/lib/trails'
import type { GpxPoint } from '@/lib/gpx'

// Clean, GPX-driven height profile: elevation over distance, x-axis in km,
// with a draggable circular marker that reads off elevation at any point
// along the route. "Route Profile" swaps the same marker onto a top-down
// trace of the actual path (still driven by the same distance scrubber),
// so both views answer "where am I / how high am I" the same way.

const VIEW_W = 640
const VIEW_H = 220
const PAD_LEFT = 40
const PAD_RIGHT = 14
const PAD_TOP = 16
const PAD_BOTTOM = 30

function nearestPoint(points: GpxPoint[], km: number): GpxPoint {
  let lo = 0, hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].distanceKm < km) lo = mid + 1
    else hi = mid
  }
  return points[lo]
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

  const { linePath, areaPath, routePath, routeXY } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '', routePath: '', routeXY: () => ({ x: 0, y: 0 }) }
    const lats = points.map(p => p.lat), lons = points.map(p => p.lon)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const rx = (lon: number) => PAD_LEFT + ((lon - minLon) / (maxLon - minLon || 1)) * (VIEW_W - PAD_LEFT - PAD_RIGHT)
    const ry = (lat: number) => VIEW_H - PAD_BOTTOM - ((lat - minLat) / (maxLat - minLat || 1)) * (VIEW_H - PAD_TOP - PAD_BOTTOM)

    const line = points.map((p, i) => `${i ? 'L' : 'M'} ${xForKm(p.distanceKm).toFixed(1)} ${yForEle(p.ele).toFixed(1)}`).join(' ')
    const area = `${line} L ${xForKm(totalKm).toFixed(1)} ${VIEW_H - PAD_BOTTOM} L ${xForKm(0).toFixed(1)} ${VIEW_H - PAD_BOTTOM} Z`
    const route = points.map((p, i) => `${i ? 'L' : 'M'} ${rx(p.lon).toFixed(1)} ${ry(p.lat).toFixed(1)}`).join(' ')

    return { linePath: line, areaPath: area, routePath: route, routeXY: (p: GpxPoint) => ({ x: rx(p.lon), y: ry(p.lat) }) }
  }, [points, totalKm, xForKm, yForEle])

  if (points.length === 0 || totalKm === 0) return null

  const current = nearestPoint(points, scrubKm)
  const markerPos = view === 'elevation'
    ? { x: xForKm(current.distanceKm), y: yForEle(current.ele) }
    : routeXY(current)

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
              {v === 'elevation' ? 'Elevation Profile' : 'Route Profile'}
            </button>
          ))}
        </div>
        <div className="text-right">
          <p className="font-display italic text-lg text-[#2d6a4f] leading-none">{fmtM(current.ele)}</p>
          <p className="font-sans text-[10px] text-gray-400">at {fmtKm(current.distanceKm)}</p>
        </div>
      </div>

      {/* Draggable chart / map */}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative touch-none cursor-ew-resize select-none"
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-40 sm:h-48" preserveAspectRatio="none">
          <defs>
            <linearGradient id="rp-elev-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {view === 'elevation' ? (
            <>
              {/* Gridlines at each x tick */}
              {ticks.map((km, i) => (
                <line key={i} x1={xForKm(km)} x2={xForKm(km)} y1={PAD_TOP} y2={VIEW_H - PAD_BOTTOM}
                  stroke="#00000010" strokeWidth="1" />
              ))}
              <path d={areaPath} fill="url(#rp-elev-grad)" />
              <path d={linePath} fill="none" stroke="#2d6a4f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            <path d={routePath} fill="none" stroke="#2d6a4f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Scrub guide + marker */}
          <line x1={markerPos.x} x2={markerPos.x} y1={PAD_TOP} y2={VIEW_H - PAD_BOTTOM}
            stroke="#C9A96E" strokeWidth="1.5" strokeDasharray="3 3" opacity={view === 'elevation' ? 1 : 0} />
          <circle cx={markerPos.x} cy={markerPos.y} r={dragging ? 8 : 6.5} fill="#C9A96E" stroke="#fff" strokeWidth="2" />
        </svg>

        {/* x-axis distance labels (elevation view only — a map has no linear axis) */}
        {view === 'elevation' && (
          <div className="flex justify-between font-sans text-[10px] text-gray-400 mt-1 px-1">
            {ticks.map((km, i) => <span key={i}>{fmtKm(km)}</span>)}
          </div>
        )}
      </div>

      <p className="font-sans text-xs text-gray-400 mt-2">
        {view === 'elevation'
          ? 'Drag the marker — or tap anywhere on the chart — to read elevation at any distance along the trail.'
          : 'Drag across the route to see where you are and how high, at any distance along the trail.'}
      </p>
    </div>
  )
}
