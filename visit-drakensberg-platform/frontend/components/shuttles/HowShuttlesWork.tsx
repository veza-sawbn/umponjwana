'use client'

import { CalendarCheck, CarFront, ClipboardList, Search } from 'lucide-react'

// The four things that happen between typing a route and being driven —
// stated plainly, because a marketplace transfer is unfamiliar to most
// visitors and the unknown is what stops people booking.
//
// `y` is where the step sits on the route line, as a percentage down the
// illustration band: the line climbs from search to pickup, so the four
// stops read as a plotted journey rather than four loose icons.
const STEPS = [
  {
    icon: Search,
    title: 'Tell us the route',
    body: 'Pickup, drop-off, date and time. We measure the real driving distance and time from Google, not a fixed route table.',
    y: 74,
  },
  {
    icon: ClipboardList,
    title: 'Compare registered operators',
    body: 'Every operator that covers your route appears with its price, rating, completed trips and the vehicles it has free that day.',
    y: 52,
  },
  {
    icon: CalendarCheck,
    title: 'Pick your vehicle and pay',
    body: 'You choose the company and the exact vehicle. The fare is that vehicle’s own rate — no surge, no auction, nothing added later.',
    y: 58,
  },
  {
    icon: CarFront,
    title: 'Meet your driver',
    body: 'Your operator gets the trip, reserves the vehicle and assigns a driver. Share a flight number and they will track it and meet you with a name board.',
    y: 22,
  },
]

// Four equal columns put their centres at these percentages of the width —
// the route line and its stops are pinned to the same figures, so each stop
// lands directly above its card at any screen size.
const STOP_X = [12.5, 37.5, 62.5, 87.5]

const routePoints = STOP_X.map((x, i) => `${x},${STEPS[i].y}`).join(' ')

export function HowShuttlesWork() {
  return (
    <section className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-12 md:py-16">
      <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">How it works</p>
      <h2 className="font-display text-3xl sm:text-4xl text-forest mb-3">Booking a shuttle, start to finish</h2>
      <p className="font-sans text-sm text-forest/50 max-w-2xl mb-8">
        Every transfer is a private vehicle from a registered Drakensberg operator. Here is the whole journey from
        search to pickup.
      </p>

      {/* ── The route, drawn as a line across a map ─────────────────────────
          Only from md up, where four columns actually sit side by side. The
          SVG is stretched to the section's width (preserveAspectRatio="none")
          so the line tracks the columns exactly; strokes keep their real
          width via vector-effect, and the round stops are HTML markers
          positioned on the same percentages rather than circles that the
          stretch would squash into ellipses. */}
      <div className="relative hidden md:block h-32 mb-2" aria-hidden="true">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* Map ground: contour lines and a faint survey grid */}
          <g stroke="currentColor" className="text-forest/[0.07]" fill="none" vectorEffect="non-scaling-stroke">
            <path d="M0,88 C18,80 30,92 46,84 C62,76 74,90 100,80" vectorEffect="non-scaling-stroke" />
            <path d="M0,70 C20,60 34,74 52,64 C70,54 82,70 100,60" vectorEffect="non-scaling-stroke" />
            <path d="M0,44 C22,34 36,48 54,38 C72,28 84,42 100,32" vectorEffect="non-scaling-stroke" />
            <path d="M0,22 C24,14 38,26 56,16 C74,6 86,18 100,10" vectorEffect="non-scaling-stroke" />
          </g>
          <g stroke="currentColor" className="text-forest/[0.05]" vectorEffect="non-scaling-stroke">
            {[25, 50, 75].map(x => <line key={x} x1={x} y1="0" x2={x} y2="100" vectorEffect="non-scaling-stroke" />)}
          </g>

          {/* The journey itself — one continuous plotted line through the
              four stops, dashed the way a route is drawn on a map. */}
          <polyline
            points={routePoints}
            fill="none"
            stroke="currentColor"
            className="text-gold"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Stops on the route */}
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div
              key={step.title}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${STOP_X[i]}%`, top: `${step.y}%` }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-gold/40 shadow-sm shadow-black/5">
                <Icon size={19} className="text-gold" strokeWidth={1.6} />
              </span>
            </div>
          )
        })}

        {/* Where the line starts and where it gets you */}
        <span className="absolute left-0 bottom-0 font-sans text-[9px] tracking-[0.16em] uppercase text-forest/25">Search</span>
        <span className="absolute right-0 top-0 font-sans text-[9px] tracking-[0.16em] uppercase text-forest/25">Picked up</span>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <li key={step.title} className="relative flex items-start gap-4 md:block md:gap-0">
              {/* On a phone the route turns and runs down a gutter beside the
                  steps. Each stop but the last carries the segment on to the
                  next one — reaching past the card by exactly the grid gap,
                  so the line reads as unbroken and stops where the journey
                  does. */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="md:hidden absolute left-[1.375rem] top-11 -bottom-4 border-l-2 border-dashed border-gold/30"
                />
              )}
              <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mist border border-gold/40 md:hidden">
                <Icon size={18} className="text-gold" strokeWidth={1.6} />
              </span>

              <div className="relative flex-1 min-w-0 bg-white border border-black/8 p-5">
                <span className="absolute right-4 top-3 font-display text-4xl text-forest/[0.07] leading-none select-none" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="font-display text-lg text-forest leading-snug mb-2 pr-8">{step.title}</h3>
                <p className="font-sans text-xs text-forest/50 leading-relaxed">{step.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
