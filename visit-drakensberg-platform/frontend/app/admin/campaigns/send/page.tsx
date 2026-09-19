'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ManualSendForm from '@/components/admin/ManualSendForm'

export default function ManualSendPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6">
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>
      <div className="mb-6 lg:mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Send to Selected Contacts</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          Pick a template and the exact people to send it to — customers, directory businesses, or both.
        </p>
      </div>
      <ManualSendForm />
    </div>
  )
}
