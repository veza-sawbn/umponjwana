import type { Metadata } from 'next'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms and conditions for using the Visit Drakensberg platform and making bookings.',
  alternates: { canonical: '/terms' },
}

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. The platform',
    body: [
      'Visit Drakensberg is a booking marketplace connecting visitors with independent accommodation providers, guides, activity operators and shuttle services ("suppliers"). Each booking is a contract between you and the supplier; Visit Drakensberg facilitates the booking and payment.',
    ],
  },
  {
    heading: '2. Bookings and payment',
    body: [
      'Prices are shown in South African Rand (ZAR) and include VAT where applicable. A service fee is added at checkout and shown before you pay.',
      'A booking is confirmed once payment has been accepted and a booking reference issued.',
    ],
  },
  {
    heading: '3. Cancellations and refunds',
    body: [
      'Unless the listing states otherwise: free cancellation until 48 hours before check-in or the activity start time; after that, the first night or 50% of the activity fee is non-refundable; cancellations within 24 hours forfeit the full amount.',
      'If a supplier cancels your booking, you receive a full refund within 5 business days.',
    ],
  },
  {
    heading: '4. Outdoor activities and risk',
    body: [
      'Hiking, climbing and other mountain activities carry inherent risk. You participate at your own risk and are responsible for ensuring you have adequate fitness, equipment and travel insurance. Follow the instructions of guides and park authorities at all times.',
    ],
  },
  {
    heading: '5. Supplier obligations',
    body: [
      'Every business listed here is bound by our Supplier Agreement and Supplier Code of Conduct. Among other things, they warrant that their listings are accurate, that they will honour confirmed bookings at the listed price, and that they hold the licences and insurance their operation requires.',
      'Before a listing goes live our verification office checks that the operator holds either a current EDTEA tourism operator registration or membership of a Community Tourism Organisation. A supplier whose accreditation lapses may be suspended from public view.',
      'If you believe a supplier has breached the Code — on safety, on how you or their staff were treated, or on how your information was used — report it at /report-a-concern. You may do so anonymously.',
    ],
  },
  {
    heading: '6. Liability',
    body: [
      'To the maximum extent permitted by law, Visit Drakensberg is not liable for the acts or omissions of suppliers, for personal injury during activities, or for indirect or consequential loss. Nothing in these terms limits liability that cannot be excluded under South African law, including under the Consumer Protection Act.',
    ],
  },
]

export default function TermsPage() {
  return (
    <main className="bg-mist min-h-screen">
      <section className="bg-forest text-white pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-3">Legal</p>
          <h1 className="font-display italic text-4xl lg:text-5xl">Terms of Use</h1>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="font-sans text-sm text-forest/50 mb-10">Last updated: September 2026</p>
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
