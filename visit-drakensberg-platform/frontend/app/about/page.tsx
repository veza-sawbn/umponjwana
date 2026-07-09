import type { Metadata } from 'next'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Visit Drakensberg is the tourism discovery and booking platform for the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site in KwaZulu-Natal, South Africa.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return <AboutContent />
}
