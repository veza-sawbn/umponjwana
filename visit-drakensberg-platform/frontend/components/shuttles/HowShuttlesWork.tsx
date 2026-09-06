'use client'

import { CalendarCheck, CarFront, ClipboardList, Search } from 'lucide-react'

// The four things that happen between typing a route and being driven —
// stated plainly, because a marketplace transfer is unfamiliar to most
// visitors and the unknown is what stops people booking.
const STEPS = [
  {
    icon: Search,
    title: 'Tell us the route',
    body: 'Pickup, drop-off, date and time. We measure the real driving distance and time from Google, not a fixed route table.',
  },
  {
    icon: ClipboardList,
    title: 'Compare registered operators',
    body: 'Every operator that covers your route appears with its price, rating, completed trips and the vehicles it has free that day.',
  },
  {
    icon: CalendarCheck,
    title: 'Pick your vehicle and pay',
    body: 'You choose the company and the exact vehicle. The fare is that vehicle’s own rate — no surge, no auction, nothing added later.',
  },
  {
    icon: CarFront,
    title: 'Meet your driver',
    body: 'Your operator gets the trip, reserves the vehicle and assigns a driver. Share a flight number and they will track it and meet you with a name board.',
  },
]

export function HowShuttlesWork() {
  return (
    <section className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-12 md:py-16">
      <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">How it works</p>
      <h2 className="font-display text-3xl sm:text-4xl text-forest mb-3">Booking a shuttle, start to finish</h2>
      <p className="font-sans text-sm text-forest/50 max-w-2xl mb-8">
        Every transfer is a private vehicle from a registered Drakensberg operator. Here is the whole journey from
        search to pickup.
      </p>

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <li key={step.title} className="relative bg-white border border-black/8 p-5 flex flex-col">
              {/* The step number is the quiet spine of the section; the icon
                  carries it visually. */}
              <span className="absolute right-4 top-3 font-display text-4xl text-forest/[0.07] leading-none select-none" aria-hidden="true">
                {i + 1}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest/[0.06] border border-gold/30 mb-4">
                <Icon size={18} className="text-gold" strokeWidth={1.6} />
              </span>
              <h3 className="font-display text-lg text-forest leading-snug mb-2">{step.title}</h3>
              <p className="font-sans text-xs text-forest/50 leading-relaxed">{step.body}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
