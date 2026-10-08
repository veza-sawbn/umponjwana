'use client'

import { useEffect, useState } from 'react'
import type { GrandTourStage } from './grand-tour'
import { getGrandTourContent, DEFAULT_GRAND_TOUR_CONTENT } from './grand-tour-content'

// Kept apart from lib/grand-tour-content.ts so the server pages that read the
// content never import React state hooks.

/** Current stages for client-side tools (pickers, ops panels). Starts on the defaults. */
export function useGrandTourStages(): GrandTourStage[] {
  const [stages, setStages] = useState<GrandTourStage[]>(DEFAULT_GRAND_TOUR_CONTENT.stages)
  useEffect(() => {
    let cancelled = false
    getGrandTourContent().then(c => { if (!cancelled) setStages(c.stages) })
    return () => { cancelled = true }
  }, [])
  return stages
}
