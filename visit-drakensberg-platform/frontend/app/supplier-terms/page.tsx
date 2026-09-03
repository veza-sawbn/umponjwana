import type { Metadata } from 'next'
import LegalDocument from '@/components/legal/LegalDocument'
import { SUPPLIER_TERMS_SECTIONS, SUPPLIER_TERMS_VERSION } from '@/lib/supplier-agreement'

export const metadata: Metadata = {
  title: 'Supplier Agreement',
  description:
    'The commercial agreement between Visit Drakensberg and the businesses listed on it — accreditation, commission, settlement, listing accuracy and guest data.',
  alternates: { canonical: '/supplier-terms' },
}

export default function SupplierTermsPage() {
  return (
    <LegalDocument
      eyebrow="Suppliers"
      title="Supplier Agreement"
      intro="The commercial terms between Visit Drakensberg and the businesses listed with us. Accepted alongside the Supplier Code of Conduct before a listing goes live."
      version={SUPPLIER_TERMS_VERSION}
      updated="September 2026"
      sections={SUPPLIER_TERMS_SECTIONS}
      companion={{ href: '/supplier-code-of-conduct', label: 'Supplier Code of Conduct' }}
    />
  )
}
