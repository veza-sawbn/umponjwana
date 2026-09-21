import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendMail } from '@/lib/mailer'
import {
  emailShell, ctaButton, detailTable, itineraryBlock, esc, sectionLabel, finePrint,
  bodyHeading, checklist, factPanel, noticePanel, stepList,
  type EmailItineraryDay,
} from '@/lib/email-layout'
import { getDepartures, type DeparturePackage } from '@/lib/departures'
import { getTours, resolveItinerary, type Tour } from '@/lib/tours'
import { getTrails } from '@/lib/trails'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

// Emails a booking confirmation + day-by-day itinerary to a guest the
// supplier added by hand on a departure (lib/departure-guests.ts) — the
// "migrating from Wix Events" path, which never goes through checkout so
// has no vd_bookings/vd_orders row and no receipt email of its own. The
// itinerary shown is scoped to exactly the rate package this guest paid
// for (DepartureGuest.packageId), via the same resolveItinerary() the
// guest-facing account/print itinerary views use.
//
// Data access runs under the CALLER's session, so RLS applies: only the
// owning supplier, ops staff managing them, or an admin can trigger this
// (same policy as "Suppliers manage own departure guests").
//
// Everything below the request-body parse runs inside one try/catch: an
// unexpected exception here (bad data on the departure/tour/trail, a mailer
// hiccup, whatever) must never surface to the guest-adding supplier as a
// raw, unexplained engine error — it always comes back as a clean
// {sent:false, error} the UI can show verbatim.

// Deliberately NOT imported from components/tours/PackageEditor.tsx, even
// though that file exports the identical resolveLivePackages() — it's a
// 'use client' module, and pulling a client-boundary export into a Route
// Handler's server bundle turns it into a non-callable client reference in
// a production build (passes tsc, works in `next dev`, throws "X is not a
// function" once actually built/deployed). lib/experiences.ts's private
// resolveTierPackages() hit this exact trap already — same fix, same
// reasoning: duplicate the ~10 lines here rather than import across that
// boundary.
function resolveLivePackages(packages: DeparturePackage[], tour: Tour | undefined): DeparturePackage[] {
  if (!tour) return packages
  return packages.map(p => {
    if (!p.tierId) return p
    const tier = tour.pricingTiers?.find(t => t.id === p.tierId)
    if (!tier) return p
    return { ...p, name: tier.name, inclusions: tier.inclusions, pricePerPerson: p.priceOverride ?? tier.pricePerPerson }
  })
}

// Deliberately loose (no full RFC 5322 compliance attempted) — just enough
// to reject an obviously-mistyped address (no @, no domain) with a clear
// message here rather than letting it reach the mailer/SMTP layer and fail
// in some more roundabout way further down.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Never throws — an unparsable/missing date renders as '—' instead of blowing up the whole send. */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
/** Never throws — an unparsable/missing anchor date is returned unchanged rather than via a throwing Date round-trip. */
function addDaysIso(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Only an absolute https:// image can be a hero: an email client has no base
// URL to resolve a relative path against, and a http:// image is stripped or
// warned about by most of them. A trail with anything else stored simply gets
// the text-led confirmation it got before.
function heroFrom(image: string | undefined, alt: string): { src: string; alt: string } | undefined {
  return image?.startsWith('https://') ? { src: image, alt } : undefined
}

export async function POST(req: Request) {
  let body: { guestId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.guestId) return NextResponse.json({ error: 'guestId required' }, { status: 400 })

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    // RLS on vd_departure_guests scopes this read to the owning supplier, ops
    // staff with view_bookings on them, or an admin — anyone else gets no row.
    const { data: guest } = await supabase
      .from('vd_departure_guests').select('*').eq('id', body.guestId).maybeSingle()
    if (!guest) return NextResponse.json({ error: 'guest not found' }, { status: 404 })
    if (!guest.email) return NextResponse.json({ error: 'this guest has no email address on file' }, { status: 400 })
    if (!EMAIL_RE.test(guest.email)) {
      return NextResponse.json({ error: `"${guest.email}" doesn't look like a valid email address. Edit the guest's email and try again` }, { status: 400 })
    }

    const [departures, tours, trails] = await Promise.all([
      getDepartures(supabase), getTours(supabase), getTrails(supabase),
    ])
    const departure = departures.find(d => d.id === guest.departure_id)
    if (!departure) return NextResponse.json({ error: 'departure not found' }, { status: 404 })
    const tour = tours.find(t => t.id === departure.tourId)
    const trail = trails.find(t => t.id === (departure.trailId || tour?.trailId))

    const livePackages = departure.packages ? resolveLivePackages(departure.packages, tour) : []
    const pkg = livePackages.find(p => p.id === guest.package_id) ?? undefined

    const composed = resolveItinerary(trail?.days, tour?.pricingTiers, pkg)
    const itineraryDays: EmailItineraryDay[] = composed.map((d, i) => ({
      dayNumber: i + 1,
      dateLabel: fmtDate(addDaysIso(departure.date, d.dateOffset)),
      label: d.label,
      description: d.description,
      accommodation: d.accommodation,
      transport: d.transport,
      meals: d.meals,
      distance: d.distance,
      elevation: d.elevation,
    }))

    const origin = getSiteOrigin(req)
    const tripName = tour?.name || departure.tour
    const operatorName = departure.supplierName || tour?.supplierName || 'Visit Drakensberg'

    // Where to be, when, and who to call — the block a guest screenshots and
    // opens again in a car park at 5am. Kept separate from the ledger below:
    // the summary table answers "what did I buy", this answers "where do I go".
    const meetingRows: [string, string][] = [
      ...(tour?.meetingPoint ? ([['Meeting point', tour.meetingPoint]] as [string, string][]) : []),
      ...(trail?.trailhead && trail.trailhead !== tour?.meetingPoint
        ? ([['Trailhead', trail.trailhead]] as [string, string][]) : []),
      ...(departure.guide || tour?.leadGuide
        ? ([['Guide', departure.guide || tour?.leadGuide || '']] as [string, string][]) : []),
    ]

    // Everything the guest is told to do is something they can act on alone.
    // Nothing here promises anything on the operator's behalf — we don't know
    // what they send or when, and a confirmation email is the wrong place to
    // invent a commitment for somebody else.
    const nextSteps = [
      `Check the details above against what you booked. If anything is wrong, tell ${operatorName} now rather than on the day.`,
      'Put the departure date in your calendar, along with the meeting point.',
      ...(trail?.what_to_bring?.length ? ['Work through the kit list below and replace anything worn out before you travel.'] : []),
      `Contact ${operatorName} a few days beforehand to confirm the meeting time and the conditions expected.`,
    ]

    // A permit line only appears when the trail actually records one, and it
    // stops short of saying who pays: the platform doesn't know whether this
    // operator's rate includes it, and guessing would strand someone at a gate.
    const permitNote = trail?.permit_required
      ? `This route requires a permit${trail.permit_cost ? ` (around R${esc(String(trail.permit_cost))} per person)` : ''}.
         Confirm with ${esc(operatorName)} whether your booking covers it before you travel.<br/><br/>`
      : ''

    const html = emailShell({
      origin,
      eyebrow: 'Booking Confirmed',
      heading: tripName,
      preheader: `Your booking for ${tripName} on ${fmtDate(departure.date)} is confirmed.`,
      hero: heroFrom(trail?.image, trail?.name ? `${trail.name}, Drakensberg` : tripName),
      bodyHtml: `
        <p style="margin:0 0 4px;">Dear ${esc(guest.name)},</p>
        <p style="margin:0 0 20px;">Your booking with <strong>${esc(operatorName)}</strong> is confirmed. Here are your trip details.</p>
        ${detailTable([
          ['Trip', tripName],
          ['Departure date', fmtDate(departure.date)],
          ['Guests', String(guest.seats)],
          ...(pkg ? ([['Rate', pkg.name]] as [string, string][]) : []),
          ...(trail?.difficulty ? ([['Grading', trail.difficulty]] as [string, string][]) : []),
        ])}
        ${meetingRows.length > 0 ? factPanel(meetingRows, 'Where to be') : ''}
        ${bodyHeading('What happens next')}
        ${stepList(nextSteps)}
        ${itineraryDays.length > 0 ? `
          ${sectionLabel('Day-by-day itinerary')}
          ${itineraryBlock(itineraryDays)}
        ` : ''}
        ${trail?.what_to_bring?.length ? `
          ${bodyHeading('What to bring')}
          ${checklist(trail.what_to_bring)}
        ` : ''}
        ${tour?.fitnessNotes ? `
          ${bodyHeading('What this trip asks of you')}
          <p style="margin:0;">${esc(tour.fitnessNotes)}</p>
        ` : ''}
        ${noticePanel('Before you travel', `${permitNote}Mountain weather turns quickly, and a route can
          be changed or turned back for safety or access reasons. Follow your guide's decisions on the
          day, and tell ${esc(operatorName)} in advance about any injury, medication or dietary
          requirement that has changed since you booked.`, 'caution')}
        ${ctaButton(`${origin}/experiences/${departure.id}`, 'View this experience')}
        ${finePrint(`Keep this email for your records. If anything above doesn't look right,
          get in touch with ${esc(operatorName)} directly.${tour?.cancellation ? `<br/><br/>Cancellation: ${esc(tour.cancellation)}` : ''}`)}`,
    })

    const result = await sendMail({
      to: guest.email,
      subject: `Booking confirmed for ${tripName}`,
      html,
    })

    return NextResponse.json({ sent: result.sent, error: result.error })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error building the confirmation email'
    console.error('[send-confirmation] failed:', e)
    return NextResponse.json({ sent: false, error: message }, { status: 500 })
  }
}
