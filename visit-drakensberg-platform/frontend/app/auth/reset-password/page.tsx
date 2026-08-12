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

  // Supabase delivers the recovery/invite token in the URL hash; the client
  // exchanges it for a session automatically. We wait for either:
  //   a) onAuthStateChange fires PASSWORD_RECOVERY or SIGNED_IN  ← normal path
  //   b) getSession() already has a session (token was exchanged synchronously)
  //   c) 10 s timeout elapses with no session → declare the link invalid
  //
  // 10 s gives slow mobile connections enough time. The OTP expiry is
  // configured to 3600 s in Supabase Auth settings; the link itself lasts
  // 60 minutes — the timeout here is only a UI safety net, not expiry logic.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setInvalidLink(false)
        clearTimeout(timeout)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Token already exchanged (e.g. returning to the tab)
        setReady(true)
      } else {
        // Give the auth helper time to exchange the hash token.
        // 10 000 ms handles slow connections; the real expiry is server-side.
        timeout = setTimeout(() => {
          setReady(r => {
            if (!r) setInvalidLink(true)
            return r
          })
        }, 10_000)
      }
    })

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
