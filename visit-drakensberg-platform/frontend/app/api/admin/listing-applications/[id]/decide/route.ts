import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSiteOrigin } from '@/lib/origin'
import { notifyServer } from '@/lib/notify-server'
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
    .select('value, reference')
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
        await notifyServer({
          userId: existing.id,
          type: 'info',
          title: 'Update on your application',
          body: `We're unable to list ${businessName || 'your business'} on Visit Drakensberg at this time.`,
        }, getSiteOrigin(req))
      }
    }
    return NextResponse.json({ ok: true })
  }

  // decision === 'approved'
  if (!contactEmail) {
    return NextResponse.json({ error: 'Application has no contact email to approve against.' }, { status: 400 })
  }

  // Accreditation gate. The review UI disables Approve on the same verdict,
  // but that is a signpost — this is the rule. An operator reaches the public
  // catalog only once the verification office has verified either an EDTEA
  // registration or CTO membership that has not expired.
  //
  // Read directly rather than through vd_accreditation_ok(): the service-role
  // client carries no user JWT, and the point here is the data, not the
  // caller's permissions (which were already checked above).
  //
  // Look under both owners. Approving moves the certificates off the
  // application reference and onto the account, so re-approving an already
  // approved application — or approving one whose evidence was lodged against
  // the account directly — would otherwise find nothing and refuse an operator
  // who is demonstrably accredited.
  const applicationRef = String((row as { reference?: string }).reference ?? application.reference ?? '')
  const linkedSupplierId = application.supplierId ?? null
  const ownerFilter = linkedSupplierId
    ? `application_ref.eq.${applicationRef},supplier_id.eq.${linkedSupplierId}`
    : `application_ref.eq.${applicationRef}`
  const { data: accreditationDocs, error: accreditationError } = await admin
    .from('vd_compliance_documents')
    .select('doc_type, review_status, expires_on')
    .or(ownerFilter)
    .in('doc_type', ['edtea_registration', 'cto_membership'])
    .eq('review_status', 'verified')

  if (accreditationError) {
    // The table is missing only when 20260905 has not been run. Refuse rather
    // than approving: silently skipping the gate on a migration lag is how an
    // unverified operator reaches the catalog.
    return NextResponse.json(
      {
        error: /relation .* does not exist|could not find the table/i.test(String(accreditationError.message || ''))
          ? 'Compliance checks are not set up yet. Run supabase/migrations/20260905_supplier_compliance.sql before approving suppliers.'
          : 'Could not check this applicant’s accreditation. Try again.',
      },
      { status: 503 },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const hasCurrentAccreditation = (accreditationDocs ?? []).some(
    d => !d.expires_on || String(d.expires_on) >= today,
  )
  if (!hasCurrentAccreditation) {
    return NextResponse.json(
      {
        error:
          'This applicant has no verified, unexpired EDTEA registration or CTO membership on file. Verify their certificate in the compliance panel first.',
      },
      { status: 409 },
    )
  }

  const warnings: string[] = []
  let supplierId: string | null = null
  let created = false

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, full_name, role, staff_role')
    .ilike('email', contactEmail)
    .maybeSingle()

  if (existingProfile?.id) {
    supplierId = existingProfile.id

    // Grant the supplier role to an account that already existed.
    //
    // This branch used to do nothing but assign supplierId. The approval then
    // set is_approved/approval_status/supplier_type but left role untouched —
    // so an applicant who already had an account (a visitor who once booked, a
    // staff member applying with their work address) stayed role='visitor' and
    // never appeared in /admin/suppliers, which lists on role='supplier'. They
    // were approved everywhere except the one place anyone looks.
    //
    // Never downgrade an admin: role is a single column, so writing 'supplier'
    // over 'admin' would strip the console from whoever approved with their own
    // address. Admins already reach supplier routes via the middleware's
    // role === 'admin' check, so there is nothing to grant them.
    if (existingProfile.role !== 'admin') {
      // staff_role has to travel with role. The middleware reads role from
      // app_metadata and only falls back to profiles when role is ABSENT — so
      // writing role alone here would make it stop consulting the profile, and
      // a finance or operations collaborator who applies to list would silently
      // lose their console on the next request. Carry their staff_role across.
      const appMetadata: Record<string, string> = { role: 'supplier' }
      if (existingProfile.staff_role) appMetadata.staff_role = existingProfile.staff_role

      const { error: metaError } = await admin.auth.admin.updateUserById(existingProfile.id, {
        app_metadata: appMetadata,
      })
      if (metaError) warnings.push('Approved, but the app-level role grant failed — sign-in may briefly show reduced access.')

      const { error: roleError } = await supabase.rpc('admin_set_role', { p_user: existingProfile.id, p_role: 'supplier' })
      if (roleError) {
        warnings.push('Approved, but their profile role could not be set to supplier — they will not appear in Suppliers.')
      }
    }
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

  // Re-home the certificates and acceptances onto the account. Without this
  // they stay keyed to an application reference nobody looks at again, and the
  // renewal queue — which watches expiry per supplier — would never see the
  // certificate that is about to lapse.
  //
  // Through the RPC on the caller's own session, not the service-role client:
  // vd_supplier_agreements has no update policy for anybody, and the function
  // is the narrow exception that can only fill in a null supplier_id. Going
  // around it with the service role would make "append-only" a comment rather
  // than a property.
  //
  // The storage objects stay under compliance/applications/<ref>/…: the
  // verification office reads the whole bucket, so nothing is lost, and moving
  // objects between prefixes would break the path recorded on the row.
  if (applicationRef) {
    const { error: linkError } = await supabase.rpc('vd_link_application_to_supplier', {
      p_application_ref: applicationRef,
      p_supplier_id: supplierId,
    })
    if (linkError) {
      warnings.push('Approved, but their compliance documents stayed attached to the application rather than the account.')
    }
  }

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

  // Records the row AND emails it. This used to be a bare insert, which is why
  // approvals showed up on the bell and never reached the applicant's inbox —
  // the one place someone who has just been approved is actually looking.
  const notified = await notifyServer({
    userId: supplierId,
    type: 'approval',
    title: 'Your application is approved',
    body: created
      ? 'Welcome to Visit Drakensberg — check your email to set a password, then sign in to set up your listing.'
      : 'You can now sign in and set up your listing.',
    link: '/supplier',
  }, getSiteOrigin(req))
  if (!notified.emailed) {
    warnings.push(
      notified.error
        ? `Approved, but the confirmation email did not send (${notified.error}).`
        : 'Approved, but the confirmation email did not send.',
    )
  }

  return NextResponse.json({ ok: true, supplierId, created, warnings })
}
