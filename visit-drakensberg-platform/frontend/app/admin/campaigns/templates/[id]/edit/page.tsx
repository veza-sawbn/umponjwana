'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import EmailTemplateForm from '@/components/admin/EmailTemplateForm'
import { getEmailTemplate, type EmailTemplate } from '@/lib/email-campaigns-admin'

export default function EditEmailTemplatePage() {
  const params = useParams<{ id: string }>()
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const id = params?.id
    if (!id) return
    getEmailTemplate(id).then(t => {
      if (!t) { setNotFound(true) } else { setTemplate(t) }
      setLoading(false)
    })
  }, [params?.id])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/admin/campaigns/templates" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Templates</Link>
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
      ) : notFound ? (
        <p className="font-sans text-sm text-gray-400">Template not found.</p>
      ) : (
        <>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000] mb-6 lg:mb-8">Edit Template</h1>
          <EmailTemplateForm template={template} />
        </>
      )}
    </div>
  )
}
