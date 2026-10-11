import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const MAX_PER_REQUEST = 100

type Admin = ReturnType<typeof supabaseAdmin>

type Result = { id: string; name: string; deleted: boolean; reason?: string }

/** Every object under a storage folder, walking sub-folders (list() is one level). */
async function listFolder(admin: Admin, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error || !data || data.length === 0) break
    for (const item of data) {
      const path = `${prefix}/${item.name}`
      // Folders come back with a null id.
      if (item.id) paths.push(path)
      else paths.push(...await listFolder(admin, bucket, path))
    }
    if (data.length < 1000) break
  }
  return paths
}

async function count(admin: Admin, table: string, column: string, id: string): Promise<number> {
  const { count: n, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, id)
  // A table missing on this environment can't hold anything for the supplier.
  if (error?.code === '42P01') return 0
  if (error) throw error
  return n ?? 0
}

/**
 * POST /api/admin/suppliers/delete   { ids: string[] }
 *
 * Permanently removes supplier accounts: the auth user, and through the
 * ON DELETE CASCADE foreign keys on auth.users their profile, listings
 * (vd_entities), waivers, contacts, compliance documents, ops assignments and
 * so on, plus their uploads under media/supplier/<id>/.
 *
 * Built for clearing out spam / bot sign-ups. A supplier that has taken real
 * bookings is refused: vd_booking_orders cascades on supplier_id, so deleting
 * them would silently take guests' bookings with them. Suspend those instead.
 *
 * Each id is handled independently and reported back, so one refusal doesn't
 * stop the rest of the batch.
 */
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  let ids: string[]
  try {
    const body = await req.json()
    ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string') : []
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  ids = Array.from(new Set(ids))
  if (ids.length === 0) return NextResponse.json({ error: 'No suppliers selected.' }, { status: 400 })
  if (ids.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Delete at most ${MAX_PER_REQUEST} suppliers at a time.` }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, role, full_name, email')
    .in('id', ids)
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })
  const byId = new Map((profiles ?? []).map(p => [p.id as string, p]))

  const results: Result[] = []
  for (const id of ids) {
    const p = byId.get(id)
    const name = (p?.full_name || p?.email || id) as string
    try {
      // Only supplier accounts — never an admin, ops employee or guest that
      // ended up in the request.
      if (!p || p.role !== 'supplier') {
        results.push({ id, name, deleted: false, reason: 'Not a supplier account.' })
        continue
      }
      if (id === user.id) {
        results.push({ id, name, deleted: false, reason: 'You cannot delete your own account.' })
        continue
      }

      const bookings =
        await count(admin, 'vd_booking_orders', 'supplier_id', id) +
        await count(admin, 'vd_order_lines', 'supplier_id', id)
      if (bookings > 0) {
        results.push({ id, name, deleted: false, reason: 'Has bookings on record. Suspend this supplier instead.' })
        continue
      }

      // blog_posts.author_id has no ON DELETE action and would block the delete.
      const { error: blogError } = await admin.from('blog_posts').update({ author_id: null }).eq('author_id', id)
      if (blogError && blogError.code !== '42P01') throw blogError

      // These would otherwise be kept with supplier_id set to null — orphaned
      // acceptance records for an account that no longer exists.
      const { error: agreementsError } = await admin.from('vd_supplier_agreements').delete().eq('supplier_id', id)
      if (agreementsError && agreementsError.code !== '42P01') throw agreementsError

      const files = await listFolder(admin, 'media', `supplier/${id}`)
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await admin.storage.from('media').remove(files.slice(i, i + 100))
        if (error) throw error
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(id)
      if (deleteError) throw deleteError

      results.push({ id, name, deleted: true })
    } catch (e: unknown) {
      console.error('[admin/suppliers/delete]', id, e)
      results.push({ id, name, deleted: false, reason: e instanceof Error ? e.message : 'Delete failed.' })
    }
  }

  return NextResponse.json({
    deleted: results.filter(r => r.deleted).length,
    results,
  })
}
