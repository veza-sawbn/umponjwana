import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const VALID_SUPPLIER_TYPES = ['Accommodation', 'Activity', 'Guided Tours', 'Shuttle', 'Experience']

/**
 * POST /api/admin/ops/create-supplier
 *
 * Creates an internally-managed supplier profile. Accessible to:
 *   - Platform admins (role = 'admin')
 *   - VD Operations administrators (ops_role = 'ops_administrator')
 *
 * Flow:
 *   1. Creates an auth user with role='supplier' in user_metadata so that
 *      the handle_new_user() DB trigger seeds the profile row automatically.
 *   2. Updates the profile with supplier_type and is_approved=true.
 *   3. If the caller is an ops_administrator (not a full platform admin),
 *      creates an initial vd_ops_assignments row so they can immediately
 *      manage the supplier they just created.
 *
 * The property owner can later claim the account via a password-reset link
 * and take over management — ownership transfer is handled in the UI.
 */
export async function POST(req: Request) {
  let body: { businessName?: string; email?: string; supplierType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }
  if (!body.businessName?.trim()) {
    return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
  }
  if (!body.supplierType || !VALID_SUPPLIER_TYPES.includes(body.supplierType)) {
    return NextResponse.json({ error: 'A valid supplier type is required.' }, { status: 400 })
  }

  // Auth check: must be platform admin or ops_administrator
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, ops_role')
    .eq('id', user.id)
    .maybeSingle()

  const isPlatformAdmin = callerProfile?.role === 'admin'
  const isOpsAdministrator = callerProfile?.ops_role === 'ops_administrator'

  if (!isPlatformAdmin && !isOpsAdministrator) {
    return NextResponse.json({ error: 'platform admin or ops_administrator only' }, { status: 403 })
  }

  const admin = supabaseAdmin()

  // Create the auth user with email_confirm=true so no verification email is
  // sent. The property owner receives access via a password-reset link later.
  // user_metadata seeds handle_new_user() which creates the profile row.
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: body.businessName.trim(),
      role: 'supplier',
    },
  })

  if (createError || !newUser?.user) {
    console.error('[ops/create-supplier] createUser error:', createError)
    return NextResponse.json(
      { error: createError?.message || 'Could not create supplier account' },
      { status: 500 },
    )
  }

  const supplierId = newUser.user.id

  // Update the profile with supplier-specific fields.
  // handle_new_user() runs in the same DB transaction as the auth INSERT so
  // the profile row already exists by the time we get here.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: body.businessName.trim(),
      supplier_type: body.supplierType,
      is_approved: true,
    })
    .eq('id', supplierId)

  if (profileError) {
    console.error('[ops/create-supplier] profile update error:', profileError)
    // Non-fatal: the auth user exists; an admin can fix the profile manually.
  }

  // Ops administrators are automatically assigned to the supplier they create
  // so they can start managing it immediately without waiting for a platform
  // admin to configure the assignment. Full platform admins manage assignments
  // through the Assign Supplier modal instead.
  if (isOpsAdministrator && !isPlatformAdmin) {
    const { error: assignError } = await admin
      .from('vd_ops_assignments')
      .insert({
        employee_id: user.id,
        supplier_id: supplierId,
        permissions: [
          'view_bookings',
          'manage_listings',
          'view_financials',
          'manage_availability',
          'manage_rates',
        ],
        is_active: true,
      })

    if (assignError) {
      console.error('[ops/create-supplier] assignment error:', assignError)
    }
  }

  return NextResponse.json({ supplierId })
}
