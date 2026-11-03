'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase, intentionalSignOut } from '@/lib/auth'

/**
 * Keeps a signed-in portal (admin, supplier, operations) honest about its
 * sign-in. When the session ends while a page is open — signed out in another
 * tab, an expired or revoked refresh token — the page used to stay up looking
 * signed in, and every save went to the database with no user and failed with
 * "new row violates row-level security policy". Now it goes straight to the
 * sign-in page, says why, and comes back here afterwards.
 */
export default function SessionGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const toLogin = () => {
      // A deliberate Sign out already navigates to the sign-in page itself.
      if (intentionalSignOut) return
      try { sessionStorage.removeItem('vd_managed_supplier_id') } catch {}
      const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname
      router.replace(`/auth/login?reason=signed_out&redirect=${encodeURIComponent(back)}`)
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) toLogin()
    })
    // A tab left open in the background: check again when it comes back.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      supabase.auth.getSession().then(({ data }) => { if (!data.session) toLogin() })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, pathname])

  return null
}
