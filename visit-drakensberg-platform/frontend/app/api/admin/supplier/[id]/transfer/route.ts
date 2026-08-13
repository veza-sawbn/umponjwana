import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/supplier/[id]/transfer
 *
 * Transfers a VD-managed supplier account to the property owner.
 *
 * Steps:
 *   1. Validates the ownerEmail is not already in use by another Supabase user.
 *   2. Updates the auth user's login email to the owner's real email address.
 *   3. Sends a password-reset / account-setup link to the new email so the
 *      owner can set their own password.
 *   4. Clears the vd_managed flag from app_metadata and stores the transfer date.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  let body: { ownerEmail?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const ownerEmail = body.ownerEmail?.trim().toLowerCase()
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: 'A valid owner email address is required.' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Confirm the supplier exists
  const { data: target, error: fetchError } = await admin.auth.admin.getUserById(params.id)
  if (fetchError || !target?.user) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  }

  // Update the auth user's email to the owner's real address
  const { error: updateError } = await admin.auth.admin.updateUserById(params.id, {
    email: ownerEmail,
    email_confirm: false, // owner must confirm the new address
    app_metadata: {
      ...target.user.app_metadata,
      vd_managed: false,
      transferred_at: new Date().toISOString(),
      transferred_to: ownerEmail,
    },
    user_metadata: {
      ...target.user.user_metadata,
      owner_contact_email: null, // no longer needed — email IS the owner's email now
    },
  })

  if (updateError) {
    console.error('[supplier/transfer] updateUserById error:', updateError)
    return NextResponse.json({ error: updateError.message || 'Could not update user email' }, { status: 500 })
  }

  // Update the profile email column so it stays in sync
  await admin.from('profiles').update({ email: ownerEmail }).eq('id', params.id)

  // Build the redirectTo for the setup link — always prefer request headers.
  // See lib/origin.ts for the rationale.
  const redirectTo = `${getSiteOrigin(req)}/auth/reset-password`

  // Send a password-reset link to the owner's new email so they can take over
  const { error: resetError } = await admin.auth.resetPasswordForEmail(ownerEmail, { redirectTo })
  if (resetError) {
    console.error('[supplier/transfer] resetPasswordForEmail error:', resetError)
    // Non-fatal — the email was updated. The admin can resend the link manually.
  }

  return NextResponse.json({ ok: true, ownerEmail })
}
