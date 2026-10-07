'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// Landing page for the double-opt-in email. Asks for one click and POSTs the
// token, rather than confirming on load: mail scanners fetch every link in a
// message, and a confirm-on-GET would let one subscribe an address its owner
// never agreed to (see app/api/marketing/confirm).

function ConfirmForm() {
  const token = useSearchParams().get('token')
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'expired' | 'error'>('idle')

  async function confirm() {
    setStatus('working')
    try {
      const res = await fetch('/api/marketing/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      })
      setStatus(res.ok ? 'done' : res.status === 410 || res.status === 400 ? 'expired' : 'error')
    } catch { setStatus('error') }
  }

  if (!token || status === 'expired') {
    return (
      <div className="text-center">
        <h1 className="font-display italic text-3xl text-[#000000] mb-3">This link has expired</h1>
        <p className="font-sans text-sm text-gray-500 mb-6">Confirmation links last 7 days. Sign up again from the homepage and we&apos;ll send a fresh one.</p>
        <Link href="/" className="font-sans text-sm text-[#2d6a4f] hover:text-[#C9A96E] transition-colors">Return to Visit Drakensberg</Link>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="text-center">
        <h1 className="font-display italic text-3xl text-[#000000] mb-3">You&apos;re on the list</h1>
        <p className="font-sans text-sm text-gray-500 mb-6">Thanks for confirming. Every email has an unsubscribe link, and you can leave at any time.</p>
        <Link href="/" className="font-sans text-sm text-[#2d6a4f] hover:text-[#C9A96E] transition-colors">Return to Visit Drakensberg</Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <h1 className="font-display italic text-3xl text-[#000000] mb-3">Confirm your subscription</h1>
      <p className="font-sans text-sm text-gray-500 mb-6">One click to confirm you&apos;d like to hear from Visit Drakensberg.</p>
      <button
        onClick={confirm}
        disabled={status === 'working'}
        className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50"
      >
        {status === 'working' ? 'Confirming…' : 'Confirm subscription'}
      </button>
      {status === 'error' && <p className="font-sans text-xs text-red-500 mt-4">Something went wrong. Please try again.</p>}
    </div>
  )
}

export default function SubscribedPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Suspense>
          <ConfirmForm />
        </Suspense>
      </div>
    </div>
  )
}
