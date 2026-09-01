'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Home } from 'lucide-react'
import type { Trail } from '@/lib/trails'
import type { GpxPoint, TrailWaypoint } from '@/lib/gpx'

// Clean, GPX-driven height profile: elevation over distance, x-axis in km,
// y-axis in metres with gridlines, and named waypoints marked along the
// curve with leader lines — the same "hike-guide profile" convention as a
// printed trail-guide elevation diagram (numbered points of interest keyed
// off the trail's own GPX waypoints), plus a draggable circular marker that
// reads off elevation at any point along the route. Deliberately a single
// trail-green fill throughout — no colour-coding by slope/gradient.
// "Map View" swaps the same marker onto the actual route traced over a
// real Mapbox outdoors/terrain tile (still driven by the same distance
// scrubber), so both views answer "where am I / how high am I" the same
// way. Renders for any trail with GPX track data — day hike, multi-day, or
// speciality walk alike.

const VIEW_W = 640
const VIEW_H = 260
const PAD_LEFT = 8
const PAD_RIGHT = 10
const PAD_TOP = 96 // label lane for angled waypoint names
const PAD_BOTTOM = 28
const MIN_LABEL_GAP_PX = 42 // viewBox units — skip a label if it would crowd the previous one

// Map view is a fixed-aspect box (rather than the elevation chart's
// stretch-to-fill box) so the underlying satellite/terrain image is never
// distorted.
const MAP_W = 640
const MAP_H = 400
// Generous margin around the fitted bounds — protects short/tight trails
// (where the fit-bounds zoom is high) from the line's own stroke width, the
// scrub marker's radius, or a switchback's chord momentarily poking past a
// bounding box drawn with zero breathing room.
const MAP_PAD = 40

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const MAPBOX_STYLE = 'mapbox/outdoors-v12' // built for exactly this — trails, contours, terrain shading

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

// ── Web Mercator projection — the same EPSG:3857 projection every slippy-
// map provider (Mapbox, Google, OSM) renders its tiles in, so a route drawn
// with these formulas lines up with the fetched map tile underneath
// regardless of which provider it came from. 256px tiles, standard
// world-coordinate conversion.
const TILE_SIZE = 256
function mercatorWorld(lat: number, lng: number) {
  const siny = Math.min(Math.max(Math.sin(lat * Math.PI / 180), -0.9999), 0.9999)
  return {
    x: TILE_SIZE / 2 + lng * (TILE_SIZE / 360),
    y: TILE_SIZE / 2 + 0.5 * Math.log((1 + siny) / (1 - siny)) * -(TILE_SIZE / (2 * Math.PI)),
  }
}
function latRad(lat: number) {
  const sin = Math.sin(lat * Math.PI / 180)
  const rad = Math.log((1 + sin) / (1 - sin)) / 2
  return Math.max(Math.min(rad, Math.PI), -Math.PI) / 2
}
/** Integer zoom that fits a lat/lon bounding box inside w×h (minus padding) — same "fit bounds" math Google Maps itself uses. */
function zoomForBounds(minLat: number, maxLat: number, minLon: number, maxLon: number, w: number, h: number, pad: number): number {
  const ZOOM_MAX = 18
  const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI
  let lonDiff = maxLon - minLon
  if (lonDiff < 0) lonDiff += 360
  const lonFraction = lonDiff / 360
  const zoomFor = (px: number, fraction: number) => (fraction > 0 ? Math.floor(Math.log2(px / TILE_SIZE / fraction)) : ZOOM_MAX)
  const latZoom = zoomFor(h - pad * 2, latFraction)
  const lonZoom = zoomFor(w - pad * 2, lonFraction)
  return Math.max(1, Math.min(latZoom, lonZoom, ZOOM_MAX))
}

// ── Server-drawn route line — the GPX track is encoded and handed to
// Mapbox as a path overlay so *Mapbox itself* renders the line, in its own
// projection, directly against its own basemap. That guarantees pixel-exact
// alignment with the terrain — reconstructing Mapbox's rendering client-side
// (as the line used to be drawn) only ever approximates it. Only the single
// draggable scrub marker still uses the client-side projection (mapXY
// below), since re-fetching a static image on every pointer-move isn't
// viable — so the marker is snapped to the nearest vertex of this exact
// same decimated point set (see decimatedPoints below) rather than the
// full-resolution track, guaranteeing it always lands on a point Mapbox
// actually rendered instead of one a dropped-for-decimation stretch of
// line only approximates.
const MAX_PATH_POINTS = 800 // well under Mapbox's URL length limit even doubled (casing + line)

function decimate<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr
  const stride = Math.ceil(arr.length / maxPoints)
  const out: T[] = []
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i])
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1])
  return out
}

/** Standard Google/Mapbox polyline encoding (precision 1e5). */
function encodePolyline(coords: [number, number][]): string {
  let output = ''
  let prevLat = 0, prevLng = 0
  const encodeNumber = (num: number) => {
    let n = num, out = ''
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63)
      n >>= 5
    }
    return out + String.fromCharCode(n + 63)
  }
  for (const [lat, lng] of coords) {
    const lat5 = Math.round(lat * 1e5)
    const lng5 = Math.round(lng * 1e5)
    for (const delta of [lat5 - prevLat, lng5 - prevLng]) {
      const sgn = delta < 0 ? ~(delta << 1) : delta << 1
      output += encodeNumber(sgn)
    }
    prevLat = lat5
    prevLng = lng5
  }
  return output
}

function fmtKm(km: number) { return `${km.toFixed(km < 10 ? 1 : 0)} km` }
function fmtM(m: number) { return `${Math.round(m)} m` }

export default function RouteProfileChart({ trail }: { trail: Trail }) {
  const analysis = trail.analytics
  const points = analysis?.points ?? []
  const [view, setView] = useState<'elevation' | 'route'>('elevation')
  const [dragging, setDragging] = useState(false)
  const [scrubKm, setScrubKm] = useState(0)
  const [mapImgFailed, setMapImgFailed] = useState(false)
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

  // Real map geometry: centre + integer zoom that fits the whole track,
  // used both for the Static Maps image URL and for projecting every point
  // onto that same image.
  const mapGeo = useMemo(() => {
    if (points.length === 0) return null
    const lats = points.map(p => p.lat), lons = points.map(p => p.lon)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const center = { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 }
    const zoom = zoomForBounds(minLat, maxLat, minLon, maxLon, MAP_W, MAP_H, MAP_PAD)
    return { center, zoom }
  }, [points])

  const mapXY = useCallback((lat: number, lng: number) => {
    if (!mapGeo) return { x: MAP_W / 2, y: MAP_H / 2 }
    const scale = 2 ** mapGeo.zoom
    const centerWorld = mercatorWorld(mapGeo.center.lat, mapGeo.center.lng)
    const world = mercatorWorld(lat, lng)
    return { x: (world.x - centerWorld.x) * scale + MAP_W / 2, y: (world.y - centerWorld.y) * scale + MAP_H / 2 }
  }, [mapGeo])

  // The exact same decimated point set feeds both the server-drawn overlay
  // below and the marker snapping further down — so the marker can only
  // ever land on a vertex Mapbox actually rendered, never on a
  // full-resolution point a dropped-for-decimation stretch only approximates.
  const decimatedPoints = useMemo(() => decimate(points, MAX_PATH_POINTS), [points])

  // White casing + green line, drawn server-side by Mapbox against its own
  // basemap — see the comment above encodePolyline for why.
  const pathOverlay = useMemo(() => {
    if (decimatedPoints.length < 2) return ''
    const encoded = encodeURIComponent(encodePolyline(decimatedPoints.map(p => [p.lat, p.lon])))
    return `path-5+ffffff-0.85(${encoded}),path-3+2d6a4f-1(${encoded})`
  }, [decimatedPoints])

  const staticMapUrl = mapGeo && MAPBOX_TOKEN && pathOverlay
    ? `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/static/${pathOverlay}/${mapGeo.center.lng},${mapGeo.center.lat},${mapGeo.zoom}/${MAP_W}x${MAP_H}@2x?access_token=${encodeURIComponent(MAPBOX_TOKEN)}`
    : null
  const useRealMap = view === 'route' && !!staticMapUrl && !mapImgFailed

  // Bounding-box fallback trace (no API key, or the image failed to load) —
  // a schematic top-down line, not a real map, same as before this feature.
  const routeFallback = useMemo(() => {
    if (points.length === 0) return { path: '', xy: (_p: GpxPoint) => ({ x: 0, y: 0 }) }
    const lats = points.map(p => p.lat), lons = points.map(p => p.lon)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const rx = (lon: number) => MAP_PAD + ((lon - minLon) / (maxLon - minLon || 1)) * (MAP_W - MAP_PAD * 2)
    const ry = (lat: number) => MAP_H - MAP_PAD - ((lat - minLat) / (maxLat - minLat || 1)) * (MAP_H - MAP_PAD * 2)
    const path = points.map((p, i) => `${i ? 'L' : 'M'} ${rx(p.lon).toFixed(1)} ${ry(p.lat).toFixed(1)}`).join(' ')
    return { path, xy: (p: GpxPoint) => ({ x: rx(p.lon), y: ry(p.lat) }) }
  }, [points])

  // Waypoints projected onto the drawn curve — snapped to the nearest track
  // point (by lat/lon) so a marker always sits exactly on the plotted line
  // rather than at the waypoint's own (possibly slightly off) recorded
  // elevation. Numbered in distance order, same convention as a trail-guide
  // profile diagram keyed to numbered points on a map.
  const waypointMarks: WaypointMark[] = useMemo(() => {
    const wps = trail.waypoints ?? analysis?.waypoints ?? []
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
  // On the real map, snap to the nearest point Mapbox actually drew (the
  // decimated set), not the full-resolution track — otherwise the marker
  // can land on a stretch of line decimation dropped, appearing to sit off
  // the rendered path.
  const mapCurrent = decimatedPoints.length ? nearestPoint(decimatedPoints, scrubKm) : current
  const markerPos = view === 'elevation'
    ? { x: xForKm(current.distanceKm), y: yForEle(current.ele) }
    : useRealMap ? mapXY(mapCurrent.lat, mapCurrent.lon) : routeFallback.xy(current)

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

  // Only the elevation view is drag-scrubbable — a real map's horizontal
  // pixels don't correspond linearly to distance along a winding trail, so
  // the map view instead just displays wherever the scrubber was last left
  // (see the caption below).
  function onPointerDown(e: React.PointerEvent) {
    if (view !== 'elevation') return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    scrubFromClientX(e.clientX)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || view !== 'elevation') return
    scrubFromClientX(e.clientX)
  }
  function onPointerUp(e: React.PointerEvent) {
    if (view !== 'elevation') return
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
        <div className="text-right">
          <p className="font-display italic text-lg text-[#2d6a4f] leading-none">{fmtM(current.ele)}</p>
          <p className="font-sans text-[10px] text-gray-400">at {fmtKm(current.distanceKm)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {/* Y-axis altitude labels — plain HTML so figures never get skewed by
            the SVG's non-uniform (preserveAspectRatio="none") stretch. Only
            meaningful for the elevation view — the map has no linear axis. */}
        {view === 'elevation' && (
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
        )}

        {/* Draggable chart / map */}
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={
            view === 'elevation'
              ? 'relative flex-1 min-w-0 touch-none cursor-ew-resize select-none h-56 sm:h-72'
              : 'relative flex-1 min-w-0 select-none aspect-[8/5] overflow-hidden rounded-sm bg-[#e9e5dc]'
          }
        >
          {/* Real Mapbox outdoors/terrain tile behind the route trace. Falls
              back silently (onError) to the schematic bounding-box trace if
              the token is missing, unset for this project, or the request
              fails — the interactive scrubber still works either way. */}
          {view === 'route' && staticMapUrl && !mapImgFailed && (
            <img
              src={staticMapUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setMapImgFailed(true)}
            />
          )}

          <svg
            viewBox={view === 'elevation' ? `0 0 ${VIEW_W} ${VIEW_H}` : `0 0 ${MAP_W} ${MAP_H}`}
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio={view === 'elevation' ? 'none' : 'xMidYMid meet'}
          >
            <defs>
              <linearGradient id="rp-elev-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.03" />
              </linearGradient>
              {/* Faint diagonal hatch over the fill — texture only, one colour,
                  no slope/gradient colour-coding. */}
              <pattern id="rp-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="7" stroke="#2d6a4f" strokeWidth="1" opacity="0.16" />
              </pattern>
            </defs>

            {view === 'elevation' ? (
              <>
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
              </>
            ) : useRealMap ? (
              // The route line itself is already baked into the fetched
              // image (drawn by Mapbox, not here) — only the scrub marker
              // is a client-side overlay.
              <circle cx={markerPos.x} cy={markerPos.y} r={dragging ? 8 : 6.5} fill="#C9A96E" stroke="#fff" strokeWidth="2" />
            ) : (
              <>
                <path d={routeFallback.path} fill="none" stroke="#2d6a4f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={markerPos.x} cy={markerPos.y} r={dragging ? 8 : 6.5} fill="#C9A96E" stroke="#fff" strokeWidth="2" />
              </>
            )}
          </svg>

          {/* Waypoint markers + angled name labels (HTML overlay — immune to
              the SVG's non-uniform stretch, so rotated text stays crisp). */}
          {view === 'elevation' && waypointMarks.length > 0 && (
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

          {/* Attribution required by Mapbox's terms of use (in addition to
              the wordmark already baked into the returned image itself). */}
          {useRealMap && (
            <a
              href="https://www.mapbox.com/about/maps/"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-0.5 right-1 font-sans text-[8px] text-white/80 drop-shadow hover:text-white"
            >
              © Mapbox © OpenStreetMap
            </a>
          )}
        </div>
      </div>

      {/* x-axis distance labels (elevation view only — a map has no linear axis) */}
      {view === 'elevation' && (
        <div className="flex justify-between font-sans text-[10px] text-gray-400 mt-1 pl-11 pr-1">
          {ticks.map((km, i) => <span key={i}>{fmtKm(km)}</span>)}
        </div>
      )}

      <p className="font-sans text-xs text-gray-400 mt-2">
        {view === 'elevation'
          ? 'Drag the marker — or tap anywhere on the chart — to read elevation at any distance along the trail. Numbered points mark waypoints along the route.'
          : useRealMap
            ? 'The route traced over the actual terrain — switch to Elevation Profile to scrub the height along it.'
            : 'A schematic trace of the route — switch to Elevation Profile to scrub the height along it.'}
      </p>
    </div>
  )
}
