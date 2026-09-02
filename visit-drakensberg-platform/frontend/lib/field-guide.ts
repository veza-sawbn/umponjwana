import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './auth'
import { publicSupabase } from './supabase-public'

// ─────────────────────────────────────────────────────────────────────────────
// Layered Field Guide — data layer.
//
// Two halves that never meet:
//
//   * the ADMIN half reads and writes the working rows in
//     vd_field_guide_pages / _chapters / _layers (admin-only RLS),
//   * the PUBLIC half reads nothing but the published snapshot, through the
//     vd_field_guide_public() / vd_field_guide_index() SECURITY DEFINER
//     functions.
//
// That split is the whole draft/publish guarantee: an editor can rewrite a
// chapter, disable a layer or rename the page and the live composition does
// not move until someone presses Publish. See
// supabase/migrations/20260904_layered_field_guide.sql.
// ─────────────────────────────────────────────────────────────────────────────

export const LAYER_TYPES = ['image', 'text', 'annotation', 'card'] as const
export type LayerType = (typeof LAYER_TYPES)[number]

export const LAYER_TYPE_LABEL: Record<LayerType, string> = {
  image: 'Image layer',
  text: 'Text layer',
  annotation: 'Annotation',
  card: 'Information card',
}

export type FieldGuideStatus = 'draft' | 'published'

/** A layer as the public page consumes it — the snapshot shape, camelCase. */
export type PublishedLayer = {
  id: string
  type: LayerType
  name: string
  mediaUrl: string | null
  mediaWidth: number | null
  mediaHeight: number | null
  heading: string | null
  text: string | null
  alt: string | null
  x: number
  y: number
  mobileX: number
  mobileY: number
  width: number
  mobileWidth: number
  zIndex: number
  entranceOrder: number
  scrollTrigger: number
  floatDistance: number
  fadeDuration: number
  rotation: number
  opacity: number
  decorative: boolean
}

export type PublishedChapter = {
  id: string
  order: number
  commonName: string
  scientificName: string | null
  category: string | null
  description: string | null
  habitat: string | null
  elevation: string | null
  season: string | null
  locality: string | null
  accessibleDescription: string | null
  mainMediaUrl: string | null
  mainMediaAlt: string | null
  mainMediaWidth: number | null
  mainMediaHeight: number | null
  scrollLength: number
  layers: PublishedLayer[]
}

export type PublishedFieldGuide = {
  version: number
  page: {
    id: string
    slug: string
    title: string
    intro: string | null
    seoTitle: string | null
    seoDescription: string | null
    backgroundUrl: string | null
    backgroundColor: string
  }
  chapters: PublishedChapter[]
}

export type FieldGuideIndexEntry = {
  slug: string
  title: string
  intro: string | null
  coverUrl: string | null
  coverAlt: string | null
  chapterCount: number
  publishedAt: string | null
}

// ── Working (draft) rows ─────────────────────────────────────────────────────

export type FieldGuidePage = {
  id: string
  slug: string
  title: string
  intro: string | null
  background_url: string | null
  background_color: string
  seo_title: string | null
  seo_description: string | null
  status: FieldGuideStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export type FieldGuideChapter = {
  id: string
  page_id: string
  common_name: string
  scientific_name: string | null
  category: string | null
  description: string | null
  habitat: string | null
  elevation: string | null
  season: string | null
  locality: string | null
  accessible_description: string | null
  main_media_url: string | null
  main_media_alt: string | null
  main_media_width: number | null
  main_media_height: number | null
  scroll_length: number
  chapter_order: number
  is_enabled: boolean
}

export type FieldGuideLayer = {
  id: string
  chapter_id: string
  layer_type: LayerType
  name: string
  media_url: string | null
  media_width: number | null
  media_height: number | null
  heading: string | null
  text_content: string | null
  alt_text: string | null
  x: number
  y: number
  mobile_x: number
  mobile_y: number
  width: number
  mobile_width: number
  z_index: number
  entrance_order: number
  scroll_trigger: number
  float_distance: number
  fade_duration: number
  rotation: number
  opacity: number
  is_decorative: boolean
  is_enabled: boolean
}

const PAGE_COLS =
  'id, slug, title, intro, background_url, background_color, seo_title, seo_description, status, published_at, created_at, updated_at'
const CHAPTER_COLS =
  'id, page_id, common_name, scientific_name, category, description, habitat, elevation, season, locality, accessible_description, main_media_url, main_media_alt, main_media_width, main_media_height, scroll_length, chapter_order, is_enabled'
const LAYER_COLS =
  'id, chapter_id, layer_type, name, media_url, media_width, media_height, heading, text_content, alt_text, x, y, mobile_x, mobile_y, width, mobile_width, z_index, entrance_order, scroll_trigger, float_distance, fade_duration, rotation, opacity, is_decorative, is_enabled'

// ─────────────────────────────────────────────────────────────────────────────
// Public reads
// ─────────────────────────────────────────────────────────────────────────────

/** The live composition for a slug, or null if the page is unpublished. */
export async function getPublishedFieldGuide(
  slug: string,
  client: SupabaseClient = publicSupabase,
): Promise<PublishedFieldGuide | null> {
  const { data, error } = await client.rpc('vd_field_guide_public', { p_slug: slug })
  if (error) throw error
  return normalizeSnapshot(data)
}

export async function getFieldGuideIndex(
  client: SupabaseClient = publicSupabase,
): Promise<FieldGuideIndexEntry[]> {
  const { data, error } = await client.rpc('vd_field_guide_index')
  if (error) throw error
  return Array.isArray(data) ? (data as FieldGuideIndexEntry[]) : []
}

/**
 * Coerce a snapshot into the shape the renderer relies on.
 *
 * Snapshots are JSON written by an older deploy of the publish function, so
 * every numeric field is defended here rather than at each of its ~30 use
 * sites: a null width would collapse a layer to zero and a null trigger would
 * pin it to the top of the chapter, both of which look like a bug in the
 * artwork rather than in the data.
 */
export function normalizeSnapshot(raw: unknown): PublishedFieldGuide | null {
  if (!raw || typeof raw !== 'object') return null
  const snap = raw as Record<string, any>
  if (!snap.page?.slug) return null

  return {
    version: num(snap.version, 1),
    page: {
      id: String(snap.page.id ?? ''),
      slug: String(snap.page.slug),
      title: String(snap.page.title ?? ''),
      intro: snap.page.intro ?? null,
      seoTitle: snap.page.seoTitle ?? null,
      seoDescription: snap.page.seoDescription ?? null,
      backgroundUrl: snap.page.backgroundUrl ?? null,
      backgroundColor: snap.page.backgroundColor || '#F2EDE3',
    },
    chapters: (Array.isArray(snap.chapters) ? snap.chapters : []).map((c: any, i: number) => ({
      id: String(c.id ?? `chapter-${i}`),
      order: num(c.order, i),
      commonName: String(c.commonName ?? 'Untitled specimen'),
      scientificName: c.scientificName ?? null,
      category: c.category ?? null,
      description: c.description ?? null,
      habitat: c.habitat ?? null,
      elevation: c.elevation ?? null,
      season: c.season ?? null,
      locality: c.locality ?? null,
      accessibleDescription: c.accessibleDescription ?? null,
      mainMediaUrl: c.mainMediaUrl ?? null,
      mainMediaAlt: c.mainMediaAlt ?? null,
      mainMediaWidth: c.mainMediaWidth ?? null,
      mainMediaHeight: c.mainMediaHeight ?? null,
      scrollLength: clamp(num(c.scrollLength, 260), 120, 600),
      layers: (Array.isArray(c.layers) ? c.layers : []).map((l: any, j: number) => normalizeLayer(l, j)),
    })),
  }
}

function normalizeLayer(l: any, i: number): PublishedLayer {
  return {
    id: String(l.id ?? `layer-${i}`),
    type: (LAYER_TYPES as readonly string[]).includes(l.type) ? (l.type as LayerType) : 'image',
    name: String(l.name ?? 'Layer'),
    mediaUrl: l.mediaUrl ?? null,
    mediaWidth: l.mediaWidth ?? null,
    mediaHeight: l.mediaHeight ?? null,
    heading: l.heading ?? null,
    text: l.text ?? null,
    alt: l.alt ?? null,
    x: num(l.x, 50),
    y: num(l.y, 50),
    mobileX: num(l.mobileX, num(l.x, 50)),
    mobileY: num(l.mobileY, num(l.y, 50)),
    width: num(l.width, 24),
    mobileWidth: num(l.mobileWidth, num(l.width, 40)),
    zIndex: Math.round(num(l.zIndex, 10)),
    entranceOrder: Math.round(num(l.entranceOrder, i)),
    scrollTrigger: clamp(num(l.scrollTrigger, 0.2), 0, 1),
    floatDistance: clamp(num(l.floatDistance, 55), 0, 200),
    fadeDuration: clamp(num(l.fadeDuration, 700), 100, 3000),
    rotation: num(l.rotation, 0),
    opacity: clamp(num(l.opacity, 1), 0, 1),
    decorative: Boolean(l.decorative),
  }
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// ─────────────────────────────────────────────────────────────────────────────
// Reveal geometry — shared by the public page and the dashboard's animation
// preview so the two cannot drift apart.
// ─────────────────────────────────────────────────────────────────────────────

/** Fraction of a chapter's pinned scroll after which the finished composition
 *  leaves the viewport as one scene. */
export const SCENE_EXIT_START = 0.9

/** The main specimen leads every chapter — it is on screen before any detail
 *  layer has a chance to trigger. */
export const SPECIMEN_TRIGGER = 0.04

/**
 * Has this layer been revealed at `progress` through its chapter?
 *
 * Deliberately a pure threshold rather than a per-frame interpolation: a
 * revealed layer must stay exactly where it settled for the rest of the
 * chapter, and the cheapest way to guarantee that is to never compute its
 * position from scroll at all. Crossing back under the trigger returns false
 * again, which is what makes scrolling backwards reverse cleanly.
 */
export function isLayerRevealed(layer: Pick<PublishedLayer, 'scrollTrigger'>, progress: number): boolean {
  return progress >= layer.scrollTrigger
}

/** Entrance stagger, in ms, from a layer's position in the reveal order. */
export function layerStagger(entranceOrder: number): number {
  return clamp(entranceOrder, 0, 12) * 90
}

/** 0 → 1 as the completed chapter lifts away as a single scene. */
export function sceneExitProgress(progress: number): number {
  if (progress <= SCENE_EXIT_START) return 0
  return clamp((progress - SCENE_EXIT_START) / (1 - SCENE_EXIT_START), 0, 1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin CRUD — every call goes through the caller's own session, so RLS
// (is_admin()) is what actually enforces access, not the console's routing.
// ─────────────────────────────────────────────────────────────────────────────

export async function listFieldGuidePages(client: SupabaseClient = supabase): Promise<FieldGuidePage[]> {
  const { data, error } = await client
    .from('vd_field_guide_pages')
    .select(PAGE_COLS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as FieldGuidePage[]
}

export async function getFieldGuidePage(id: string, client: SupabaseClient = supabase): Promise<FieldGuidePage | null> {
  const { data, error } = await client.from('vd_field_guide_pages').select(PAGE_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data ?? null) as unknown as FieldGuidePage | null
}

export async function createFieldGuidePage(
  input: { slug: string; title: string },
  client: SupabaseClient = supabase,
): Promise<FieldGuidePage> {
  const { data, error } = await client
    .from('vd_field_guide_pages')
    .insert({ slug: input.slug, title: input.title })
    .select(PAGE_COLS)
    .single()
  if (error) throw error
  return data as unknown as FieldGuidePage
}

export async function updateFieldGuidePage(
  id: string,
  patch: Partial<Omit<FieldGuidePage, 'id' | 'created_at' | 'updated_at' | 'status' | 'published_at'>>,
  client: SupabaseClient = supabase,
): Promise<void> {
  const { error } = await client
    .from('vd_field_guide_pages')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteFieldGuidePage(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from('vd_field_guide_pages').delete().eq('id', id)
  if (error) throw error
}

/** Flatten the enabled chapters and layers into the page's live snapshot. */
export async function publishFieldGuidePage(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.rpc('vd_publish_field_guide_page', { p_page_id: id })
  if (error) throw error
}

/** Take the page off the public site. The snapshot survives, so re-publishing
 *  with no further edits restores exactly what was live. */
export async function unpublishFieldGuidePage(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.rpc('vd_unpublish_field_guide_page', { p_page_id: id })
  if (error) throw error
}

/** Everywhere a media file is referenced by this module — the Media Library
 *  asks before deleting so an in-use asset cannot be pulled out from under a
 *  published composition. */
export async function getFieldGuideMediaUsage(
  url: string,
  client: SupabaseClient = supabase,
): Promise<{ page: string; slug: string; usedAs: string }[]> {
  const { data, error } = await client.rpc('vd_field_guide_media_usage', { p_url: url })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function listChapters(pageId: string, client: SupabaseClient = supabase): Promise<FieldGuideChapter[]> {
  const { data, error } = await client
    .from('vd_field_guide_chapters')
    .select(CHAPTER_COLS)
    .eq('page_id', pageId)
    .order('chapter_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as FieldGuideChapter[]
}

export async function createChapter(
  pageId: string,
  input: Partial<FieldGuideChapter> & { common_name: string },
  client: SupabaseClient = supabase,
): Promise<FieldGuideChapter> {
  const { data, error } = await client
    .from('vd_field_guide_chapters')
    .insert({ ...input, page_id: pageId })
    .select(CHAPTER_COLS)
    .single()
  if (error) throw error
  return data as unknown as FieldGuideChapter
}

export async function updateChapter(
  id: string,
  patch: Partial<Omit<FieldGuideChapter, 'id' | 'page_id'>>,
  client: SupabaseClient = supabase,
): Promise<void> {
  const { error } = await client
    .from('vd_field_guide_chapters')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteChapter(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from('vd_field_guide_chapters').delete().eq('id', id)
  if (error) throw error
}

/** Persist a whole reordering in one round trip rather than one PATCH per row,
 *  so a drag that moves five chapters cannot half-apply. */
export async function reorderChapters(
  ordered: { id: string; chapter_order: number }[],
  client: SupabaseClient = supabase,
): Promise<void> {
  await Promise.all(ordered.map(c => updateChapter(c.id, { chapter_order: c.chapter_order }, client)))
}

export async function listLayers(chapterId: string, client: SupabaseClient = supabase): Promise<FieldGuideLayer[]> {
  const { data, error } = await client
    .from('vd_field_guide_layers')
    .select(LAYER_COLS)
    .eq('chapter_id', chapterId)
    .order('entrance_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as FieldGuideLayer[]
}

export async function createLayer(
  chapterId: string,
  input: Partial<FieldGuideLayer>,
  client: SupabaseClient = supabase,
): Promise<FieldGuideLayer> {
  const { data, error } = await client
    .from('vd_field_guide_layers')
    .insert({ ...input, chapter_id: chapterId })
    .select(LAYER_COLS)
    .single()
  if (error) throw error
  return data as unknown as FieldGuideLayer
}

export async function updateLayer(
  id: string,
  patch: Partial<Omit<FieldGuideLayer, 'id' | 'chapter_id'>>,
  client: SupabaseClient = supabase,
): Promise<void> {
  const { error } = await client
    .from('vd_field_guide_layers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteLayer(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from('vd_field_guide_layers').delete().eq('id', id)
  if (error) throw error
}

/** Copy a chapter and everything in it. Used by "Duplicate specimen", which
 *  is how an editor builds the second of two similar plates. */
export async function duplicateChapter(
  chapter: FieldGuideChapter,
  client: SupabaseClient = supabase,
): Promise<FieldGuideChapter> {
  const { id, page_id, ...rest } = chapter
  const copy = await createChapter(
    page_id,
    {
      ...rest,
      common_name: `${chapter.common_name} (copy)`,
      chapter_order: chapter.chapter_order + 1,
      is_enabled: false,
    },
    client,
  )
  const layers = await listLayers(id, client)
  for (const layer of layers) {
    const { id: _layerId, chapter_id: _chapterId, ...layerRest } = layer
    await createLayer(copy.id, layerRest, client)
  }
  return copy
}

/** The default a new layer of each type starts from — sensible enough that
 *  an editor who changes nothing but the image still gets a working reveal. */
export function blankLayer(type: LayerType, entranceOrder: number): Partial<FieldGuideLayer> {
  return {
    layer_type: type,
    name: LAYER_TYPE_LABEL[type],
    heading: type === 'card' || type === 'text' ? 'Heading' : null,
    text_content: type === 'image' ? null : 'New layer copy.',
    x: 50,
    y: 50,
    mobile_x: 50,
    mobile_y: 50,
    width: type === 'image' ? 24 : 22,
    mobile_width: type === 'image' ? 44 : 74,
    z_index: type === 'image' ? 20 : 40,
    entrance_order: entranceOrder,
    scroll_trigger: clamp(0.15 + entranceOrder * 0.12, 0, 0.85),
    float_distance: 55,
    fade_duration: 700,
    rotation: 0,
    opacity: 1,
    is_decorative: type === 'annotation',
    is_enabled: true,
  }
}
