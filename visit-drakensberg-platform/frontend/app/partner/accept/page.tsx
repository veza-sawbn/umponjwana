'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { acceptInvitation } from '@/lib/partner-access'
import { supabase } from '@/lib/auth'
import Logo from '@/components/Logo'

// Invitation acceptance. This sits outside the partner layout on purpose: the
// invitee has no establishment access until this page succeeds, so anything
// that assumes an assigned establishment would fail to render.
//
// The token is only ever handed to the database. vd_accept_establishment_
// invitation matches it server-side and refuses an account whose email differs
// from the invited address, so a forwarded link is useless to anyone else.

function AcceptInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [state, setState] = useState<'checking' | 'ready' | 'working' | 'done' | 'error'>('checking')
  const [message, setMessage] = useState('')
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    if (!token) { setState('error'); setMessage('This link is missing its invitation token.'); return }
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user)
      setState('ready')
    }).catch(() => setState('ready'))
  }, [token])

  async function accept() {
    setState('working')
    try {
      await acceptInvitation(token)
      setState('done')
      setTimeout(() => router.push('/partner'), 1500)
    } catch (e) {
      setState('error')
      setMessage(e instanceof Error ? e.message : 'This invitation could not be accepted.')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-black px-8 py-7">
          <Logo className="w-44 text-white" />
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mt-4">Partner portal</p>
        </div>

        <div className="bg-white border border-gray-200 border-t-0 px-8 py-8">
          {state === 'checking' && (
            <p className="font-sans text-sm text-gray-500 flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" /> Checking your invitation…
            </p>
          )}

          {state === 'ready' && !signedIn && (
            <>
              <h1 className="font-display italic text-2xl mb-2">Sign in to continue</h1>
              <p className="font-sans text-sm text-gray-500 mb-6">
                This invitation can only be accepted by the account it was sent to. Sign in or create
                your account with that email address, then return to this link.
              </p>
              <Link href={`/auth/login?redirect=${encodeURIComponent(`/partner/accept?token=${token}`)}`}
                className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245741] transition-colors">
                Sign in
              </Link>
            </>
          )}

          {state === 'ready' && signedIn && (
            <>
              <h1 className="font-display italic text-2xl mb-2">Accept your invitation</h1>
              <p className="font-sans text-sm text-gray-500 mb-6">
                Accepting adds the establishment to your partner dashboard. Visit Drakensberg remains the
                platform administrator, and your access can be adjusted or withdrawn at any time.
              </p>
              <button onClick={accept}
                className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245741] transition-colors">
                <ShieldCheck size={15} /> Accept and continue
              </button>
            </>
          )}

          {state === 'working' && (
            <p className="font-sans text-sm text-gray-500 flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" /> Setting up your access…
            </p>
          )}

          {state === 'done' && (
            <>
              <h1 className="font-display italic text-2xl mb-2 text-[#2d6a4f]">You’re all set</h1>
              <p className="font-sans text-sm text-gray-500">Taking you to your dashboard…</p>
            </>
          )}

          {state === 'error' && (
            <>
              <h1 className="font-display italic text-2xl mb-2 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-400" /> Unable to accept
              </h1>
              <p className="font-sans text-sm text-gray-500 mb-6">{message}</p>
              <p className="font-sans text-xs text-gray-400">
                Invitations expire after 14 days, can be used once, and only by the invited email
                address. Ask your Visit Drakensberg contact to issue a new one.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F5F2]" />}>
      <AcceptInner />
    </Suspense>
  )
}
