'use client'

import { CalendarCheck, CarFront, ClipboardList, Search } from 'lucide-react'

// The four things that happen between typing a route and being driven —
// stated plainly, because a marketplace transfer is unfamiliar to most
// visitors and the unknown is what stops people booking.
const STEPS = [
  {
    icon: Search,
    title: 'Tell us the route',
    body: 'Pickup, drop-off, date and time. We measure the real driving distance from Google.',
  },
  {
    icon: ClipboardList,
    title: 'Compare registered operators',
    body: 'Every operator covering your route, with its price, rating and the vehicles it has free.',
  },
  {
    icon: CalendarCheck,
    title: 'Pick your vehicle and pay',
    body: 'You choose the company and the exact vehicle. The fare is that vehicle’s own rate.',
  },
  {
    icon: CarFront,
    title: 'Meet your driver',
    body: 'Your operator reserves the vehicle and assigns a driver. Share a flight number and they will track it.',
  },
]

// A stop on the route: the icon in a plain white disc, its label beneath.
// No card — the dashed line is what holds the steps together.
function Stop({
  icon: Icon,
  title,
  body,
  className = '',
}: {
  icon: typeof Search
  title: string
  body: string
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg shadow-black/[0.06]">
        <Icon size={30} className="text-forest" strokeWidth={1.4} />
      </span>
      <h3 className="font-display text-lg text-forest leading-snug mt-4 max-w-[15rem]">{title}</h3>
      <p className="font-sans text-xs text-forest/45 leading-relaxed mt-1.5 max-w-[15rem]">{body}</p>
    </div>
  )
}

// The dashed route. Every segment is a border on a positioned box, so the
// corners stay true circles at any width — an SVG stretched to the section
// would smear them. Geometry is fixed and shared with the grid below:
// two rows 260px tall, stops centred on the quarter and three-quarter marks.
const dash = 'absolute border-dashed border-forest/20 pointer-events-none'

export function HowShuttlesWork() {
  return (
    <section className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-12 md:py-16">
      <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">How it works</p>
      <h2 className="font-display text-3xl sm:text-4xl text-forest mb-3">Booking a shuttle, start to finish</h2>
      <p className="font-sans text-sm text-forest/50 max-w-2xl mb-10 md:mb-4">
        Every transfer is a private vehicle from a registered Drakensberg operator. Here is the whole journey from
        search to pickup.
      </p>

      {/* ── Desktop: the route snakes across two rows ─────────────────────── */}
      <div className="relative hidden md:block h-[520px] max-w-5xl mx-auto" aria-hidden="true">
        {/* down from the intro, then right into the first stop */}
        <span className={`${dash} left-[6%] right-[75%] top-[8px] h-[36px] border-l-2 border-b-2 rounded-bl-[36px]`} />
        {/* stop 1 → stop 2 */}
        <span className={`${dash} left-1/4 right-1/4 top-[44px] border-t-2`} />
        {/* out to the right, down a row, and back in to stop 3 */}
        <span className={`${dash} left-[75%] right-[6%] top-[44px] h-[260px] border-t-2 border-r-2 border-b-2 rounded-r-[60px]`} />
        {/* stop 3 → stop 4 (this row reads right to left) */}
        <span className={`${dash} left-1/4 right-1/4 top-[304px] border-t-2`} />
        {/* out to the left and down to the end of the journey */}
        <span className={`${dash} left-[6%] right-[75%] top-[304px] h-[150px] border-t-2 border-l-2 rounded-tl-[60px]`} />

        {/* Journey's end. The `forest` token is black in this theme, so the
            arrival dot uses the brand green directly. */}
        <span className="absolute left-[6%] top-[454px] -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-[#2d6a4f]" />
        {/* Left-aligned rather than centred on the dot: centred, it would
            hang off the left edge once the columns narrow at md. */}
        <p className="absolute left-0 top-[474px] font-sans text-sm text-forest whitespace-nowrap">
          Enjoy the drive
        </p>

        {/* The stops themselves sit above the line; row two is laid out in
            reverse so the route doubles back the way it is drawn. */}
        <div className="relative z-10 grid grid-cols-2">
          <Stop {...STEPS[0]} className="row-start-1 col-start-1 h-[260px] pt-1" />
          <Stop {...STEPS[1]} className="row-start-1 col-start-2 h-[260px] pt-1" />
          <Stop {...STEPS[3]} className="row-start-2 col-start-1 h-[260px] pt-1" />
          <Stop {...STEPS[2]} className="row-start-2 col-start-2 h-[260px] pt-1" />
        </div>
      </div>

      {/* ── Mobile: the same route, turned on its side ────────────────────── */}
      <ol className="md:hidden relative">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <li key={step.title} className="relative flex gap-4 pb-8">
              {/* the run on to the next stop */}
              <span className="absolute left-[27px] top-16 -bottom-0 border-l-2 border-dashed border-forest/20" aria-hidden="true" />
              <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-lg shadow-black/[0.06]">
                <Icon size={22} className="text-forest" strokeWidth={1.4} />
              </span>
              <div className="flex-1 min-w-0 pt-2.5">
                <h3 className="font-display text-lg text-forest leading-snug">{step.title}</h3>
                <p className="font-sans text-xs text-forest/45 leading-relaxed mt-1.5">{step.body}</p>
              </div>
            </li>
          )
        })}
        <li className="relative flex items-center gap-4">
          <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center">
            <span className="h-4 w-4 rounded-full bg-[#2d6a4f]" />
          </span>
          <p className="font-sans text-sm text-forest">Enjoy the drive</p>
        </li>
      </ol>
    </section>
  )
}
