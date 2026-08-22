'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import EmailCampaignForm from '@/components/admin/EmailCampaignForm'
import { getEmailCampaign, type EmailCampaign } from '@/lib/email-campaigns-admin'

export default function EditEmailCampaignPage() {
  const params = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const id = params?.id
    if (!id) return
    getEmailCampaign(id).then(c => {
      if (!c) { setNotFound(true) } else { setCampaign(c) }
      setLoading(false)
    })
  }, [params?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href={`/admin/campaigns/${params?.id}`} className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Campaign</Link>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
      ) : notFound ? (
        <p className="font-sans text-sm text-gray-400">Campaign not found.</p>
      ) : (
        <>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000] mb-6 lg:mb-8">Edit Campaign</h1>
          <EmailCampaignForm campaign={campaign} />
        </>
      )}
    </div>
  )
}
