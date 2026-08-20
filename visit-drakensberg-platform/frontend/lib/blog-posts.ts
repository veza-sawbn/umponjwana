import { publicSupabase } from './supabase-public'
import type { SupabaseClient } from '@supabase/supabase-js'

export type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  category: string | null
  tags: string[]
  featured_image: string | null
  status: string
  author_id: string | null
  author_name: string | null
  author_role: string | null
  author_bio: string | null
  seo_title: string | null
  seo_description: string | null
  related_listing_ids: string[]
  published_at: string | null
  created_at: string
  updated_at: string
}

const BLOG_SELECT = [
  'id', 'title', 'slug', 'excerpt', 'body', 'category', 'tags',
  'featured_image', 'status', 'author_id', 'author_name', 'author_role',
  'author_bio', 'seo_title', 'seo_description', 'related_listing_ids',
  'published_at', 'created_at', 'updated_at',
].join(', ')

/** Parse a simple markdown body into display blocks.
 *  Recognises ## headings; paragraphs are separated by blank lines. */
export function parseBody(markdown: string | null): { heading?: string; text: string }[] {
  if (!markdown) return []
  const blocks: { heading?: string; text: string }[] = []
  let heading: string | undefined
  let para: string[] = []

  const flush = () => {
    const text = para.join(' ').trim()
    if (text) blocks.push(heading ? { heading, text } : { text })
    para = []
    heading = undefined
  }

  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    const h = line.match(/^##\s+(.+)$/)
    if (h) { flush(); heading = h[1] }
    else if (line) { para.push(line) }
    else { flush() }
  }
  flush()
  return blocks
}

/** Estimate read time from plain-text body at ~200 wpm. */
export function estimateReadTime(body: string | null): string {
  if (!body) return '1 min'
  const mins = Math.max(1, Math.round(body.trim().split(/\s+/).length / 200))
  return `${mins} min`
}

export async function getPublishedPosts(client: SupabaseClient = publicSupabase): Promise<BlogPost[]> {
  const { data, error } = await client
    .from('blog_posts')
    .select(BLOG_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as BlogPost[]
}

export async function getPostBySlug(
  slug: string,
  client: SupabaseClient = publicSupabase,
): Promise<BlogPost | null> {
  const { data, error } = await client
    .from('blog_posts')
    .select(BLOG_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as unknown as BlogPost | null
}

/** Fetch 3 other published posts to show as "More Stories". */
export async function getRelatedPosts(
  excludeSlug: string,
  client: SupabaseClient = publicSupabase,
): Promise<Pick<BlogPost, 'slug' | 'title' | 'category' | 'featured_image'>[]> {
  const { data } = await client
    .from('blog_posts')
    .select('slug, title, category, featured_image')
    .eq('status', 'published')
    .neq('slug', excludeSlug)
    .order('published_at', { ascending: false })
    .limit(3)
  return (data ?? []) as Pick<BlogPost, 'slug' | 'title' | 'category' | 'featured_image'>[]
}

/** Fetch all posts regardless of status — admin use only (browser client with admin RLS). */
export async function getAllPostsAdmin(client: SupabaseClient): Promise<BlogPost[]> {
  const { data, error } = await client
    .from('blog_posts')
    .select(BLOG_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as BlogPost[]
}

export async function upsertPost(
  post: Partial<BlogPost> & { slug: string; title: string },
  client: SupabaseClient,
): Promise<BlogPost> {
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { ...post, updated_at: now }
  if (!payload.id) payload.created_at = now
  const { data, error } = await client
    .from('blog_posts')
    .upsert(payload, { onConflict: 'id' })
    .select(BLOG_SELECT)
    .single()
  if (error) throw error
  return data as unknown as BlogPost
}

export async function setPostStatus(
  id: string,
  status: 'published' | 'draft',
  client: SupabaseClient,
): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'published') patch.published_at = patch.updated_at
  const { error } = await client.from('blog_posts').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePost(id: string, client: SupabaseClient): Promise<void> {
  const { error } = await client.from('blog_posts').delete().eq('id', id)
  if (error) throw error
}
