'use client'
import { useEffect, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { GpxPoint } from '@/lib/gpx'

// Deliberately minimal: a plain, pannable/zoomable Mapbox GL map on the 2D
// outdoors style, with the GPX track drawn as a line. No scrub-marker sync,
// no click-to-jump — just the route on a real map.
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
const MAP_HEIGHT = 400

export default function MapboxRouteMap({ points }: { points: GpxPoint[] }) {
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
        style: 'mapbox://styles/mapbox/outdoors-v12',
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
        // White casing under the green line for legibility over terrain.
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
  }, [points])

  if (failed) {
    return (
      <div style={{ height: MAP_HEIGHT }} className="flex items-center justify-center bg-[#e9e5dc] font-sans text-xs text-gray-400">
        Map unavailable
      </div>
    )
  }

  return <div ref={containerRef} style={{ height: MAP_HEIGHT }} className="rounded-sm overflow-hidden" />
}
