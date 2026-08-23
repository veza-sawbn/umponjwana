'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import EmailCampaignForm from '@/components/admin/EmailCampaignForm'

export default function NewEmailCampaignPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Campaigns</Link>
      <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000] mb-6 lg:mb-8">New Campaign</h1>
      <EmailCampaignForm campaign={null} />
    </div>
  )
}
