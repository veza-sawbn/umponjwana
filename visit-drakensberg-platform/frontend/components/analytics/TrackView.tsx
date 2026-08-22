'use client'
import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'

/**
 * Fires one semantic, entity-scoped view event (§3 — trail_view,
 * activity_view, accommodation_view, region_view, guide_profile_viewed, …)
 * on mount. Renders nothing.
 *
 * Distinct from the generic page_view AnalyticsProvider already fires on
 * every route: page_view is URL-based, this carries structured properties
 * (entity id, name, region, …) so "which hikes are trending" is a direct
 * query against event properties rather than URL-parsing every page_view.
 *
 * Usable from both a server-rendered detail page (as a child of an async
 * Server Component — a client component child is fine there) and from an
 * already-'use client' detail component.
 */
export default function TrackView({
  event,
  properties,
}: {
  event: string
  properties: Record<string, unknown>
}) {
  // Only the identity of the viewed entity should re-fire this — not every
  // reference change in a properties object rebuilt on each render.
  const key = String(properties.id ?? properties.entity_id ?? JSON.stringify(properties))
  const fired = useRef<string | null>(null)

  useEffect(() => {
    if (fired.current === key) return
    fired.current = key
    trackEvent(event, properties)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key])

  return null
}
