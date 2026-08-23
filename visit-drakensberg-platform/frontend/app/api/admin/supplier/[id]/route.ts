import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/** Assert caller is a platform admin, return 403 response if not. */
async function requireAdmin(supabase: ReturnType<typeof createRouteHandlerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  return null
}

/**
 * GET /api/admin/supplier/[id]
 * Returns the full supplier profile — profile row plus auth user metadata.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const admin = supabaseAdmin()

  const [profileRes, authRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.id).maybeSingle(),
    admin.auth.admin.getUserById(params.id),
  ])

  if (!profileRes.data && !authRes.data?.user) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  }

  const p = profileRes.data
  const u = authRes.data?.user

  return NextResponse.json({
    id: params.id,
    businessName: p?.full_name ?? u?.user_metadata?.full_name ?? '',
    email: u?.email ?? p?.email ?? '',
    ownerContactEmail: u?.user_metadata?.owner_contact_email ?? null,
    supplierType: p?.supplier_type ?? null,
    bio: p?.bio ?? '',
    website: p?.website ?? null,
    isApproved: Boolean(p?.is_approved),
    isVdManaged: Boolean(u?.app_metadata?.vd_managed),
    createdAt: p?.created_at ?? u?.created_at ?? '',
    lastSignIn: u?.last_sign_in_at ?? null,
    emailConfirmedAt: u?.email_confirmed_at ?? null,
  })
}

/**
 * PATCH /api/admin/supplier/[id]
 * Updates supplier profile fields. Any field can be omitted to leave it unchanged.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  let body: {
    businessName?: string
    supplierType?: string
    bio?: string
    website?: string
    ownerContactEmail?: string | null
    isApproved?: boolean
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const profilePatch: Record<string, unknown> = {}
  const metaPatch: Record<string, unknown> = {}

  if (body.businessName !== undefined) {
    profilePatch.full_name = body.businessName
    metaPatch.full_name = body.businessName
  }
  if (body.supplierType !== undefined) {
    profilePatch.supplier_type = body.supplierType
    // The supplier portal derives its tool nav from supplier_type; keep the
    // auth metadata copy in step so the portal and the profile never disagree.
    metaPatch.supplier_type = body.supplierType
  }
  if (body.bio !== undefined) profilePatch.bio = body.bio
  if (body.website !== undefined) profilePatch.website = body.website
  if (body.ownerContactEmail !== undefined) metaPatch.owner_contact_email = body.ownerContactEmail

  try {
    if (Object.keys(profilePatch).length > 0) {
      const { error } = await admin.from('profiles').update(profilePatch).eq('id', params.id)
      if (error) throw error
    }

    // Approval has two representations on profiles that must move together:
    //   is_approved     — boolean, read by is_active_supplier() and RLS
    //   approval_status — tri-state, read by the admin verification console
    // Writing only is_approved (as this route used to) left approval_status on
    // 'pending', which is what made an approved supplier still see the
    // "pending approval" notice in their portal.
    //
    // admin_set_supplier_status() normally keeps them in sync, but it guards on
    // is_admin() and auth.uid() is null under the service role — so we write
    // both columns here instead. The caller was already proven to be an admin
    // by requireAdmin() above.
    if (body.isApproved !== undefined) {
      const approved = body.isApproved
      const { error } = await admin
        .from('profiles')
        .update({ is_approved: approved, approval_status: approved ? 'approved' : 'pending' })
        .eq('id', params.id)

      // 42703 = column does not exist: the supplier-moderation migration
      // hasn't been applied on this environment yet. Fall back to the boolean
      // so approving still works rather than failing outright.
      if (error?.code === '42703') {
        const { error: fallbackError } = await admin
          .from('profiles')
          .update({ is_approved: approved })
          .eq('id', params.id)
        if (fallbackError) throw fallbackError
      } else if (error) {
        throw error
      }
    }
    if (Object.keys(metaPatch).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(params.id, { user_metadata: metaPatch })
      if (error) throw error
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Update failed'
    console.error('[admin/supplier/patch]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
