'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signUp } from '@/lib/auth';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    role: z.enum(['guest', 'supplier'], { required_error: 'Please select a role' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'guest' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setAuthError(null);
    try {
      await signUp(data.email, data.password, data.fullName, data.role);
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setAuthError(message);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="w-16 h-16 bg-[#2D6A4F] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email!</h2>
          <p className="text-gray-500 text-sm mb-6">
            We&apos;ve sent a confirmation link to your email address. Click it to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="block w-full bg-[#2D6A4F] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#245a42] transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-[#2D6A4F]">Visit Drakensberg</span>
          </Link>
          <h1 className="text-xl font-semibold text-gray-800 mt-4">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Join thousands of Drakensberg adventurers</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                {...register('fullName')}
                type="text"
                placeholder="Jane Doe"
                autoComplete="name"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] ${
                  errors.fullName ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.fullName && (
                <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] ${
                  errors.email ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                {...register('password')}
                type="password"
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] ${
                  errors.password ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                {...register('confirmPassword')}
                type="password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] ${
                  errors.confirmPassword ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am a…</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'guest', label: 'Guest', icon: '🧳', desc: 'Looking to book' },
                  { value: 'supplier', label: 'Supplier', icon: '🏡', desc: 'Listing property' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="relative flex flex-col items-center p-3 border rounded-lg cursor-pointer has-[:checked]:border-[#2D6A4F] has-[:checked]:bg-green-50 border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <input
                      {...register('role')}
                      type="radio"
                      value={opt.value}
                      className="sr-only"
                    />
                    <span className="text-2xl mb-1">{opt.icon}</span>
                    <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                    <span className="text-xs text-gray-500">{opt.desc}</span>
                  </label>
                ))}
              </div>
              {errors.role && (
                <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#2D6A4F] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#245a42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#2D6A4F] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
