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
  // app_metadata is only settable server-side; user_metadata is self-editable.
  const userRole = session.user.app_metadata?.role ?? session.user.user_metadata?.role ?? 'visitor'
  if (userRole !== role && !(role === 'visitor')) {
    throw new Error(`Forbidden: requires ${role} role`)
  }
  return session
}
