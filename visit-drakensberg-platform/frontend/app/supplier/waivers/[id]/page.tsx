'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getWaiverTemplate, type WaiverTemplate } from '@/lib/waivers'
import WaiverTemplateForm from '@/components/waivers/WaiverTemplateForm'

export default function EditWaiverTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const [template, setTemplate] = useState<WaiverTemplate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWaiverTemplate(id).then(t => { setTemplate(t); setLoading(false) })
  }, [id])

  if (loading) {
    return <div className="p-4 sm:p-6 lg:p-8"><p className="font-sans text-sm text-black/30">Loading…</p></div>
  }

  if (!template) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="font-sans text-sm text-black/50 mb-3">
          This waiver form doesn&apos;t exist, or it belongs to another supplier.
        </p>
        <Link href="/supplier/waivers" className="font-sans text-sm text-[#2d6a4f] hover:underline">
          Back to waivers
        </Link>
      </div>
    )
  }

  return <WaiverTemplateForm existing={template} />
}
