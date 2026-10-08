# Grand Tour Drakensberg & ticketing

Where the pieces live, for the next person (or session) looking for them.

## The Grand Tour page — `/grand-tour`

- `app/grand-tour/page.tsx`: server shell (ISR, 5 min). Loads live activities and keeps the Grand Tour ones.
- `components/grand-tour/GrandTourExperience.tsx`: the scroll itinerary. Hero, seven stages north to south, highlights that fade in, a route rail that fills as you scroll (desktop) or a stage bar (mobile), and the bookable day tours under each stage. Includes a "pick up from my hotel" filter.
- `lib/grand-tour.ts`: the editorial route (stages and highlights) and helpers. Edit stage copy and images here.

## Who runs it: VD Operations

The Grand Tour is run by Visit Drakensberg, not by each supplier. Suppliers list and price their activities and add timeslots (the departures) as usual; **VD Operations** puts them on the Grand Tour and boards the guests. Both tools live in the operations panel and appear for an ops employee holding the permission on at least one supplier:

| Tool | Route | Permission | What it does |
|---|---|---|---|
| Grand Tour | `/operations/grand-tour` | Manage Inventory | Add an activity to the Grand Tour, choose its highlights, where it departs from and its **hotel pickups** (each with "minutes before departure", so a 07:30 Sani Pass departure with a 45-minute lead prints a 06:45 pickup at Champagne Sports Resort), and publish or unpublish it. Flags anything stopping it from being bookable. |
| Boarding & Check-in | `/operations/boarding` | Manage Bookings | Pick the departure, scan tickets or type codes, and work the passenger list grouped by hotel pickup. |

The listing is stored as `Activity.grandTour` (`lib/activities.ts`); the editor is `components/activities/GrandTourEditor.tsx`, and the scanner is `components/boarding/BoardingConsole.tsx`.

**Enforced in the database, not just hidden** (`supabase/migrations/20261008_grand_tour_ops_only.sql`):
- A trigger on `vd_entities` keeps an activity's `grandTour` unchanged unless the writer is staff, an ops employee with Manage Inventory on that supplier, the service role, or a direct database session. A supplier saving their activity form never clears it, and can't set one.
- `vd_redeem_ticket` boards a Grand Tour ticket only for staff or an ops employee with Manage Bookings on its supplier. Suppliers keep `/supplier/check-in` for their own event tickets and ordinary activity tickets.

## Each day tour's own page — `/grand-tour/[slug]`

- `app/grand-tour/[slug]/page.tsx` + `components/grand-tour/DayTourDetail.tsx`: hero, the day as a route (hotel pickups with times → the Grand Tour highlights it visits → back to the hotel), inclusions, and the booking panel. Indexed and bookable only when the activity is active, listed on the Grand Tour and has timeslots; otherwise it shows a "preview" notice with booking disabled.
- `components/grand-tour/DayTourBooking.tsx`: departure chips, hotel pickup, adults/children, **Book now** (adds the seats and goes straight to `/checkout`) and **Add to trip**.
- On `/grand-tour`, every stage ends in a bookable option: its day tours, or, while it has none, guided tours on its trails (`relatedTrailIds`) and live activities in its area (`areaHome`), built server-side in `app/grand-tour/page.tsx`.

## How a guest books

`/grand-tour/[slug]` (or `/activities/[id]`, which offers the same pickup choice): pick a date, departure and hotel pickup (pre-filled when arriving from `/grand-tour`), then book. Checkout holds the seats (`vd_hold_inventory`, kind `activity_slot`) like any timeslotted activity. The order line's `value` carries `activityId / slotDate / timeslotId / pickupPointId`.

## Tickets

One ticketing system covers both event tickets and day-tour seats: table `vd_tickets`.

| Piece | File |
|---|---|
| Schema, event issuance | `supabase/migrations/20261008_event_ticketing.sql` |
| Day-tour seats, auth hardening, wrong-day check | `supabase/migrations/20261008_grand_tour_boarding.sql` |
| Grand Tour is VD-Operations-only | `supabase/migrations/20261008_grand_tour_ops_only.sql` |
| Client wrapper | `lib/tickets.ts` |
| Minting on payment | `app/api/payments/ikhokha/webhook/route.ts` (one ticket per paid seat, idempotent per order line) |
| Guest wallet (QR, tap to enlarge) | `app/account/tickets/page.tsx` |
| Boarding (VD Operations) | `app/operations/boarding/page.tsx` → `components/boarding/BoardingConsole.tsx` |
| Supplier event-ticket scanner | `app/supplier/check-in/page.tsx` |
| Receipt email link | `lib/receipts-server.ts` ("View your tickets") |

Scanning (`vd_redeem_ticket`) only boards a day-tour ticket on its own departure date (South African time). The scanner also warns when a ticket belongs to a different departure than the one selected, with a "Board anyway" override for the operator. Cancelling a booking voids its unredeemed tickets (`vd_release_tickets`). Day-tour seats come back through the booking's inventory holds; event capacity comes back directly.

The event-ticketing work was originally built on `claude/supplier-types-capabilities-gt915o` (commit `2e1ffc0`) and merged here.
