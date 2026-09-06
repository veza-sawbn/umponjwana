'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Minus, Plus } from 'lucide-react'

// Answers describe what the platform actually does — the operator marketplace,
// per-vehicle pricing, the meet & greet fields, the dispatch fallback — and the
// cancellation line follows the published terms rather than inventing a policy.
const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Is the shuttle private, or will I share with other travellers?',
    a: 'Every transfer booked here is a private vehicle for your party alone. You are never pooled with strangers, and the fare you see is for the whole vehicle, not per seat.',
  },
  {
    q: 'How is the price worked out?',
    a: 'Each operator sets a rate for every vehicle in its fleet, and the fare is that vehicle’s rate applied to the real driving distance of your route, plus a loading for extra passengers. You see the total before you choose, and it does not change afterwards.',
  },
  {
    q: 'Who actually drives me?',
    a: 'A registered Drakensberg transport operator that you pick yourself from the list of companies covering your route. Every one has been verified by our office — they hold either a current EDTEA tourism operator registration or membership of a Community Tourism Organisation, and they are bound by our Supplier Code of Conduct.',
  },
  {
    q: 'What if no operator covers my route?',
    a: 'You can still book. When no registered partner covers the trip yet, our team places it with the best available operator after checkout, at the quoted price.',
  },
  {
    q: 'Can you meet me at the airport?',
    a: 'Yes. Give us your flight number and airline when you book and your operator tracks the flight, waits if you land late, and meets you with a name board. You can also leave a contact number, luggage details and any child-seat needs.',
  },
  {
    q: 'How many passengers and how much luggage fit?',
    a: 'Set your passenger count on the search form and only vehicles with enough seats for your party are offered, from sedans through to minibuses and coaches. Tell your operator about oversized luggage — bikes, boards, climbing kit — in the booking notes so they send the right vehicle.',
  },
  {
    q: 'Can I book a return trip at the same time?',
    a: 'Yes. Choose "Return" on the search form and both legs are quoted together and added to your trip, each with its own date, time and operator.',
  },
  {
    q: 'What if my plans change?',
    a: (
      <>
        Free cancellation until 48 hours before pickup; after that the standard marketplace terms apply, and a
        cancellation within 24 hours forfeits the fare. If your operator cancels, you are refunded in full within
        5 business days. The full detail is in our <Link href="/terms" className="text-gold underline underline-offset-2 hover:text-forest">Terms of Use</Link>.
      </>
    ),
  },
  {
    q: 'When do I pay?',
    a: 'Nothing is charged while you compare operators. The transfer joins your trip, and you pay at checkout in South African Rand — the service fee and VAT are shown before you confirm.',
  },
]

export function ShuttleFaq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-12 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        <div className="lg:sticky lg:top-24 h-fit">
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">Good to know</p>
          <h2 className="font-display text-3xl sm:text-4xl text-forest mb-3">Questions before you book</h2>
          <p className="font-sans text-sm text-forest/50">
            Anything specific about your route — an early flight, a rough access road, oversized luggage — you can
            raise directly with your operator once the transfer is in your trip.
          </p>
        </div>

        <dl className="lg:col-span-2 border-t border-black/8">
          {FAQS.map((faq, i) => {
            const isOpen = open === i
            return (
              <div key={faq.q} className="border-b border-black/8">
                <dt>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-start justify-between gap-4 py-4 text-left group"
                  >
                    <span className="font-sans text-sm text-forest group-hover:text-gold transition-colors">{faq.q}</span>
                    <span className="shrink-0 text-forest/40 group-hover:text-gold transition-colors mt-0.5">
                      {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                    </span>
                  </button>
                </dt>
                {isOpen && (
                  <dd className="pb-5 pr-8 font-sans text-sm text-forest/55 leading-relaxed">{faq.a}</dd>
                )}
              </div>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
