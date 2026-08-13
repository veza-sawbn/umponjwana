import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const VALID_SUPPLIER_TYPES = ['Accommodation', 'Activity', 'Guided Tours', 'Shuttle', 'Experience']

/**
 * Generates an internal email alias for VD-managed supplier accounts.
 *
 * Format: ops+{slug}-{random}@{domain}
 *   where domain comes from VD_OPS_EMAIL_DOMAIN (e.g. visitdrakensberg.co.za).
 *
 * Using plus-addressing means all emails land in one ops inbox and VD fully
 * controls the addresses — no external email required at creation time.
 * When the account is transferred to a property owner, the auth email is
 * updated to the owner's real address via /api/admin/supplier/[id]/transfer.
 */
function internalAlias(businessName: string): string {
  const domain = process.env.VD_OPS_EMAIL_DOMAIN ?? 'visitdrakensberg.co.za'
  const base = process.env.VD_OPS_EMAIL_LOCAL ?? 'ops'
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
  // 4-char random suffix prevents collisions on similarly named suppliers
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}+${slug}-${suffix}@${domain}`
}

/**
 * POST /api/admin/ops/create-supplier
 *
 * Creates an internally-managed supplier profile. Accessible to:
 *   - Platform admins (role = 'admin')
 *   - VD Operations administrators (ops_role = 'ops_administrator')
 *
 * No external email address is required. A VD-controlled internal alias is
 * generated automatically so all VD-managed supplier accounts live under the
 * same domain. When the property owner is ready to take over, use
 * POST /api/admin/supplier/[id]/transfer to update the login email.
 *
 * An optional ownerContactEmail can be stored in metadata from the start so
 * the transfer destination is recorded before it's needed.
 *
 * Flow:
 *   1. Generate internal alias email.
 *   2. Create auth user with alias + role='supplier' + vd_managed=true.
 *   3. Update profile with supplier_type, is_approved=true.
 *   4. If caller is ops_administrator (not full admin), auto-create assignment.
 */
export async function POST(req: Request) {
  let body: {
    businessName?: string
    supplierType?: string
    ownerContactEmail?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.businessName?.trim()) {
    return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
  }
  if (!body.supplierType || !VALID_SUPPLIER_TYPES.includes(body.supplierType)) {
    return NextResponse.json({ error: 'A valid supplier type is required.' }, { status: 400 })
  }

  // Validate optional owner contact email if provided
  const ownerContactEmail = body.ownerContactEmail?.trim().toLowerCase() || null
  if (ownerContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerContactEmail)) {
    return NextResponse.json({ error: 'Invalid owner contact email address.' }, { status: 400 })
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
  const alias = internalAlias(body.businessName.trim())

  // Create the auth user using the internal alias.
  // email_confirm=true skips verification — VD owns this alias, no inbox check needed.
  // vd_managed=true in app_metadata flags it as internally managed so the UI
  // can distinguish VD-managed accounts from self-registered ones.
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: alias,
    email_confirm: true,
    app_metadata: {
      vd_managed: true,
    },
    user_metadata: {
      full_name: body.businessName.trim(),
      role: 'supplier',
      ...(ownerContactEmail ? { owner_contact_email: ownerContactEmail } : {}),
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
    // Non-fatal: auth user exists; admin can correct the profile.
  }

  // Ops administrators are automatically assigned to the supplier they create.
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

  return NextResponse.json({ supplierId, alias })
}
