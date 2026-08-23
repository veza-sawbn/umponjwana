import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export function createServerClient() {
  return createServerComponentClient({ cookies })
}

export async function getServerSession() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getServerUser() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export async function requireRole(role: 'admin' | 'supplier' | 'visitor') {
  const session = await requireAuth()
  // app_metadata is service-role only; user_metadata is self-editable and is
  // therefore never consulted for authorisation — reading it here would let a
  // caller grant themselves the role they are being checked for. Accounts
  // without an app_metadata grant fall back to profiles, which only the
  // admin_set_* RPCs write. See 20260809_signup_role_hardening.sql.
  let userRole: string | undefined = session.user.app_metadata?.role
  if (!userRole) {
    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    userRole = profile?.role ?? 'visitor'
  }
  if (userRole !== role && !(role === 'visitor')) {
    throw new Error(`Forbidden: requires ${role} role`)
  }
  return session
}
