import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendMail } from '@/lib/mailer'
import {
  emailShell, ctaButton, detailTable, itineraryBlock, esc, getFeaturedExperiences,
  type EmailItineraryDay,
} from '@/lib/email-layout'
import { getDepartures } from '@/lib/departures'
import { getTours, resolveItinerary } from '@/lib/tours'
import { getTrails } from '@/lib/trails'
import { resolveLivePackages } from '@/components/tours/PackageEditor'

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function addDaysIso(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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

  // RLS on vd_departure_guests scopes this read to the owning supplier, ops
  // staff with view_bookings on them, or an admin — anyone else gets no row.
  const { data: guest } = await supabase
    .from('vd_departure_guests').select('*').eq('id', body.guestId).maybeSingle()
  if (!guest) return NextResponse.json({ error: 'guest not found' }, { status: 404 })
  if (!guest.email) return NextResponse.json({ error: 'this guest has no email address on file' }, { status: 400 })

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
  }))

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const tripName = tour?.name || departure.tour
  const operatorName = departure.supplierName || tour?.supplierName || 'Visit Drakensberg'
  const featured = await getFeaturedExperiences(origin)

  const html = emailShell({
    origin,
    eyebrow: 'Booking Confirmed',
    heading: tripName,
    preheader: `Your booking for ${tripName} on ${fmtDate(departure.date)} is confirmed.`,
    featured,
    bodyHtml: `
      <p style="margin:0 0 4px;">Dear ${esc(guest.name)},</p>
      <p style="margin:0 0 20px;">Your booking with <strong>${esc(operatorName)}</strong> is confirmed. Here are your trip details.</p>
      ${detailTable([
        ['Trip', tripName],
        ['Departure date', fmtDate(departure.date)],
        ['Guests', String(guest.seats)],
        ...(pkg ? ([['Rate', pkg.name]] as [string, string][]) : []),
        ...(tour?.meetingPoint ? ([['Meeting point', tour.meetingPoint]] as [string, string][]) : []),
        ...(departure.guide ? ([['Guide', departure.guide]] as [string, string][]) : []),
      ])}
      ${itineraryDays.length > 0 ? `
        <p style="margin:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C9A96E;">Day-by-Day Itinerary</p>
        ${itineraryBlock(itineraryDays)}
      ` : ''}
      ${ctaButton(`${origin}/experiences/${departure.id}`, 'View this experience')}
      <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">
        Keep this email for your records. If anything above doesn't look right, get in touch with ${esc(operatorName)} directly.
      </p>`,
  })

  const result = await sendMail({
    to: guest.email,
    subject: `Booking confirmed — ${tripName}`,
    html,
  })

  return NextResponse.json({ sent: result.sent, error: result.error })
}
