'use client'
import { useEffect, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { GpxPoint } from '@/lib/gpx'

// A real, pannable/zoomable Mapbox GL map with the GPX track drawn as a
// vector line layer — replaces the old raster Static Images approach for
// Map View. mapbox-gl is imported dynamically inside the effect below (not
// at module scope) so its ~200KB isn't paid for by anyone who never opens
// Map View, and so nothing touches WebGL/the DOM during SSR.
//
// The scrub marker stays in sync with whatever position the Elevation
// Profile's scrubber is at (`current`), and — the actual point of this
// component over a static image — clicking anywhere on the map snaps that
// same scrub position to the nearest point on the route, so the two views
// drive each other rather than the map being a one-way illustration.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// TEMPORARY — live debugging a "canvas exists, correctly sized, no errors,
// but nothing paints" report that's been hard to pin down from screenshots
// alone. Shows the exact stage the map init reached, on-screen, in text —
// remove once resolved.
type DebugPhase =
  | 'importing mapbox-gl'
  | 'constructing map'
  | `waiting on 'load' (canvas ${string})`
  | `ready — canvas ${string}, webgl: ${string}`
  | `error: ${string}`

export default function MapboxRouteMap({
  points,
  current,
  onScrub,
  onFailed,
}: {
  points: GpxPoint[]
  current: GpxPoint
  onScrub?: (distanceKm: number) => void
  onFailed?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const markerRef = useRef<import('mapbox-gl').Marker | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [ready, setReady] = useState(false)
  const [debugPhase, setDebugPhase] = useState<DebugPhase>('importing mapbox-gl')

  // Mount the map once per `points` identity (i.e. once per trail — the
  // parent remounts this whole chart on trail change via key={trail.id}).
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || points.length === 0) {
      onFailed?.()
      return
    }

    let cancelled = false

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled || !containerRef.current) return
      mapboxgl.accessToken = MAPBOX_TOKEN
      setDebugPhase('constructing map')
      console.debug('[MapboxRouteMap] mapbox-gl loaded, container rect at construction:', containerRef.current.getBoundingClientRect())

      const lats = points.map(p => p.lat), lons = points.map(p => p.lon)
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ]
      // Deliberately NOT passing `bounds` to the constructor: mapbox-gl
      // computes the fitted camera synchronously against the container's
      // size at that exact instant, and immediately after mount that can
      // still be 0×0 (layout not yet settled) — silently producing an
      // invalid camera and a permanently blank canvas, even though the
      // style itself loads fine. Constructing with a plain default camera
      // and calling resize() + fitBounds() only once the map has actually
      // loaded (and the container is guaranteed painted) avoids that.
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
        zoom: 10,
      })
      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      // Logged rather than swallowed — a bad/misscoped/URL-restricted token
      // surfaces here as a 401/403 from api.mapbox.com with a specific
      // Mapbox error message, not as a generic failure.
      map.on('error', (e) => {
        const msg = String((e.error as Error | undefined)?.message ?? e.error ?? 'unknown')
        console.error('[MapboxRouteMap] map error event:', e.error ?? e)
        setDebugPhase(`error: ${msg}`)
        if (!cancelled) onFailed?.()
      })

      // Belt-and-suspenders against any later layout shift (web fonts
      // reflowing the page, orientation change, the tab becoming visible
      // after being laid out while hidden) — mapbox-gl never re-measures
      // its container on its own, so without this a resize can leave the
      // canvas stale or blank until the user manually pans/zooms it.
      const resizeObserver = new ResizeObserver(() => map.resize())
      resizeObserver.observe(containerRef.current)
      resizeObserverRef.current = resizeObserver

      const canvasSize = () => `${map.getCanvas().width}x${map.getCanvas().height}`
      setDebugPhase(`waiting on 'load' (canvas ${canvasSize()})`)
      console.debug('[MapboxRouteMap] map constructed, waiting for load event. Canvas:', canvasSize())

      map.on('load', () => {
        if (cancelled) return
        console.debug('[MapboxRouteMap] load event fired. Canvas before resize/fitBounds:', canvasSize())
        map.resize()
        map.fitBounds(bounds, { padding: 48, animate: false })
        console.debug('[MapboxRouteMap] Canvas after resize/fitBounds:', canvasSize())

        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map(p => [p.lon, p.lat]) } },
        })
        // White casing under the green line for legibility over terrain —
        // same convention as everywhere else this route gets drawn.
        map.addLayer({
          id: 'route-casing', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 },
        })
        map.addLayer({
          id: 'route-line', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2d6a4f', 'line-width': 3.5 },
        })

        const el = document.createElement('div')
        el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#C9A96E;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)'
        markerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([current.lon, current.lat]).addTo(map)

        if (onScrub) {
          map.on('click', e => {
            let best = points[0], bestD = Infinity
            for (const p of points) {
              const d = (p.lat - e.lngLat.lat) ** 2 + (p.lon - e.lngLat.lng) ** 2
              if (d < bestD) { bestD = d; best = p }
            }
            onScrub(best.distanceKm)
          })
          map.on('mouseenter', 'route-line', () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', 'route-line', () => { map.getCanvas().style.cursor = '' })
        }

        const canvas = map.getCanvas()
        const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
        const webglStatus = gl ? (gl.isContextLost() ? 'lost' : 'ok') : 'missing'
        console.debug('[MapboxRouteMap] ready. Final canvas:', canvasSize(), 'WebGL context:', webglStatus)
        setDebugPhase(`ready — canvas ${canvasSize()}, webgl: ${webglStatus}`)
        setReady(true)
      })
    }).catch((err) => {
      console.error('[MapboxRouteMap] failed to load mapbox-gl or initialise the map', err)
      setDebugPhase(`error: ${String(err)}`)
      if (!cancelled) onFailed?.()
    })

    return () => {
      cancelled = true
      resizeObserverRef.current?.disconnect()
      markerRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Deliberately keyed only on the point set (one trail) — `current` and
    // `onScrub` are handled by the effect below / the closure above without
    // tearing the map down and refetching tiles on every scrub.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  // Keep the marker synced to the scrubber without recreating the map.
  useEffect(() => {
    markerRef.current?.setLngLat([current.lon, current.lat])
  }, [current])

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#e9e5dc] font-sans text-xs text-gray-400">
          Loading map…
        </div>
      )}
      {/* TEMPORARY debug readout — remove once the blank-map report is resolved. */}
      <div className="absolute top-1 left-1 z-50 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9px] leading-tight text-lime-300 pointer-events-none">
        {debugPhase}
      </div>
    </>
  )
}
