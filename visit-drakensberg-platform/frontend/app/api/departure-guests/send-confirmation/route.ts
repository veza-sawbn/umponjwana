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

// Deliberately loose (no full RFC 5322 compliance attempted) — just enough
// to reject an obviously-mistyped address (no @, no domain) with a clear
// message here rather than letting it reach the mailer/SMTP layer and fail
// in some more roundabout way further down.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

/**
 * The site origin for links/images in the email. Deliberately never uses
 * `new URL(...)` — a proxied/rewritten request can hand a Route Handler a
 * `req.url` the URL parser rejects, and that exception previously escaped
 * this route as an opaque "The string did not match the expected pattern."
 * with no indication of where it came from. Plain string handling can't
 * throw the same way.
 */
function resolveOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${host}`
  }
  return 'https://visitdrakensberg.com'
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
      return NextResponse.json({ error: `"${guest.email}" doesn't look like a valid email address — edit the guest's email and try again` }, { status: 400 })
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
    }))

    const origin = resolveOrigin(req)
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
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error building the confirmation email'
    console.error('[send-confirmation] failed:', e)
    return NextResponse.json({ sent: false, error: message }, { status: 500 })
  }
}
