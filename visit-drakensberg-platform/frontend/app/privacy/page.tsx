import type { Metadata } from 'next'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Visit Drakensberg collects, uses and protects your personal information.',
  alternates: { canonical: '/privacy' },
  robots: { index: false },
}

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Information we collect',
    body: [
      'When you create an account or make a booking we collect your name, email address, phone number and any special requests you provide. Suppliers additionally provide business details for their listings.',
      'We do not store full payment card details on our servers. Payment information is handled by our payment processing provider.',
    ],
  },
  {
    heading: '2. How we use your information',
    body: [
      'We use your information to process bookings, communicate booking confirmations and changes, connect you with the suppliers you book with, and improve the platform.',
      'Suppliers you book with receive the guest details needed to fulfil your booking (name, party size, dates, contact details and special requests).',
    ],
  },
  {
    heading: '3. Sharing',
    body: [
      'We share booking details with the relevant supplier only. We do not sell personal information to third parties.',
    ],
  },
  {
    heading: '4. Retention and your rights',
    body: [
      'We retain booking records for as long as required for accounting and legal purposes. Under the Protection of Personal Information Act (POPIA), you may request access to, correction of, or deletion of your personal information by contacting hello@visitdrakensberg.com.',
    ],
  },
  {
    heading: '5. Cookies',
    body: [
      'We use essential cookies to keep you signed in and to remember your trip planning selections. We do not use third-party advertising cookies.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="bg-mist min-h-screen">
      <section className="bg-forest text-white pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-3">Legal</p>
          <h1 className="font-display italic text-4xl lg:text-5xl">Privacy Policy</h1>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="font-sans text-sm text-forest/50 mb-10">Last updated: July 2026</p>
        <div className="space-y-10">
          {SECTIONS.map(s => (
            <div key={s.heading}>
              <h2 className="font-display italic text-xl text-forest mb-3">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="font-sans text-sm text-forest/70 leading-relaxed mb-3">{p}</p>
              ))}
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}
