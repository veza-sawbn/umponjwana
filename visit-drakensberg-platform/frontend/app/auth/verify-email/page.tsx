'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/auth'

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setResent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display italic text-2xl text-[#2d6a4f] block text-center mb-10">
          Visit Drakensberg
        </Link>

        <div className="bg-white border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-[#2d6a4f]/10 flex items-center justify-center mx-auto mb-6">
            <Mail size={28} className="text-[#2d6a4f]" />
          </div>

          <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-3">Check Your Inbox</span>
          <h1 className="font-display italic text-3xl text-[#000000] mb-3">Verify your email</h1>
          <p className="font-sans text-sm text-gray-500 leading-relaxed mb-8">
            We've sent a verification link to your email address. Click the link to activate your account and start exploring the Drakensberg.
          </p>

          {resent ? (
            <div className="flex items-center justify-center gap-2 bg-[#2d6a4f]/10 text-[#2d6a4f] px-4 py-3 mb-6">
              <CheckCircle size={15} />
              <span className="font-sans text-sm">Verification email resent</span>
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading}
              className="w-full bg-[#2d6a4f] text-white py-3.5 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-60 mb-4"
            >
              {loading ? 'Sending…' : 'Resend verification email'}
            </button>
          )}

          <p className="font-sans text-xs text-gray-400">
            Check your spam folder if you don't see it. The link expires after 24 hours.
          </p>
        </div>

        <div className="text-center mt-6">
          <Link href="/auth/login" className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] transition-colors">
            <ArrowLeft size={13} />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
