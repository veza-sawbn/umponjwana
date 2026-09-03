import type { Metadata } from 'next'
import LegalDocument from '@/components/legal/LegalDocument'
import { CODE_OF_CONDUCT_SECTIONS, CODE_OF_CONDUCT_VERSION } from '@/lib/supplier-agreement'

export const metadata: Metadata = {
  title: 'Supplier Code of Conduct',
  description:
    'What Visit Drakensberg expects of every business listed with us — guest safety, fair treatment of guests and workers, respect for communities and the mountain, and how to raise a concern.',
  alternates: { canonical: '/supplier-code-of-conduct' },
}

export default function SupplierCodeOfConductPage() {
  return (
    <LegalDocument
      eyebrow="Suppliers"
      title="Supplier Code of Conduct"
      intro="What we expect of every business listed with us, and of everyone who works for them. Accepted alongside the Supplier Agreement before a listing goes live."
      version={CODE_OF_CONDUCT_VERSION}
      updated="September 2026"
      sections={CODE_OF_CONDUCT_SECTIONS}
      companion={{ href: '/supplier-terms', label: 'Supplier Agreement' }}
    />
  )
}
