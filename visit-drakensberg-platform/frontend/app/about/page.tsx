import type { Metadata } from 'next'
import AboutContent from './AboutContent'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: 'About Us',
  description:
    'Visit Drakensberg is the tourism discovery and booking platform for the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site in KwaZulu-Natal, South Africa.',
  alternates: { canonical: '/about' },
})

export default function AboutPage() {
  return <AboutContent />
}
