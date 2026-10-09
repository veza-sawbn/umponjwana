import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './auth'
import {
  GRAND_TOUR_CONTENT_KEY, DEFAULT_GRAND_TOUR_CONTENT, normaliseGrandTourContent, type GrandTourContent,
} from './grand-tour-content-model'

// Reading and saving the editable /grand-tour content. The model (types,
// defaults, validation) lives in ./grand-tour-content-model, which has no
// database import, and is re-exported here for convenience.
export * from './grand-tour-content-model'

/** The live content, or the defaults when nothing is saved or the read fails. */
export async function getGrandTourContent(client: SupabaseClient = supabase): Promise<GrandTourContent> {
  try {
    const { data } = await client.from('site_content').select('value').eq('key', GRAND_TOUR_CONTENT_KEY).maybeSingle()
    return normaliseGrandTourContent(data?.value)
  } catch {
    return DEFAULT_GRAND_TOUR_CONTENT
  }
}

/** Admin only — site_content's write policy refuses anyone else. */
export async function saveGrandTourContent(content: GrandTourContent): Promise<void> {
  const value = normaliseGrandTourContent(content)
  const { error } = await supabase.from('site_content').upsert(
    { key: GRAND_TOUR_CONTENT_KEY, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw new Error(error.message || 'Could not save the Grand Tour page.')
}
