'use client'
import { useEffect, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { GpxPoint, TrailWaypoint } from '@/lib/gpx'

// A plain, pannable/zoomable Mapbox GL map with the GPX track drawn as a
// line (red, dashed, yellow casing), plus Start/Finish markers. No
// scrub-marker sync, no click-to-jump — just the route on a real map.
//
// The container below uses a fixed inline pixel height, not a Tailwind
// class relying on `aspect-ratio` or an ancestor's flex-derived size. That
// combination was root-caused (via getBoundingClientRect on the live page)
// as the reason an earlier, more elaborate version of this component
// stayed invisible despite loading correctly in every other respect:
// mapbox-gl fills its container with `position: absolute; inset: 0`
// internally, which only resolves against a *definite* parent height, and
// a height purely derived from `aspect-ratio` didn't count as definite
// here — so it silently collapsed to zero instead of stretching. A literal
// pixel value has no such ambiguity.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
// Falls back to Mapbox's own outdoors style if no custom style is set —
// swap in a Mapbox Studio style via NEXT_PUBLIC_MAPBOX_STYLE_URL, format
// mapbox://styles/{username}/{style_id} (Studio → your style → Share →
// Style URL).
const MAPBOX_STYLE_URL = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || 'mapbox://styles/mapbox/outdoors-v12'
const MAP_HEIGHT = 400

function endpointMarker(mapboxgl: typeof import('mapbox-gl').default, label: string, color: string) {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label === 'S' ? 'Start' : 'Finish')
  el.style.cssText = `width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:700 11px/1 'DM Sans',system-ui,sans-serif;color:#fff;`
  el.textContent = label
  return new mapboxgl.Marker({ element: el })
}

export default function MapboxRouteMap({ points, waypoints = [] }: { points: GpxPoint[]; waypoints?: TrailWaypoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || points.length < 2) {
      setFailed(true)
      return
    }

    let cancelled = false

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled || !containerRef.current) return
      mapboxgl.accessToken = MAPBOX_TOKEN

      const lats = points.map(p => p.lat), lons = points.map(p => p.lon)
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ]

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAPBOX_STYLE_URL,
        bounds,
        fitBoundsOptions: { padding: 40 },
      })
      mapRef.current = map

      // Native scroll-to-zoom/pinch-to-zoom/drag-to-pan come from mapbox-gl
      // itself; this just adds the +/- buttons for anyone not using a
      // trackpad or touchscreen.
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      map.on('error', (e) => {
        console.error('[MapboxRouteMap]', e.error ?? e)
        if (!cancelled) setFailed(true)
      })

      map.on('load', () => {
        if (cancelled) return
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map(p => [p.lon, p.lat]) } },
        })
        // Yellow casing (solid) under a red, dashed line on top.
        map.addLayer({
          id: 'route-casing', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#eab308', 'line-width': 6 },
        })
        map.addLayer({
          id: 'route-line', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#dc2626', 'line-width': 3.5, 'line-dasharray': [2, 2] },
        })

        // Start/Finish — use the trail's own GPX waypoints if it already
        // has them (category 'Start'/'Finish'); otherwise fall back to the
        // track's own first/last point.
        const startWp = waypoints.find(w => w.category === 'Start')
        const finishWp = waypoints.find(w => w.category === 'Finish')
        const start = startWp ?? points[0]
        const finish = finishWp ?? points[points.length - 1]

        endpointMarker(mapboxgl, 'S', '#2d6a4f').setLngLat([start.lon, start.lat]).addTo(map)
        endpointMarker(mapboxgl, 'F', '#C9A96E').setLngLat([finish.lon, finish.lat]).addTo(map)
      })
    }).catch((err) => {
      console.error('[MapboxRouteMap] failed to load mapbox-gl or initialise the map', err)
      if (!cancelled) setFailed(true)
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, waypoints])

  if (failed) {
    return (
      <div style={{ height: MAP_HEIGHT }} className="flex items-center justify-center bg-[#e9e5dc] font-sans text-xs text-gray-400">
        Map unavailable
      </div>
    )
  }

  return <div ref={containerRef} style={{ height: MAP_HEIGHT }} className="rounded-sm overflow-hidden" />
}
