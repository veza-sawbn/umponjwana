'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPassword } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      await resetPassword(data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setAuthError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-[#2D6A4F]">Visit Drakensberg</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-[#2D6A4F] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
              <p className="text-gray-500 text-sm mb-2">
                We sent a password reset link to:
              </p>
              <p className="font-medium text-gray-800 mb-6">{sentEmail}</p>
              <p className="text-xs text-gray-400 mb-6">
                The link expires in 1 hour. If you don&apos;t see the email, check your spam folder.
              </p>
              <Link
                href="/auth/login"
                className="block w-full bg-[#2D6A4F] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#245a42] transition-colors text-center"
              >
                Back to Login
              </Link>
              <button
                onClick={() => setSent(false)}
                className="mt-3 text-sm text-gray-500 underline"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-800 mb-1">Forgot your password?</h1>
              <p className="text-gray-500 text-sm mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {authError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#2D6A4F] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#245a42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Sending…
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Remember your password?{' '}
                <Link href="/auth/login" className="text-[#2D6A4F] font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
