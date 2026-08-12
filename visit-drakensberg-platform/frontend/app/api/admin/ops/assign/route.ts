import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { ALL_PERMISSIONS } from '@/lib/ops-assignments'

export const dynamic = 'force-dynamic'

const VALID_PERMISSIONS = new Set(ALL_PERMISSIONS.map(p => p.key))

/**
 * POST /api/admin/ops/assign
 * Create or update a management assignment linking an employee to a supplier.
 * Admin only. Calls the admin_set_ops_assignment() SECURITY DEFINER RPC so
 * the DB enforces authorization rather than relying on the API route alone.
 */
export async function POST(req: Request) {
  let body: {
    employeeId?: string
    supplierId?: string
    permissions?: string[]
    isActive?: boolean
    endedAt?: string | null
    notes?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.employeeId || !/^[0-9a-f-]{36}$/.test(body.employeeId)) {
    return NextResponse.json({ error: 'valid employeeId required' }, { status: 400 })
  }
  if (!body.supplierId || !/^[0-9a-f-]{36}$/.test(body.supplierId)) {
    return NextResponse.json({ error: 'valid supplierId required' }, { status: 400 })
  }
  if (!Array.isArray(body.permissions)) {
    return NextResponse.json({ error: 'permissions array required' }, { status: 400 })
  }

  // Filter to only known permission strings (defence in depth)
  const permissions = body.permissions.filter(p => VALID_PERMISSIONS.has(p))

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('admin_set_ops_assignment', {
    p_employee_id: body.employeeId,
    p_supplier_id: body.supplierId,
    p_permissions: permissions,
    p_is_active: body.isActive ?? true,
    p_ended_at: body.endedAt ?? null,
    p_notes: body.notes ?? null,
  })

  if (error) {
    console.error('[ops/assign] failed:', error)
    return NextResponse.json({ error: error.message || 'Could not save assignment' }, { status: 500 })
  }

  return NextResponse.json({ assignmentId: data })
}
