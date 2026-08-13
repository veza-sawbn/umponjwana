'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/auth'

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)
  const [done, setDone] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  // Supabase delivers the auth token in one of four ways depending on the
  // project's auth flow setting and which route the email linked to:
  //
  //   0. Server-side callback (preferred new path)
  //      POST /api/auth/request-password-reset sets redirectTo to
  //      /api/auth/callback, which exchanges the PKCE code server-side and
  //      redirects here with the session cookie already set.
  //      → getSession() returns a session immediately; or onAuthStateChange
  //        fires PASSWORD_RECOVERY / SIGNED_IN.
  //      → ?error=link_expired is appended when the code exchange fails.
  //
  //   1. PKCE auth-code  → ?code=AUTH_CODE (direct link to this page)
  //      Call exchangeCodeForSession(code) — onAuthStateChange fires on success.
  //
  //   2. PKCE token-hash → ?token_hash=HASH&type=invite|recovery
  //      Call verifyOtp({ token_hash, type }) — onAuthStateChange fires on success.
  //
  //   3. Implicit (legacy) → #access_token=…&type=invite|recovery (URL hash)
  //      The client picks it up automatically; onAuthStateChange fires on its own.
  //
  // In all cases the form is gated behind onAuthStateChange firing with
  // PASSWORD_RECOVERY or SIGNED_IN, or an existing session being found.
  // A 3600 s safety-net timeout is only started when no URL token is found
  // (implicit flow fallback — the timeout is intentionally long to give
  // the hash exchange time to complete before showing "link expired").
  //
  // Edge case: user refreshes the page after a successful exchange — the URL
  // still has the (now-consumed) token. We check for an existing session first
  // and set ready immediately, avoiding a spurious "link expired" screen.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    // ── Case 0b: server-side callback signalled a failed exchange ─────────────
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'link_expired') {
      setInvalidLink(true)
      return
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setInvalidLink(false)
        clearTimeout(timeout)
      }
    })

    async function bootstrap() {
      // ── Case 0a / page-refresh: already have a session ────────────────────
      // This covers both the server-side callback flow (session set in cookies
      // before redirect here) and refreshing the page after a successful exchange.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
        return
      }

      const code      = params.get('code')
      const tokenHash = params.get('token_hash')
      const type      = params.get('type') as 'invite' | 'recovery' | 'email' | null

      // ── Case 1: PKCE auth-code (?code=…) ────────────────────────────────────
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          // May have already been exchanged — check for an active session
          const { data: { session: s } } = await supabase.auth.getSession()
          if (s) { setReady(true); return }
          setInvalidLink(true)
        }
        // Success: onAuthStateChange fires with SIGNED_IN / PASSWORD_RECOVERY
        return
      }

      // ── Case 2: PKCE token-hash (?token_hash=…&type=…) ──────────────────────
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        if (error) {
          // Token consumed on a previous load — check for an active session
          const { data: { session: s } } = await supabase.auth.getSession()
          if (s) { setReady(true); return }
          setInvalidLink(true)
        }
        // Success: onAuthStateChange fires
        return
      }

      // ── Case 3: Implicit flow (#access_token=… hash) ─────────────────────────
      // The client exchanges the hash automatically; we just wait for the event.
      // Start the 3600 s safety-net in case no token is present at all.
      timeout = setTimeout(() => {
        setReady(r => {
          if (!r) setInvalidLink(true)
          return r
        })
      }, 3_600_000)
    }

    bootstrap()

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const onSubmit = async (data: Form) => {
    setAuthError(null)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setAuthError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2500)
  }

  return (
    <div className="min-h-screen bg-mist flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display italic text-xl text-forest block mb-10">
          Visit Drakensberg
        </Link>

        {done ? (
          <div>
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">All set</p>
            <h1 className="font-display text-3xl text-forest mb-4">Password updated</h1>
            <p className="font-sans text-sm text-forest/60 leading-relaxed mb-8">
              Your password has been changed. Redirecting you to sign in…
            </p>
            <Link href="/auth/login" className="font-sans text-sm text-forest underline hover:text-gold transition-colors">
              Go to sign in now
            </Link>
          </div>
        ) : invalidLink ? (
          <div>
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Link expired</p>
            <h1 className="font-display text-3xl text-forest mb-4">This link is no longer valid</h1>
            <p className="font-sans text-sm text-forest/60 leading-relaxed mb-8">
              This link has expired or has already been used. Request a new one and try again — new links are valid for 60 minutes.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-block px-6 py-3 bg-forest text-white font-sans text-sm hover:bg-sage transition-colors"
            >
              Request new link
            </Link>
          </div>
        ) : (
          <>
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Almost there</p>
            <h1 className="font-display text-4xl text-forest mb-8">Create your password</h1>

            {authError && (
              <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 font-sans text-sm text-red-700">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div>
                <label htmlFor="new-password" className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">
                  New password
                </label>
                <input
                  {...register('password')}
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest focus:outline-none focus:border-forest transition-colors ${errors.password ? 'border-red-400' : 'border-black/15'}`}
                />
                {errors.password && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirm-password" className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">
                  Confirm password
                </label>
                <input
                  {...register('confirm')}
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest focus:outline-none focus:border-forest transition-colors ${errors.confirm ? 'border-red-400' : 'border-black/15'}`}
                />
                {errors.confirm && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.confirm.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !ready}
                className="w-full bg-forest text-white py-3.5 font-sans text-sm hover:bg-sage transition-colors disabled:opacity-50 mt-2"
              >
                {isSubmitting ? 'Updating…' : ready ? 'Update password' : 'Verifying link…'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
