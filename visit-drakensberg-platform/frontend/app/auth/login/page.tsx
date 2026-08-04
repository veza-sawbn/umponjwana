'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn, resolveStaffAccess } from '@/lib/auth'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setAuthError(null)
    try {
      const result = await signIn(data.email, data.password)
      const role = result?.user?.app_metadata?.role ?? result?.user?.user_metadata?.role
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      // Metadata can lag behind a promotion made in profiles, so confirm there
      // before dropping a staff member on /account — during maintenance mode
      // that page is the end of the road, with the public site redirecting.
      const { isStaff } = role === 'admin' || role === 'supplier'
        ? { isStaff: role === 'admin' }
        : await resolveStaffAccess()
      const defaultPath = role === 'supplier' ? '/supplier' : (role === 'admin' || isStaff) ? '/admin' : '/account'
      const targetPath = redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : defaultPath
      // Hard navigation: guarantees the middleware sees the fresh session
      // cookie and bypasses any prefetched redirect cached by the router.
      window.location.assign(targetPath)
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed')
    }
  }

  return (
    <div className="min-h-screen bg-mist flex">
      {/* Left — image */}
      <div className="hidden lg:block relative w-1/2">
        <img
          src="https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1200&q=85"
          alt="Drakensberg"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-forest/40" />
        <div className="absolute bottom-12 left-12 right-12">
          <Link href="/" className="font-display italic text-2xl text-gold">Visit Drakensberg</Link>
          <p className="font-sans text-sm text-white/60 mt-3 leading-relaxed">
            Africa&apos;s highest mountain range. Book stays, hikes, and experiences across the Drakensberg escarpment.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden font-display italic text-xl text-forest block mb-10">
            Visit Drakensberg
          </Link>
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Welcome back</p>
          <h1 className="font-display text-4xl text-forest mb-8">Sign in</h1>

          {authError && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 font-sans text-sm text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest transition-colors ${errors.email ? 'border-red-400' : 'border-black/15'}`}
              />
              {errors.email && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50">Password</label>
                <Link href="/auth/forgot-password" className="font-sans text-xs text-forest/40 hover:text-gold transition-colors">
                  Forgot?
                </Link>
              </div>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest focus:outline-none focus:border-forest transition-colors ${errors.password ? 'border-red-400' : 'border-black/15'}`}
              />
              {errors.password && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-forest text-white py-3.5 font-sans text-sm hover:bg-sage transition-colors disabled:opacity-50 mt-2"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="font-sans text-sm text-forest/50 text-center mt-8">
            No account?{' '}
            <Link href="/auth/register" className="text-forest hover:text-gold transition-colors font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
