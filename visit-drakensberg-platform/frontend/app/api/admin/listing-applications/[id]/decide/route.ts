import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSiteOrigin } from '@/lib/origin'
import { tierById, normalizeListingApplication } from '@/lib/listing-applications'

export const dynamic = 'force-dynamic'

type Decision = 'in_review' | 'approved' | 'declined'

/**
 * POST /api/admin/listing-applications/[id]/decide
 *
 * Moves a public "list with us" application (lib/listing-applications.ts)
 * through the review queue. `in_review` and `declined` only touch the
 * application row. `approved` is the step that turns a lead into a working
 * supplier:
 *
 *   1. Find an existing account by the applicant's contact email — the
 *      journey's own step 1 already creates one via supabase.auth.signUp
 *      (role: 'supplier', unapproved) when the applicant wasn't signed in.
 *      If none exists — they applied while already signed in under a
 *      different email, or the account never got created — invite one, the
 *      same way staff are invited: mirrors app/api/admin/invite/route.ts,
 *      which is the migration-hardened path (20260809_signup_role_hardening
 *      .sql) — inviteUserByEmail cannot carry app_metadata, so the grant is
 *      applied afterwards via admin_set_role() and app_metadata directly.
 *   2. Write supplier_type (comma-joined, matching what the supplier portal
 *      and mergeNavForTypes() expect) and flip is_approved + approval_status
 *      together — the two-column approval bug documented in
 *      app/api/admin/supplier/[id]/route.ts, avoided here the same way: via
 *      the service-role client, which is the only way to write is_approved
 *      at all (the authenticated column grant excludes it).
 *   3. Record the commission tier the applicant asked for as their real
 *      commercial terms (vd_supplier_terms.commission_rate) — a starting
 *      point the admin can still edit from /admin/finance; approval is what
 *      turns "asked for" into "granted".
 *   4. Notify the account, if the applicant can already see it.
 *
 * Every step after account resolution runs even if a later one fails to
 * report partial success rather than silently stopping — the reviewer sees
 * exactly what did and didn't take, rather than a generic failure.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: { decision?: Decision }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const decision = body.decision
  if (!decision || !['in_review', 'approved', 'declined'].includes(decision)) {
    return NextResponse.json({ error: 'A valid decision is required.' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  const admin = supabaseAdmin()

  const { data: row, error: fetchError } = await admin
    .from('vd_listing_applications')
    .select('value')
    .eq('id', params.id)
    .maybeSingle()
  if (fetchError || !row) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
  }
  // Normalized: a row submitted before the multi-type journey (there is a
  // real one in production, reference LP-TYM4AV) has none of supplierTypes /
  // stay / tour / shuttle / experience, and would otherwise approve with an
  // empty supplier_type instead of the 'Accommodation' it actually asked
  // for. See normalizeListingApplication's own comment for the full story.
  const application = normalizeListingApplication(row.value as Record<string, unknown>)
  const contactEmail = application.contactEmail.trim().toLowerCase()
  const contactName = application.contactName
  const businessName = application.businessName
  const supplierTypes = application.supplierTypes
  const commissionTierId = application.commissionTier

  async function setApplicationStatus(status: Decision, extra: Record<string, unknown> = {}) {
    const { error } = await admin
      .from('vd_listing_applications')
      .update({
        status,
        value: { ...application, status, ...extra },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
    if (error) throw error
  }

  if (decision === 'in_review') {
    try {
      await setApplicationStatus('in_review')
    } catch {
      return NextResponse.json({ error: 'Could not update the application.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (decision === 'declined') {
    try {
      await setApplicationStatus('declined')
    } catch {
      return NextResponse.json({ error: 'Could not update the application.' }, { status: 500 })
    }
    // Best-effort: if the applicant already has an account, let them know.
    // Never blocks the decision on a notification failure.
    if (contactEmail) {
      const { data: existing } = await admin.from('profiles').select('id').ilike('email', contactEmail).maybeSingle()
      if (existing?.id) {
        await admin.from('vd_notifications').insert({
          user_id: existing.id,
          type: 'info',
          title: 'Update on your application',
          body: `We're unable to list ${businessName || 'your business'} on Visit Drakensberg at this time.`,
          link: null,
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  // decision === 'approved'
  if (!contactEmail) {
    return NextResponse.json({ error: 'Application has no contact email to approve against.' }, { status: 400 })
  }

  const warnings: string[] = []
  let supplierId: string | null = null
  let created = false

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, full_name')
    .ilike('email', contactEmail)
    .maybeSingle()

  if (existingProfile?.id) {
    supplierId = existingProfile.id
  } else {
    const origin = getSiteOrigin(req)
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(contactEmail, {
      data: { full_name: contactName },
      redirectTo: `${origin}/auth/reset-password`,
    })
    if (inviteError || !invited?.user) {
      return NextResponse.json(
        { error: inviteError?.message || 'Could not create a supplier account for this applicant.' },
        { status: 500 },
      )
    }
    supplierId = invited.user.id
    created = true

    // See app/api/admin/invite/route.ts — inviteUserByEmail cannot carry
    // app_metadata, so the grant is applied in the two places that matter
    // afterwards: app_metadata (JWT/middleware) and profiles (RLS), the
    // latter via the caller's own admin-checked session.
    const { error: metaError } = await admin.auth.admin.updateUserById(supplierId, {
      app_metadata: { role: 'supplier' },
    })
    if (metaError) warnings.push('Account created, but app-level role grant failed — sign-in may briefly show reduced access.')

    const { error: roleError } = await supabase.rpc('admin_set_role', { p_user: supplierId, p_role: 'supplier' })
    if (roleError) warnings.push('Account created, but the profile role could not be set.')
  }

  if (!supplierId) {
    return NextResponse.json({ error: 'Could not resolve a supplier account for this applicant.' }, { status: 500 })
  }

  // supplier_type + approval, together — both via the service-role client:
  // is_approved is excluded from the authenticated column grant (see
  // 20260704_secure_data_layer.sql), so nothing short of this or the RPC can
  // write it, and only this also keeps approval_status in step.
  const profilePatch: Record<string, unknown> = {
    supplier_type: supplierTypes.join(','),
    is_approved: true,
    approval_status: 'approved',
  }
  if (created || !existingProfile?.full_name) {
    profilePatch.full_name = businessName || contactName
  }
  const { error: approveError } = await admin.from('profiles').update(profilePatch).eq('id', supplierId)
  if (approveError?.code === '42703') {
    // approval_status column not migrated yet on this environment — fall
    // back to the boolean so approval still works.
    const { error: fallbackError } = await admin
      .from('profiles')
      .update({ supplier_type: supplierTypes.join(','), is_approved: true, ...(profilePatch.full_name ? { full_name: profilePatch.full_name } : {}) })
      .eq('id', supplierId)
    if (fallbackError) warnings.push('Account approved, but supplier_type could not be saved.')
  } else if (approveError) {
    warnings.push('Account approved, but some profile fields could not be saved.')
  }

  const { error: metaSyncError } = await admin.auth.admin.updateUserById(supplierId, {
    user_metadata: { supplier_type: supplierTypes.join(',') },
  })
  if (metaSyncError) warnings.push('Approved, but the portal metadata sync failed — it will catch up on next login.')

  // Starting commercial terms, from what the applicant asked for. Editable
  // afterwards from /admin/finance like any other supplier's terms.
  const rate = tierById(commissionTierId).rate / 100
  const { error: termsError } = await admin
    .from('vd_supplier_terms')
    .upsert({ supplier_id: supplierId, commission_rate: rate, updated_at: new Date().toISOString() }, { onConflict: 'supplier_id' })
  if (termsError) warnings.push('Approved, but the commission tier could not be saved as their terms.')

  try {
    await setApplicationStatus('approved', { supplierId })
  } catch {
    warnings.push('Supplier approved, but the application record could not be marked approved.')
  }

  await admin.from('vd_notifications').insert({
    user_id: supplierId,
    type: 'approval',
    title: 'Your application is approved',
    body: created
      ? 'Welcome to Visit Drakensberg — check your email to set a password, then sign in to set up your listing.'
      : 'You can now sign in and set up your listing.',
    link: '/supplier',
  })

  return NextResponse.json({ ok: true, supplierId, created, warnings })
}
