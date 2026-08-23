'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import EmailTemplateForm from '@/components/admin/EmailTemplateForm'

export default function NewEmailTemplatePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/admin/campaigns/templates" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6"><ArrowLeft size={14} /> Back to Templates</Link>
      <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000] mb-6 lg:mb-8">New Template</h1>
      <EmailTemplateForm template={null} />
    </div>
  )
}
